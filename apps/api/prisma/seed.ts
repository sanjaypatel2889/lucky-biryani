import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const now = () => new Date().toISOString();

async function main() {
  console.log('Seeding…');

  // Idempotency guard: skip if a branch already exists. Re-seeding wipes
  // every order/booking, so we only seed when the DB is fresh. Force a
  // re-seed locally with `npm run db:reset && npm run db:seed`.
  const existing = await prisma.branch.count();
  if (existing > 0 && process.env.SEED_FORCE !== '1') {
    console.log(`Branch already present (${existing}). Skipping seed. Set SEED_FORCE=1 to override.`);
    return;
  }

  // wipe (only runs on a fresh DB or with SEED_FORCE=1)
  await prisma.notificationLog.deleteMany();
  await prisma.loyaltyLedger.deleteMany();
  await prisma.review.deleteMany();
  await prisma.orderEvent.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.riderPing.deleteMany();
  await prisma.riderShift.deleteMany();
  await prisma.rider.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.itemModifierGroup.deleteMany();
  await prisma.modifier.deleteMany();
  await prisma.modifierGroup.deleteMany();
  await prisma.item.deleteMany();
  await prisma.category.deleteMany();
  await prisma.table.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();

  // Branch
  const branch = await prisma.branch.create({
    data: {
      name: 'Lucky Biryani Centre',
      slug: 'lbc-main',
      lat: 17.385,
      lng: 78.4867,
      address: 'Banjara Hills, Hyderabad',
      openHour: 11,
      closeHour: 23,
      fssai: 'FSSAI-DEMO-12345',
      gstin: '36ABCDE1234F1Z5',
    },
  });

  // Categories
  const cats = await Promise.all([
    prisma.category.create({ data: { name: 'Biryani',     slug: 'biryani',     position: 1 } }),
    prisma.category.create({ data: { name: 'Appetisers',  slug: 'appetisers',  position: 2 } }),
    prisma.category.create({ data: { name: 'Curries',     slug: 'curries',     position: 3 } }),
    prisma.category.create({ data: { name: 'Breads',      slug: 'breads',      position: 4 } }),
    prisma.category.create({ data: { name: 'Desserts',    slug: 'desserts',    position: 5 } }),
    prisma.category.create({ data: { name: 'Beverages',   slug: 'beverages',   position: 6 } }),
  ]);
  const [biryani, appetisers, curries, breads, desserts, beverages] = cats;

  // Modifier groups
  const spice = await prisma.modifierGroup.create({
    data: {
      name: 'Spice Level', required: true, minSelect: 1, maxSelect: 1,
      modifiers: {
        create: [
          { name: 'Mild',         priceDelta: 0, position: 1 },
          { name: 'Medium',       priceDelta: 0, position: 2 },
          { name: 'Hot',          priceDelta: 0, position: 3 },
          { name: 'Extra Spicy',  priceDelta: 0, position: 4 },
        ],
      },
    },
    include: { modifiers: true },
  });

  const portion = await prisma.modifierGroup.create({
    data: {
      name: 'Portion', required: true, minSelect: 1, maxSelect: 1,
      modifiers: {
        create: [
          { name: 'Half',  priceDelta: -80, position: 1 },
          { name: 'Full',  priceDelta:   0, position: 2 },
          { name: 'Family', priceDelta: 180, position: 3 },
        ],
      },
    },
    include: { modifiers: true },
  });

  const addons = await prisma.modifierGroup.create({
    data: {
      name: 'Add-ons', required: false, minSelect: 0, maxSelect: 3,
      modifiers: {
        create: [
          { name: 'Extra Raita',     priceDelta: 30, position: 1 },
          { name: 'Boiled Egg',      priceDelta: 25, position: 2 },
          { name: 'Mirchi ka Salan', priceDelta: 40, position: 3 },
        ],
      },
    },
    include: { modifiers: true },
  });

  type ItemDef = {
    cat: string; name: string; desc: string; price: number; veg: boolean;
    spice?: number; prep?: number; mods?: string[]; tax?: number;
  };
  const itemDefs: ItemDef[] = [
    { cat: biryani.id, name: 'Hyderabadi Chicken Biryani', desc: 'Long-grain basmati, slow-cooked with marinated chicken, saffron and aromatic spices.', price: 320, veg: false, spice: 2, prep: 25, mods: [spice.id, portion.id, addons.id] },
    { cat: biryani.id, name: 'Mutton Dum Biryani',         desc: 'Tender mutton, sealed dum-style with caramelized onions.', price: 420, veg: false, spice: 2, prep: 35, mods: [spice.id, portion.id, addons.id] },
    { cat: biryani.id, name: 'Veg Biryani',                desc: 'Seasonal vegetables, mint, fried onions, ghee.', price: 240, veg: true, spice: 1, prep: 22, mods: [spice.id, portion.id, addons.id] },
    { cat: biryani.id, name: 'Prawn Biryani',              desc: 'Fresh prawns, coastal masala, basmati rice.', price: 380, veg: false, spice: 2, prep: 28, mods: [spice.id, portion.id, addons.id] },

    { cat: appetisers.id, name: 'Chicken 65',     desc: 'Crispy fried chicken bites tossed with curry leaves.', price: 220, veg: false, spice: 3, prep: 15 },
    { cat: appetisers.id, name: 'Paneer Tikka',   desc: 'Tandoor-grilled paneer with peppers and onion.', price: 240, veg: true, spice: 1, prep: 18 },
    { cat: appetisers.id, name: 'Veg Manchurian', desc: 'Indo-Chinese cabbage and carrot dumplings.', price: 180, veg: true, spice: 2, prep: 14 },

    { cat: curries.id, name: 'Butter Chicken',     desc: 'Creamy tomato gravy with tandoor chicken.', price: 280, veg: false, spice: 1, prep: 18 },
    { cat: curries.id, name: 'Paneer Butter Masala', desc: 'Rich tomato-cashew gravy with paneer.', price: 240, veg: true, spice: 1, prep: 16 },
    { cat: curries.id, name: 'Dal Makhani',         desc: 'Slow-cooked black lentils with butter.', price: 200, veg: true, spice: 1, prep: 20 },

    { cat: breads.id, name: 'Butter Naan',  desc: 'Soft tandoor-baked bread, butter-brushed.', price: 50, veg: true, prep: 5 },
    { cat: breads.id, name: 'Garlic Naan',  desc: 'Naan with fresh garlic and coriander.', price: 60, veg: true, prep: 5 },
    { cat: breads.id, name: 'Tandoori Roti', desc: 'Whole-wheat tandoor roti.', price: 35, veg: true, prep: 5 },

    { cat: desserts.id, name: 'Double ka Meetha',  desc: 'Hyderabadi bread pudding in saffron milk.', price: 120, veg: true, prep: 8 },
    { cat: desserts.id, name: 'Gulab Jamun',       desc: 'Two pieces, warm syrup.', price: 80, veg: true, prep: 5 },
    { cat: desserts.id, name: 'Qubani ka Meetha',  desc: 'Apricot stew with cream.', price: 140, veg: true, prep: 7 },

    { cat: beverages.id, name: 'Mango Lassi',      desc: 'Sweet yogurt-mango drink.', price: 90, veg: true, prep: 4, tax: 0.05 },
    { cat: beverages.id, name: 'Masala Chai',      desc: 'Spiced milk tea.', price: 40, veg: true, prep: 5 },
    { cat: beverages.id, name: 'Bottled Soft Drink', desc: '300ml.', price: 50, veg: true, prep: 1, tax: 0.18 },
  ];

  for (const def of itemDefs) {
    const item = await prisma.item.create({
      data: {
        categoryId: def.cat, name: def.name, description: def.desc,
        basePrice: def.price, isVeg: def.veg, spiceLevel: def.spice ?? 1,
        prepMinutes: def.prep ?? 15, taxRate: def.tax ?? 0.05,
      },
    });
    for (const [i, gid] of (def.mods ?? []).entries()) {
      await prisma.itemModifierGroup.create({
        data: { itemId: item.id, groupId: gid, position: i },
      });
    }
    await prisma.inventory.create({
      data: { itemId: item.id, branchId: branch.id, available: 999, updatedAt: now() },
    });
  }

  // Tables — 20+ as per doc
  const tableLayout = [
    ...Array.from({ length: 6 }, (_, i) => ({ number: `T${i + 1}`,  capacity: 2, zone: 'Indoor' })),
    ...Array.from({ length: 8 }, (_, i) => ({ number: `T${i + 7}`,  capacity: 4, zone: 'Indoor' })),
    ...Array.from({ length: 4 }, (_, i) => ({ number: `T${i + 15}`, capacity: 6, zone: 'Indoor' })),
    ...Array.from({ length: 2 }, (_, i) => ({ number: `P${i + 1}`,  capacity: 4, zone: 'Patio' })),
    ...Array.from({ length: 2 }, (_, i) => ({ number: `F${i + 1}`,  capacity: 8, zone: 'Family Room' })),
  ];
  for (const t of tableLayout) {
    await prisma.table.create({ data: { ...t, branchId: branch.id } });
  }

  // Coupons
  await prisma.coupon.createMany({
    data: [
      {
        code: 'FIRST50', description: '₹50 off your first order',
        type: 'FLAT', value: 50, minOrder: 200, maxDiscount: 50,
        validFrom: '2024-01-01T00:00:00.000Z', validUntil: '2027-12-31T23:59:59.000Z',
        firstOrderOnly: true,
      },
      {
        code: 'OFFPEAK10', description: '10% off — off-peak hours',
        type: 'PERCENT', value: 10, minOrder: 200, maxDiscount: 100,
        validFrom: '2024-01-01T00:00:00.000Z', validUntil: '2027-12-31T23:59:59.000Z',
      },
      {
        code: 'FREEDEL', description: 'Free delivery',
        type: 'FREE_DELIVERY', value: 0, minOrder: 300,
        validFrom: '2024-01-01T00:00:00.000Z', validUntil: '2027-12-31T23:59:59.000Z',
      },
    ],
  });

  // Demo users
  const owner = await prisma.user.create({
    data: { phone: '+919999000001', name: 'Lucky Owner', role: 'OWNER', createdAt: now() },
  });
  const admin = await prisma.user.create({
    data: { phone: '+919999000002', name: 'Floor Manager', role: 'ADMIN', createdAt: now() },
  });
  const customer = await prisma.user.create({
    data: { phone: '+919999000003', name: 'Demo Customer', role: 'CUSTOMER', loyaltyPoints: 50, createdAt: now() },
  });
  await prisma.address.create({
    data: {
      userId: customer.id, label: 'Home',
      line1: '12-3-456, Road No 1', line2: 'Jubilee Hills',
      pincode: '500033', city: 'Hyderabad',
      lat: 17.4239, lng: 78.4738, isDefault: true,
    },
  });

  // Riders
  const riderUsers = await Promise.all([
    prisma.user.create({ data: { phone: '+919999000010', name: 'Imran',  role: 'RIDER', createdAt: now() } }),
    prisma.user.create({ data: { phone: '+919999000011', name: 'Suresh', role: 'RIDER', createdAt: now() } }),
    prisma.user.create({ data: { phone: '+919999000012', name: 'Ravi',   role: 'RIDER', createdAt: now() } }),
  ]);
  for (const ru of riderUsers) {
    await prisma.rider.create({
      data: {
        userId: ru.id, vehicleType: 'BIKE',
        vehicleNumber: 'TS09-' + Math.floor(1000 + Math.random() * 9000),
        // start near branch
        lastLat: 17.385 + (Math.random() - 0.5) * 0.01,
        lastLng: 78.4867 + (Math.random() - 0.5) * 0.01,
        status: 'AVAILABLE',
        lastPingAt: now(),
      },
    });
  }

  console.log(`✓ Branch:    ${branch.name}`);
  console.log(`✓ Categories: ${cats.length}`);
  console.log(`✓ Items:     ${itemDefs.length}`);
  console.log(`✓ Tables:    ${tableLayout.length}`);
  console.log(`✓ Coupons:   FIRST50, OFFPEAK10, FREEDEL`);
  console.log(`✓ Riders:    ${riderUsers.length}`);
  console.log(`\nDemo logins (OTP = 000000):`);
  console.log(`  Owner    +919999000001`);
  console.log(`  Admin    +919999000002`);
  console.log(`  Customer +919999000003`);
  console.log(`  Riders   +919999000010 / 11 / 12`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
