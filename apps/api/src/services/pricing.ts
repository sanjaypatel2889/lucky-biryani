// Pricing / quote logic. Pure-ish — given a cart + context, returns line items
// and the totals breakdown. Used both at quote and at order-create time so
// the customer never sees a price that the server later disagrees with.

import { prisma } from '../db';
import { config } from '../config';
import { haversineKm } from '../util/geo';

export type CartLine = {
  itemId: string;
  qty: number;
  modifierIds?: string[];
  notes?: string;
};

export type QuoteInput = {
  branchId: string;
  type: 'DELIVERY' | 'PICKUP' | 'DINEIN';
  cart: CartLine[];
  destination?: { lat: number; lng: number };
  couponCode?: string;
  loyaltyPointsToUse?: number;
  weatherSurcharge?: boolean; // injected by automation when raining
  userId?: string;            // when present, member perks apply automatically
};

export type Quote = {
  lines: Array<{
    itemId: string;
    name: string;
    qty: number;
    unitPrice: number;
    modifiers: Array<{ id: string; name: string; priceDelta: number }>;
    notes?: string;
    lineTotal: number;
  }>;
  subtotal: number;
  tax: number;
  deliveryFee: number;
  weatherFee: number;
  discount: number;
  memberDiscount: number;     // Lucky Club discount (in addition to coupon)
  loyaltyUsed: number;
  total: number;
  distanceKm?: number;
  prepMinutes: number;
  errors: string[];
  couponCode?: string;
  memberPerksApplied?: { freeDelivery: boolean; discountPct: number };
};

export async function buildQuote(input: QuoteInput): Promise<Quote> {
  const errors: string[] = [];

  // Resolve active Lucky Club membership for the user, if any. The perks are
  // bundled on the plan but for the demo we only ever issue CLUB-tier so the
  // hardcoded rates here mirror the plan rows. If you change plan numbers,
  // update both — or fetch the plan row instead.
  let memberFreeDelivery = false;
  let memberDiscountPct = 0;
  if (input.userId) {
    const u = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { membershipTier: true, membershipUntil: true },
    });
    const active = u?.membershipUntil ? new Date(u.membershipUntil).getTime() > Date.now() : false;
    if (active && u?.membershipTier === 'CLUB') {
      memberFreeDelivery = true;
      memberDiscountPct = 0.05;
    }
  }

  if (!input.cart.length) errors.push('cart_empty');

  const items = await prisma.item.findMany({
    where: { id: { in: input.cart.map((c) => c.itemId) }, isActive: true },
    include: { inventory: { where: { branchId: input.branchId } } },
  });
  const byId = new Map(items.map((i) => [i.id, i]));

  const allModifierIds = input.cart.flatMap((c) => c.modifierIds ?? []);
  const modifiers = allModifierIds.length
    ? await prisma.modifier.findMany({ where: { id: { in: allModifierIds } } })
    : [];
  const modById = new Map(modifiers.map((m) => [m.id, m]));

  const lines: Quote['lines'] = [];
  let subtotal = 0;
  let tax = 0;
  let prepMax = 0;

  for (const cl of input.cart) {
    const item = byId.get(cl.itemId);
    if (!item) {
      errors.push(`item_missing:${cl.itemId}`);
      continue;
    }
    if (input.type === 'DELIVERY' && !item.availDelivery) errors.push(`item_unavailable_delivery:${item.id}`);
    if (input.type === 'DINEIN' && !item.availDinein) errors.push(`item_unavailable_dinein:${item.id}`);
    const inv = item.inventory[0];
    if (inv && inv.available < cl.qty) errors.push(`out_of_stock:${item.id}`);

    const mods = (cl.modifierIds ?? [])
      .map((id) => modById.get(id))
      .filter((m): m is NonNullable<typeof m> => !!m)
      .map((m) => ({ id: m.id, name: m.name, priceDelta: m.priceDelta }));
    const modSum = mods.reduce((s, m) => s + m.priceDelta, 0);
    const unitPrice = item.basePrice + modSum;
    const lineTotal = unitPrice * cl.qty;
    subtotal += lineTotal;
    tax += lineTotal * item.taxRate;
    if (item.prepMinutes > prepMax) prepMax = item.prepMinutes;

    lines.push({
      itemId: item.id,
      name: item.name,
      qty: cl.qty,
      unitPrice,
      modifiers: mods,
      notes: cl.notes,
      lineTotal,
    });
  }

  // Delivery fee
  let deliveryFee = 0;
  let distanceKm: number | undefined;
  if (input.type === 'DELIVERY') {
    if (subtotal < config.delivery.minCart)
      errors.push(`min_cart:${config.delivery.minCart}`);
    if (input.destination) {
      distanceKm = haversineKm(
        { lat: config.branch.lat, lng: config.branch.lng },
        input.destination,
      );
      if (distanceKm > config.delivery.maxRadiusKm)
        errors.push(`out_of_zone:${distanceKm.toFixed(2)}km`);
      deliveryFee = config.delivery.baseFee + Math.max(0, distanceKm - 1) * config.delivery.perKmFee;
      if (subtotal >= config.delivery.freeDeliveryAt) deliveryFee = 0;
      // Lucky Club: free delivery on any order, any distance (subject to zone)
      if (memberFreeDelivery) deliveryFee = 0;
    }
  }

  const weatherFee = input.weatherSurcharge && input.type === 'DELIVERY' ? 20 : 0;

  // Coupon
  let discount = 0;
  let appliedCode: string | undefined;
  if (input.couponCode) {
    const code = input.couponCode.trim().toUpperCase();
    const c = await prisma.coupon.findUnique({ where: { code } });
    const nowIso = new Date().toISOString();
    if (
      c && c.isActive &&
      c.validFrom <= nowIso && c.validUntil >= nowIso &&
      subtotal >= c.minOrder &&
      (c.usageLimit === 0 || c.usedCount < c.usageLimit)
    ) {
      if (c.type === 'PERCENT') {
        discount = Math.min((subtotal * c.value) / 100, c.maxDiscount ?? Infinity);
      } else if (c.type === 'FLAT') {
        discount = c.value;
      } else if (c.type === 'FREE_DELIVERY') {
        discount = deliveryFee;
        deliveryFee = 0;
      }
      appliedCode = code;
    } else {
      errors.push(`invalid_coupon:${code}`);
    }
  }

  // Loyalty (1 point = ₹1, max 20% of subtotal)
  const loyaltyUsed = Math.min(input.loyaltyPointsToUse ?? 0, Math.floor(subtotal * 0.2));

  // Lucky Club member discount on the subtotal (stacks with coupon)
  const memberDiscount = memberDiscountPct > 0 ? Math.round(subtotal * memberDiscountPct) : 0;

  const total = Math.max(0, subtotal + tax + deliveryFee + weatherFee - discount - memberDiscount - loyaltyUsed);

  return {
    lines, subtotal, tax, deliveryFee, weatherFee, discount, memberDiscount, loyaltyUsed,
    total, distanceKm, prepMinutes: prepMax, errors, couponCode: appliedCode,
    memberPerksApplied: memberFreeDelivery || memberDiscountPct > 0
      ? { freeDelivery: memberFreeDelivery, discountPct: memberDiscountPct }
      : undefined,
  };
}
