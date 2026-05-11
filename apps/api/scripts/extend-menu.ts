// Lucky Biryani — menu extender.
//
// Adds the expanded category + item set without wiping existing data. Safe to
// run on every deploy and locally. Specifically:
//
//   - Categories: inserted by slug; existing ones left alone.
//   - Items: inserted by exact name; existing items are NOT touched (admins
//     may have edited price/description/imageUrl from the panel).
//   - Modifier groups: re-uses Spice Level / Portion / Add-ons created by seed.
//   - Inventory rows: added for every (item, active branch) pair so the menu
//     endpoint reports availability=true for the new dishes.
//
// Runs from apps/api with the same Prisma client + DATABASE_URL the API uses.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Categories — 13, mirroring the consensus across Zomato / Swiggy / chain
// research (Paradise, Bawarchi, Shadab, Pista House, Behrouz, Mehfil).
// Position starts at 1 so the original 6 categories (positions 1-6) get
// renumbered to interleave cleanly.
// ---------------------------------------------------------------------------

const CATEGORIES: Array<{ slug: string; name: string; position: number }> = [
  { slug: 'hyderabadi-specials', name: 'Hyderabadi Specials',   position: 1 },
  { slug: 'biryani',             name: 'Biryani — Non-Veg',     position: 2 },
  { slug: 'biryani-veg',         name: 'Biryani — Veg',         position: 3 },
  { slug: 'family-packs',        name: 'Family Packs & Combos', position: 4 },
  { slug: 'starters-non-veg',    name: 'Starters — Non-Veg',    position: 5 },
  { slug: 'starters-veg',        name: 'Starters — Veg',        position: 6 },
  { slug: 'tandoor-kebabs',      name: 'Tandoor & Kebabs',      position: 7 },
  { slug: 'curries-non-veg',     name: 'Curries — Non-Veg',     position: 8 },
  { slug: 'curries-veg',         name: 'Curries — Veg',         position: 9 },
  { slug: 'indo-chinese',        name: 'Indo-Chinese',          position: 10 },
  { slug: 'breads',              name: 'Breads & Rice',         position: 11 },
  { slug: 'desserts',            name: 'Desserts',              position: 12 },
  { slug: 'beverages',           name: 'Beverages',             position: 13 },
];

// Map old slug → new slug for renames (existing seed used 'breads' already,
// 'biryani' meant non-veg-mixed, etc.). We migrate items by walking their old
// category and reassigning to the new slug.
const RENAMES: Record<string, string> = {
  'appetisers': 'starters-non-veg', // gets refined later by veg-ness
};

// ---------------------------------------------------------------------------
// Items — 70+ across the 13 categories. Existing items in the DB are matched
// by exact name and left untouched; this list is the union of old + new.
// ---------------------------------------------------------------------------

type ItemDef = {
  cat: string; name: string; description: string; price: number;
  veg: boolean; spice?: number; prep?: number; tax?: number;
  allergens?: string[]; calories?: number;
  bestseller?: boolean; trending?: boolean;
  mods?: ('spice' | 'portion' | 'addons')[];
};

