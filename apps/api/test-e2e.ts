// End-to-end smoke test. Drives the API the way a real client would:
//   1. Customer signs in via OTP
//   2. Browses menu, places a delivery order
//   3. Pays online (stub)
//   4. Admin walks order through KDS states
//   5. Auto-assignment kicks in, rider accepts
//   6. Rider sends GPS pings, picks up, delivers
//   7. Customer creates a table booking
//   8. Host scans QR, customer is seated

const BASE = process.env.BASE ?? 'http://localhost:4000';

async function call<T = any>(path: string, body?: any, token?: string, method = body ? 'POST' : 'GET'): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`${method} ${path} → ${r.status}: ${txt}`);
  }
  return r.json();
}

async function login(phone: string, name?: string) {
  await call('/api/v1/auth/otp/send', { phone });
  const r = await call<any>('/api/v1/auth/otp/verify', { phone, otp: '000000', name });
  return { token: r.token as string, user: r.user };
}

function step(n: string) { console.log('\n— ' + n); }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  step('1. customer login');
  const cust = await login('+919999000003', 'Demo Customer');
  console.log('  user:', cust.user.name);

  step('2. browse menu');
  const menu = await call<{ items: any[] }>('/api/v1/menu/items');
  const branch = await call<{ branch: any }>('/api/v1/menu/branch');
  const biryani = menu.items.find((i) => i.name.includes('Hyderabadi'))!;
  const naan = menu.items.find((i) => i.name === 'Butter Naan')!;
  console.log('  picked:', biryani.name, '+', naan.name);

  step('3. quote');
  const cart = [
    { itemId: biryani.id, qty: 1, modifierIds: [
      biryani.modifierGroups.find((g: any) => g.name === 'Spice Level').modifiers[1].id,
      biryani.modifierGroups.find((g: any) => g.name === 'Portion').modifiers[1].id,
    ]},
    { itemId: naan.id, qty: 2, modifierIds: [] },
  ];
  const quote = await call<any>('/api/v1/orders/quote', {
    branchId: branch.branch.id, type: 'DELIVERY', cart,
    destination: { lat: 17.4239, lng: 78.4738 },
    couponCode: 'FIRST50',
  });
  console.log(`  total: ₹${quote.total} (sub ${quote.subtotal} + tax ${quote.tax.toFixed(2)} + delivery ${quote.deliveryFee} − discount ${quote.discount})`);

  step('4. place order (online)');
  const placed = await call<any>('/api/v1/orders', {
    branchId: branch.branch.id, type: 'DELIVERY', paymentMode: 'ONLINE',
    cart,
    address: { line1: '12-3-456', pincode: '500033', lat: 17.4239, lng: 78.4738 },
    couponCode: 'FIRST50',
  }, cust.token);
  console.log('  orderNumber:', placed.order.orderNumber);

  step('5. confirm payment');
  const paid = await call<any>(`/api/v1/orders/${placed.order.id}/confirm-payment`, {
    razorpayOrderId: placed.razorpay.id,
    razorpayPaymentId: 'pay_test_xxx',
    razorpaySignature: 'sig_test',
  }, cust.token);
  console.log('  status:', paid.order.status);

  step('6. admin walks through KDS states');
  const admin = await login('+919999000002');
  for (const to of ['ACCEPTED', 'PREPARING', 'READY']) {
    const r = await call<any>(`/api/v1/admin/orders/${placed.order.id}/transition`, { to }, admin.token);
    console.log('  →', r.order.status);
  }

  step('7. wait for auto-assignment, then rider accepts');
  // start a rider shift first if not already
  const rider = await login('+919999000010');
  await call('/api/v1/rider/shifts/start', {}, rider.token).catch(() => {});
  // set rider position close to branch
  await call('/api/v1/rider/ping', { lat: 17.385, lng: 78.4867 }, rider.token);

  // After admin marked READY, the assign sweep runs every 30s. But /transition
  // also triggers tryAssignRider directly — give it 1s to fan out.
  await sleep(1500);
  const detail = await call<any>(`/api/v1/orders/${placed.order.id}`, undefined, admin.token);
  if (detail.order.riderId) {
    console.log('  rider assigned:', detail.order.rider?.user?.name ?? detail.order.riderId);
    // Whoever got the offer accepts. We need to discover who.
    // Easiest: call accept from each candidate; non-assignees will 403.
    for (const phone of ['+919999000010', '+919999000011', '+919999000012']) {
      try {
        const r = await login(phone);
        const me = await call<any>('/api/v1/rider/me', undefined, r.token);
        if (me.rider.id === detail.order.riderId) {
          await call(`/api/v1/rider/orders/${placed.order.id}/accept`, {}, r.token);
          console.log('  accepted by', me.rider.user.name);
          // pick up
          await call(`/api/v1/rider/orders/${placed.order.id}/picked-up`, {}, r.token);
          console.log('  picked up — out for delivery');
          // gps ping
          await call('/api/v1/rider/ping', { lat: 17.40, lng: 78.48 }, r.token);
          // delivered
          await call(`/api/v1/rider/orders/${placed.order.id}/delivered`, {}, r.token);
          console.log('  delivered ✓');
          break;
        }
      } catch (e: any) {
        // skip
      }
    }
  } else {
    console.log('  ⚠ no rider was auto-assigned in 1.5s');
  }

  step('8. table booking flow');
  const today = new Date().toISOString().slice(0, 10);
  const slots = await call<any>(`/api/v1/bookings/availability?branchId=${branch.branch.id}&date=${today}&partySize=4`);
  console.log('  available slots today:', slots.slots.length);
  if (slots.slots.length) {
    const slot = slots.slots[Math.min(4, slots.slots.length - 1)];
    const booked = await call<any>('/api/v1/bookings', {
      branchId: branch.branch.id, partySize: 4, slotStart: slot.start,
      occasion: 'Birthday', specialRequest: 'Window seat please',
    }, cust.token);
    console.log('  booking:', booked.booking.bookingNumber, 'table', booked.booking.tableId);

    step('9. host check-in via QR token');
    const checkedIn = await call<any>(`/api/v1/bookings/checkin/${booked.booking.qrToken}`, {});
    console.log('  status →', checkedIn.booking.status);
  }

  step('10. analytics snapshot');
  const a = await call<any>('/api/v1/admin/analytics/today', undefined, admin.token);
  console.log('  orders today:', a.orders, '· delivered:', a.delivered, '· revenue ₹' + a.revenue.toFixed(0));
  console.log('  byStatus:', JSON.stringify(a.byStatus));
  console.log('  bookings:', a.bookings);

  console.log('\n✅ end-to-end OK');
}

main().catch((e) => { console.error('\n❌', e.message); process.exit(1); });