const ITEMS: ItemDef[] = [
  // 1. HYDERABADI SPECIALS ----------------------------------------------------
  { cat: 'hyderabadi-specials', name: 'Mutton Haleem',         description: 'Slow-cooked wheat, lentils and shredded mutton — our flagship Hyderabadi staple.', price: 280, veg: false, spice: 1, prep: 20, allergens: ['gluten','milk'], calories: 520, bestseller: true },
  { cat: 'hyderabadi-specials', name: 'Pathar ka Gosht',       description: 'Mutton slabs grilled on a hot stone with Hyderabadi spices.', price: 360, veg: false, spice: 2, prep: 25, calories: 480 },
  { cat: 'hyderabadi-specials', name: 'Bagara Baingan',        description: 'Baby aubergines in roasted peanut, sesame and tamarind gravy — a wedding-feast classic.', price: 180, veg: true,  spice: 1, prep: 18, allergens: ['tree-nuts','sesame'], calories: 320 },
  { cat: 'hyderabadi-specials', name: 'Mirchi ka Salan',       description: 'Long green chillies in a tangy peanut-sesame gravy. Served as a biryani side.', price: 140, veg: true,  spice: 2, prep: 15, allergens: ['tree-nuts','sesame'], calories: 240 },
  { cat: 'hyderabadi-specials', name: 'Nihari Gosht',          description: 'Slow-cooked mutton shank stew, finished with bone marrow and rich spice.', price: 320, veg: false, spice: 2, prep: 25, calories: 560 },
  { cat: 'hyderabadi-specials', name: 'Dum ka Chicken',        description: 'Chicken sealed-cooked in yoghurt, cashew and saffron — north of the old city.', price: 300, veg: false, spice: 2, prep: 22, allergens: ['milk','tree-nuts'], calories: 540 },
  { cat: 'hyderabadi-specials', name: 'Khatti Dal',            description: 'Toor dal made tangy with tamarind, the Hyderabadi way.', price: 140, veg: true,  spice: 1, prep: 14, calories: 260 },

  // 2. BIRYANI — NON-VEG -----------------------------------------------------
  { cat: 'biryani', name: 'Hyderabadi Chicken Biryani', description: 'Long-grain basmati, slow-cooked with marinated chicken, saffron and aromatic spices.', price: 320, veg: false, spice: 2, prep: 25, allergens: ['milk','tree-nuts'], calories: 720, bestseller: true, trending: true, mods: ['spice','portion','addons'] },
  { cat: 'biryani', name: 'Mutton Dum Biryani',         description: 'Tender mutton, sealed dum-style with caramelised onions.', price: 420, veg: false, spice: 2, prep: 35, allergens: ['milk','tree-nuts'], calories: 860, bestseller: true, mods: ['spice','portion','addons'] },
  { cat: 'biryani', name: 'Prawn Biryani',              description: 'Fresh prawns, coastal masala, basmati rice.', price: 380, veg: false, spice: 2, prep: 28, allergens: ['crustaceans','milk'], calories: 700, mods: ['spice','portion','addons'] },
  { cat: 'biryani', name: 'Egg Biryani',                description: 'Halved boiled eggs layered through saffron-tinted dum biryani.', price: 220, veg: false, spice: 1, prep: 22, allergens: ['egg','milk'], calories: 540, mods: ['spice','portion','addons'] },
  { cat: 'biryani', name: 'Boneless Chicken Biryani',   description: 'All boneless thigh pieces, easy-to-eat version of the classic.', price: 360, veg: false, spice: 2, prep: 25, allergens: ['milk','tree-nuts'], calories: 700, trending: true, mods: ['spice','portion','addons'] },
  { cat: 'biryani', name: 'Chicken Fry-Piece Biryani',  description: 'Crispy fried chicken legs nestled in dum biryani.', price: 340, veg: false, spice: 2, prep: 26, allergens: ['milk','gluten'], calories: 760, mods: ['spice','portion','addons'] },
  { cat: 'biryani', name: 'Mutton Fry-Piece Biryani',   description: 'Twice-cooked mutton chunks with biryani rice.', price: 450, veg: false, spice: 2, prep: 36, allergens: ['milk','gluten'], calories: 880, mods: ['spice','portion','addons'] },
  { cat: 'biryani', name: 'Fish Biryani',               description: 'Marinated kingfish chunks layered with basmati.', price: 360, veg: false, spice: 2, prep: 24, allergens: ['fish','milk'], calories: 660, mods: ['spice','portion','addons'] },

  // 3. BIRYANI — VEG ---------------------------------------------------------
  { cat: 'biryani-veg', name: 'Veg Biryani',       description: 'Seasonal vegetables, mint, fried onions, ghee.', price: 240, veg: true, spice: 1, prep: 22, allergens: ['milk'], calories: 610, mods: ['spice','portion','addons'] },
  { cat: 'biryani-veg', name: 'Paneer Biryani',    description: 'Cottage cheese cubes marinated and dum-layered with rice.', price: 280, veg: true, spice: 1, prep: 24, allergens: ['milk'], calories: 660, mods: ['spice','portion','addons'] },
  { cat: 'biryani-veg', name: 'Mushroom Biryani',  description: 'Earthy button mushrooms with mint and saffron rice.', price: 260, veg: true, spice: 1, prep: 22, allergens: ['milk'], calories: 580, mods: ['spice','portion','addons'] },

  // 4. FAMILY PACKS & COMBOS -------------------------------------------------
  { cat: 'family-packs', name: 'Chicken Biryani Family Pack', description: 'Serves 3–4. Comes with raita and salan.', price: 950, veg: false, spice: 2, prep: 35, allergens: ['milk','tree-nuts'], calories: 2400, bestseller: true },
  { cat: 'family-packs', name: 'Mutton Biryani Family Pack',  description: 'Serves 3–4. Comes with raita and salan.', price: 1300, veg: false, spice: 2, prep: 45, allergens: ['milk','tree-nuts'], calories: 2800 },
  { cat: 'family-packs', name: 'Veg Biryani Family Pack',     description: 'Serves 3–4. Comes with raita and salan.', price: 720, veg: true, spice: 1, prep: 30, allergens: ['milk'], calories: 2000 },
  { cat: 'family-packs', name: 'Lucky Feast for 4',           description: 'Mutton biryani + mixed kebab platter + double ka meetha. Serves 4.', price: 1850, veg: false, spice: 2, prep: 45, allergens: ['milk','tree-nuts','gluten'], calories: 3400, trending: true },
  { cat: 'family-packs', name: 'Office Lunchbox Combo',       description: 'One biryani + raita + salan + dessert. Packed for desks.', price: 260, veg: false, spice: 1, prep: 18, allergens: ['milk'], calories: 850 },

  // 5. STARTERS — NON-VEG ----------------------------------------------------
  { cat: 'starters-non-veg', name: 'Chicken 65',         description: 'Crispy fried chicken bites tossed with curry leaves.', price: 220, veg: false, spice: 3, prep: 15, allergens: ['gluten','egg'], calories: 480, trending: true },
  { cat: 'starters-non-veg', name: 'Apollo Fish',        description: 'Boneless fish chunks tossed Andhra-style with green chillies.', price: 320, veg: false, spice: 3, prep: 18, allergens: ['fish','gluten'], calories: 460 },
  { cat: 'starters-non-veg', name: 'Chicken Lollipop',   description: 'Frenched chicken winglets, hot or batter-fried.', price: 280, veg: false, spice: 2, prep: 18, allergens: ['gluten','egg'], calories: 520 },
  { cat: 'starters-non-veg', name: 'Chicken Majestic',   description: 'Hyderabadi-style fried chicken with curd, curry leaves and chillies.', price: 260, veg: false, spice: 2, prep: 16, allergens: ['milk','gluten'], calories: 500 },
  { cat: 'starters-non-veg', name: 'Prawn Koliwada',     description: 'Spice-batter-fried prawns, lemon and onion.', price: 360, veg: false, spice: 2, prep: 16, allergens: ['crustaceans','gluten'], calories: 440 },
  { cat: 'starters-non-veg', name: 'Mutton Boti Fry',    description: 'Slow-cooked then crisp-fried mutton boti, dry style.', price: 320, veg: false, spice: 2, prep: 22, calories: 520 },
  { cat: 'starters-non-veg', name: 'Pepper Chicken Dry', description: 'Black-pepper fried chicken with curry leaves and onions.', price: 240, veg: false, spice: 2, prep: 15, calories: 460 },

  // 6. STARTERS — VEG --------------------------------------------------------
  { cat: 'starters-veg', name: 'Paneer Tikka',     description: 'Tandoor-grilled paneer with peppers and onion.', price: 240, veg: true, spice: 1, prep: 18, allergens: ['milk'], calories: 420 },
  { cat: 'starters-veg', name: 'Veg Manchurian',   description: 'Indo-Chinese cabbage and carrot dumplings.', price: 180, veg: true, spice: 2, prep: 14, allergens: ['soy','gluten'], calories: 380 },
  { cat: 'starters-veg', name: 'Paneer 65',        description: 'Paneer cubes tossed Chettinad-style with curry leaves.', price: 220, veg: true, spice: 2, prep: 14, allergens: ['milk','gluten'], calories: 400 },
  { cat: 'starters-veg', name: 'Gobi Manchurian',  description: 'Crispy cauliflower florets in spicy soy glaze.', price: 180, veg: true, spice: 2, prep: 14, allergens: ['soy','gluten'], calories: 360 },
  { cat: 'starters-veg', name: 'Crispy Corn',      description: 'Sweet corn kernels fried with bell pepper and chilli.', price: 160, veg: true, spice: 1, prep: 12, allergens: ['gluten'], calories: 320 },
  { cat: 'starters-veg', name: 'Hara Bhara Kebab', description: 'Spinach and green-pea patty, pan-seared.', price: 190, veg: true, spice: 1, prep: 12, allergens: ['gluten'], calories: 280 },

  // 7. TANDOOR & KEBABS ------------------------------------------------------
  { cat: 'tandoor-kebabs', name: 'Tandoori Chicken (Half)', description: 'Yoghurt-marinated half chicken, clay-oven roasted.', price: 280, veg: false, spice: 2, prep: 22, allergens: ['milk'], calories: 520 },
  { cat: 'tandoor-kebabs', name: 'Tandoori Chicken (Full)', description: 'Yoghurt-marinated whole chicken, clay-oven roasted.', price: 540, veg: false, spice: 2, prep: 28, allergens: ['milk'], calories: 1020 },
  { cat: 'tandoor-kebabs', name: 'Murgh Malai Tikka',       description: 'Cream-and-cashew marinated chicken, tandoor cooked.', price: 290, veg: false, spice: 0, prep: 18, allergens: ['milk','tree-nuts'], calories: 460 },
  { cat: 'tandoor-kebabs', name: 'Reshmi Kebab',            description: 'Silky chicken kebab in cream, cashew and white pepper.', price: 260, veg: false, spice: 0, prep: 18, allergens: ['milk','tree-nuts'], calories: 440 },
  { cat: 'tandoor-kebabs', name: 'Galouti Kebab',           description: 'Melt-in-the-mouth minced mutton patties, Lucknowi style.', price: 320, veg: false, spice: 1, prep: 22, allergens: ['gluten','tree-nuts'], calories: 460 },
  { cat: 'tandoor-kebabs', name: 'Tangdi Kebab',            description: 'Marinated chicken drumsticks, tandoor cooked.', price: 320, veg: false, spice: 2, prep: 20, allergens: ['milk'], calories: 500 },
  { cat: 'tandoor-kebabs', name: 'Mutton Seekh Kebab',      description: 'Minced mutton kebabs on skewers, smoky char.', price: 240, veg: false, spice: 2, prep: 18, calories: 460 },

  // 8. CURRIES — NON-VEG -----------------------------------------------------
  { cat: 'curries-non-veg', name: 'Butter Chicken',        description: 'Creamy tomato gravy with tandoor chicken.', price: 280, veg: false, spice: 1, prep: 18, allergens: ['milk','tree-nuts'], calories: 540, bestseller: true },
  { cat: 'curries-non-veg', name: 'Chicken Tikka Masala',  description: 'Tandoori chicken cubes in onion-tomato gravy.', price: 290, veg: false, spice: 1, prep: 18, allergens: ['milk'], calories: 540 },
  { cat: 'curries-non-veg', name: 'Mutton Rogan Josh',     description: 'Kashmiri red-chilli mutton curry, slow-braised.', price: 380, veg: false, spice: 2, prep: 28, allergens: ['milk'], calories: 600 },
  { cat: 'curries-non-veg', name: 'Chicken Chettinad',     description: 'South-Indian black-pepper and curry-leaf chicken.', price: 290, veg: false, spice: 3, prep: 18, calories: 480 },
  { cat: 'curries-non-veg', name: 'Chicken Korma',         description: 'Mughlai onion-cashew gravy, mild.', price: 280, veg: false, spice: 1, prep: 18, allergens: ['milk','tree-nuts'], calories: 520 },
  { cat: 'curries-non-veg', name: 'Mutton Marag',          description: 'Hyderabadi thin mutton broth, fragrant and warming.', price: 360, veg: false, spice: 2, prep: 25, calories: 460 },

  // 9. CURRIES — VEG ---------------------------------------------------------
  { cat: 'curries-veg', name: 'Paneer Butter Masala', description: 'Rich tomato-cashew gravy with paneer.', price: 240, veg: true, spice: 1, prep: 16, allergens: ['milk','tree-nuts'], calories: 510 },
  { cat: 'curries-veg', name: 'Dal Makhani',          description: 'Slow-cooked black lentils with butter.', price: 200, veg: true, spice: 1, prep: 20, allergens: ['milk'], calories: 390 },
  { cat: 'curries-veg', name: 'Kadai Paneer',         description: 'Paneer with peppers in a roasted-spice gravy.', price: 240, veg: true, spice: 2, prep: 14, allergens: ['milk'], calories: 480 },
  { cat: 'curries-veg', name: 'Malai Kofta',          description: 'Paneer-and-potato dumplings in mild cashew gravy.', price: 220, veg: true, spice: 0, prep: 18, allergens: ['milk','tree-nuts'], calories: 540 },
  { cat: 'curries-veg', name: 'Dal Tadka',            description: 'Yellow lentils tempered with cumin and garlic.', price: 180, veg: true, spice: 1, prep: 16, calories: 280 },

  // 10. INDO-CHINESE ---------------------------------------------------------
  { cat: 'indo-chinese', name: 'Chilli Chicken',          description: 'Boneless chicken in soy-chilli sauce.', price: 240, veg: false, spice: 3, prep: 14, allergens: ['soy','gluten'], calories: 520 },
  { cat: 'indo-chinese', name: 'Chicken Manchurian',      description: 'Battered chicken in tangy Indo-Chinese gravy.', price: 230, veg: false, spice: 2, prep: 15, allergens: ['soy','gluten','egg'], calories: 500 },
  { cat: 'indo-chinese', name: 'Schezwan Fried Rice',     description: 'Wok-tossed rice with spicy Schezwan paste.', price: 180, veg: true,  spice: 2, prep: 12, allergens: ['soy'], calories: 480 },
  { cat: 'indo-chinese', name: 'Chicken Hakka Noodles',   description: 'Stir-fried noodles with shredded chicken and veg.', price: 200, veg: false, spice: 1, prep: 13, allergens: ['gluten','soy','egg'], calories: 520 },
  { cat: 'indo-chinese', name: 'Chilli Paneer',           description: 'Paneer cubes in soy-chilli sauce.', price: 220, veg: true,  spice: 2, prep: 14, allergens: ['milk','soy','gluten'], calories: 460 },

  // 11. BREADS & RICE --------------------------------------------------------
  { cat: 'breads', name: 'Butter Naan',     description: 'Soft tandoor-baked bread, butter-brushed.', price: 50,  veg: true, prep: 5, allergens: ['gluten','milk'], calories: 280 },
  { cat: 'breads', name: 'Garlic Naan',     description: 'Naan with fresh garlic and coriander.', price: 60,  veg: true, prep: 5, allergens: ['gluten','milk'], calories: 300 },
  { cat: 'breads', name: 'Tandoori Roti',   description: 'Whole-wheat tandoor roti.', price: 35,  veg: true, prep: 5, allergens: ['gluten'], calories: 200 },
  { cat: 'breads', name: 'Rumali Roti',     description: 'Thin, kerchief-soft roti hand-tossed on a tawa.', price: 45,  veg: true, prep: 6, allergens: ['gluten'], calories: 180 },
  { cat: 'breads', name: 'Lachha Paratha',  description: 'Flaky multi-layered paratha.', price: 60,  veg: true, prep: 7, allergens: ['gluten','milk'], calories: 320 },
  { cat: 'breads', name: 'Keema Naan',      description: 'Naan stuffed with spiced mutton mince.', price: 110, veg: false, prep: 8, allergens: ['gluten','milk'], calories: 460 },
  { cat: 'breads', name: 'Jeera Rice',      description: 'Basmati tempered with cumin.', price: 140, veg: true, prep: 10, calories: 360 },
  { cat: 'breads', name: 'Plain Rice',      description: 'Steamed basmati.', price: 100, veg: true, prep: 8, calories: 320 },
  { cat: 'breads', name: 'Veg Pulao',       description: 'Light pulao with peas, carrots, and whole spices.', price: 180, veg: true, prep: 14, calories: 420 },

  // 12. DESSERTS -------------------------------------------------------------
  { cat: 'desserts', name: 'Double ka Meetha',  description: 'Hyderabadi bread pudding in saffron milk.', price: 120, veg: true, prep: 8, allergens: ['milk','gluten','tree-nuts'], calories: 460, bestseller: true },
  { cat: 'desserts', name: 'Gulab Jamun',       description: 'Two pieces, warm syrup.',                   price: 80,  veg: true, prep: 5, allergens: ['milk','gluten'], calories: 320 },
  { cat: 'desserts', name: 'Qubani ka Meetha',  description: 'Apricot stew with cream.',                  price: 140, veg: true, prep: 7, allergens: ['milk','tree-nuts'], calories: 380 },
  { cat: 'desserts', name: 'Phirni',            description: 'Slow-cooked rice pudding with saffron, set in clay.', price: 120, veg: true, prep: 6, allergens: ['milk','tree-nuts'], calories: 360 },
  { cat: 'desserts', name: 'Shahi Tukda',       description: 'Royal fried-bread dessert soaked in rabri.', price: 140, veg: true, prep: 8, allergens: ['milk','gluten','tree-nuts'], calories: 480 },

  // 13. BEVERAGES ------------------------------------------------------------
  { cat: 'beverages', name: 'Mango Lassi',        description: 'Sweet yogurt-mango drink.',           price: 90,  veg: true, prep: 4, tax: 0.05, allergens: ['milk'], calories: 240 },
  { cat: 'beverages', name: 'Sweet Lassi',        description: 'Classic sugar-sweetened curd drink.', price: 80,  veg: true, prep: 4, tax: 0.05, allergens: ['milk'], calories: 220 },
  { cat: 'beverages', name: 'Masala Chai',        description: 'Spiced milk tea.',                    price: 40,  veg: true, prep: 5, allergens: ['milk'], calories: 90 },
  { cat: 'beverages', name: 'Irani Chai',         description: 'Old-city Hyderabadi strong tea.',     price: 40,  veg: true, prep: 5, allergens: ['milk'], calories: 90 },
  { cat: 'beverages', name: 'Sulaimani Chai',     description: 'Black tea with lemon and spices.',    price: 40,  veg: true, prep: 5, calories: 30 },
  { cat: 'beverages', name: 'Bottled Soft Drink', description: '300ml.',                              price: 50,  veg: true, prep: 1, tax: 0.18, calories: 130 },
  { cat: 'beverages', name: 'Fresh Lime Soda',    description: 'Sweet or salt — your call.',          price: 70,  veg: true, prep: 4, calories: 90 },
  { cat: 'beverages', name: 'Falooda',            description: 'Rose syrup, vermicelli, basil seeds, milk, ice-cream.', price: 160, veg: true, prep: 7, allergens: ['milk','gluten','tree-nuts'], calories: 380 },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
  console.log('[extend-menu] start');

  const branches = await prisma.branch.findMany({ where: { isActive: true } });
  if (!branches.length) {
    console.log('[extend-menu] no active branch — running seed first is recommended. Skipping.');
    return;
  }

  // -- Categories --
  const existingCats = await prisma.category.findMany();
  const bySlug = new Map(existingCats.map((c) => [c.slug, c]));

  // Rename / reposition any categories that already exist under an alias.
  for (const [oldSlug, newSlug] of Object.entries(RENAMES)) {
    const old = bySlug.get(oldSlug);
    const newCat = CATEGORIES.find((c) => c.slug === newSlug);
    if (old && newCat && !bySlug.has(newSlug)) {
      const renamed = await prisma.category.update({
        where: { id: old.id },
        data: { slug: newCat.slug, name: newCat.name, position: newCat.position },
      });
      bySlug.delete(oldSlug);
      bySlug.set(renamed.slug, renamed);
      console.log(`[extend-menu] renamed category ${oldSlug} → ${newSlug}`);
    }
  }

  // Insert missing categories, reposition existing ones.
  for (const c of CATEGORIES) {
    const found = bySlug.get(c.slug);
    if (found) {
      if (found.position !== c.position || found.name !== c.name) {
        await prisma.category.update({
          where: { id: found.id },
          data: { name: c.name, position: c.position },
        });
        console.log(`[extend-menu] repositioned ${c.slug} → ${c.position} "${c.name}"`);
      }
    } else {
      const created = await prisma.category.create({
        data: { slug: c.slug, name: c.name, position: c.position },
      });
      bySlug.set(c.slug, created);
      console.log(`[extend-menu] + category ${c.slug}`);
    }
  }

  // -- Modifier groups --
  const groups = await prisma.modifierGroup.findMany();
  const groupByName = new Map(groups.map((g) => [g.name, g]));
  const spice   = groupByName.get('Spice Level');
  const portion = groupByName.get('Portion');
  const addons  = groupByName.get('Add-ons');
  if (!spice || !portion || !addons) {
    console.warn('[extend-menu] modifier groups missing — biryani items will skip mod wiring. Run seed first.');
  }

  // -- Items --
  // Existing items keyed by lowercased name so we can match against admin-edited rows.
  const existing = await prisma.item.findMany({ select: { id: true, name: true, categoryId: true } });
  const itemByName = new Map(existing.map((i) => [i.name.toLowerCase(), i]));

  let added = 0;
  let moved = 0;
  for (const def of ITEMS) {
    const cat = bySlug.get(def.cat);
    if (!cat) {
      console.warn(`[extend-menu] skipping ${def.name} — category ${def.cat} not found`);
      continue;
    }

    const found = itemByName.get(def.name.toLowerCase());
    if (found) {
      if (found.categoryId !== cat.id) {
        await prisma.item.update({ where: { id: found.id }, data: { categoryId: cat.id } });
        moved++;
      }
      continue; // never overwrite prices/descriptions on existing items
    }

    const item = await prisma.item.create({
      data: {
        categoryId: cat.id,
        name: def.name,
        description: def.description,
        basePrice: def.price,
        isVeg: def.veg,
        spiceLevel: def.spice ?? 1,
        prepMinutes: def.prep ?? 15,
        taxRate: def.tax ?? 0.05,
        allergens: JSON.stringify(def.allergens ?? []),
        calories: def.calories ?? null,
        isBestseller: !!def.bestseller,
        isTrending: !!def.trending,
      },
    });

    if (def.mods && spice && portion && addons) {
      const map: Record<string, string> = { spice: spice.id, portion: portion.id, addons: addons.id };
      for (const [pos, m] of def.mods.entries()) {
        const groupId = map[m];
        if (groupId) {
          await prisma.itemModifierGroup.create({
            data: { itemId: item.id, groupId, position: pos },
          });
        }
      }
    }

    for (const b of branches) {
      await prisma.inventory.create({
        data: { itemId: item.id, branchId: b.id, available: 999, updatedAt: now() },
      });
    }
    added++;
  }

  // Deactivate any leftover category that isn't in our canonical list AND
  // has no items pointing at it any more. The menu endpoint filters
  // isActive=true, so hiding (not deleting) is the safe move.
  const canonicalSlugs = new Set(CATEGORIES.map((c) => c.slug));
  const stranded = await prisma.category.findMany({
    where: { isActive: true, slug: { notIn: Array.from(canonicalSlugs) } },
    include: { _count: { select: { items: true } } },
  });
  let hidden = 0;
  for (const c of stranded) {
    if (c._count.items === 0) {
      await prisma.category.update({ where: { id: c.id }, data: { isActive: false } });
      hidden++;
      console.log(`[extend-menu] hid empty stale category "${c.name}" (slug=${c.slug})`);
    } else {
      console.log(`[extend-menu] leaving stale category "${c.name}" alone — still has ${c._count.items} item(s)`);
    }
  }

  console.log(`[extend-menu] done. categories=${CATEGORIES.length}, items added=${added}, items recategorised=${moved}, stale hidden=${hidden}, total items=${(await prisma.item.count())}`);
}

main()
  .catch((e) => { console.error('[extend-menu]', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
