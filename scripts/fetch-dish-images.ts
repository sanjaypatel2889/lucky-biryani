// One-time script. Looks up each dish on TheMealDB (free public food DB) and
// emits a JSON map { dishName: imageUrl }. Falls back to Foodish API category
// images when TheMealDB has no match, and to '' when neither does.
//
//   npx tsx scripts/fetch-dish-images.ts
//
// Output: apps/web/src/lib/dish-images.json

import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';

const prisma = new PrismaClient();

// Hand-picked TheMealDB search queries for each of our dishes. The MealDB
// search API does fuzzy matching, so the query just needs to be close enough
// to a real meal name.
const SEARCH_QUERIES: Record<string, string> = {
  // Biryani — Non-Veg
  'Hyderabadi Chicken Biryani': 'Chicken Biryani',
  'Mutton Dum Biryani':         'Lamb Biryani',
  'Prawn Biryani':              'Prawn Biryani',
  'Egg Biryani':                'Egg Biryani',
  'Boneless Chicken Biryani':   'Chicken Biryani',
  'Chicken Fry-Piece Biryani':  'Chicken Biryani',
  'Mutton Fry-Piece Biryani':   'Lamb Biryani',
  'Fish Biryani':               'Fish Biryani',

  // Biryani — Veg
  'Veg Biryani':                'Vegetable Biryani',
  'Paneer Biryani':             'Vegetable Biryani',
  'Mushroom Biryani':           'Mushroom Biryani',

  // Family Packs
  'Chicken Biryani Family Pack': 'Chicken Biryani',
  'Mutton Biryani Family Pack':  'Lamb Biryani',
  'Veg Biryani Family Pack':     'Vegetable Biryani',
  'Lucky Feast for 4':           'Chicken Biryani',
  'Office Lunchbox Combo':       'Chicken Biryani',

  // Hyderabadi Specials
  'Mutton Haleem':              'Haleem',
  'Pathar ka Gosht':            'Lamb',
  'Bagara Baingan':             'Aubergine',
  'Mirchi ka Salan':            'Korma',
  'Nihari Gosht':               'Beef Nihari',
  'Dum ka Chicken':             'Chicken Karaage',
  'Khatti Dal':                 'Dal Tadka',

  // Starters — Non-Veg
  'Chicken 65':                 'Chicken Karaage',
  'Apollo Fish':                'Fish Stew',
  'Chicken Lollipop':           'Chicken Lollipop',
  'Chicken Majestic':           'Chicken Karaage',
  'Prawn Koliwada':             'Prawn',
  'Mutton Boti Fry':            'Lamb',
  'Pepper Chicken Dry':         'Pepper Chicken',

  // Starters — Veg
  'Paneer Tikka':               'Paneer Tikka',
  'Veg Manchurian':             'Vegetable Stew',
  'Paneer 65':                  'Paneer Tikka',
  'Gobi Manchurian':            'Cauliflower',
  'Crispy Corn':                'Corn',
  'Hara Bhara Kebab':           'Vegetable Kebab',

  // Tandoor & Kebabs
  'Tandoori Chicken (Half)':    'Tandoori Chicken',
  'Tandoori Chicken (Full)':    'Tandoori Chicken',
  'Murgh Malai Tikka':          'Tandoori Chicken',
  'Reshmi Kebab':               'Tandoori Chicken',
  'Galouti Kebab':              'Kibbeh',
  'Tangdi Kebab':               'Tandoori Chicken',
  'Mutton Seekh Kebab':         'Lamb Kebab',

  // Curries — Non-Veg
  'Butter Chicken':             'Butter Chicken',
  'Chicken Tikka Masala':       'Chicken Tikka Masala',
  'Mutton Rogan Josh':          'Rogan Josh',
  'Chicken Chettinad':          'Chicken Chettinad',
  'Chicken Korma':              'Chicken Korma',
  'Mutton Marag':               'Lamb Stew',

  // Curries — Veg
  'Paneer Butter Masala':       'Paneer',
  'Dal Makhani':                'Dal Fry',
  'Kadai Paneer':               'Paneer',
  'Malai Kofta':                'Kofta',
  'Dal Tadka':                  'Dal Tadka',

  // Indo-Chinese
  'Chilli Chicken':             'Sweet and Sour Chicken',
  'Chicken Manchurian':         'Sweet and Sour Chicken',
  'Schezwan Fried Rice':        'Fried Rice',
  'Chicken Hakka Noodles':      'Stir Fry Noodles',
  'Chilli Paneer':              'Paneer',

  // Breads & Rice
  'Butter Naan':                'Naan',
  'Garlic Naan':                'Naan',
  'Tandoori Roti':              'Roti',
  'Rumali Roti':                'Roti',
  'Lachha Paratha':             'Paratha',
  'Keema Naan':                 'Naan',
  'Jeera Rice':                 'Pilau',
  'Plain Rice':                 'Rice',
  'Veg Pulao':                  'Vegetable Pilau',

  // Desserts
  'Double ka Meetha':           'Bread Pudding',
  'Gulab Jamun':                'Gulab Jamun',
  'Qubani ka Meetha':           'Apricot',
  'Phirni':                     'Rice Pudding',
  'Shahi Tukda':                'Bread Pudding',

  // Beverages
  'Mango Lassi':                'Mango Lassi',
  'Sweet Lassi':                'Mango Lassi',
  'Masala Chai':                'Masala Chai',
  'Irani Chai':                 'Chai',
  'Sulaimani Chai':             'Chai',
  'Bottled Soft Drink':         'Soft Drink',
  'Fresh Lime Soda':            'Lemonade',
  'Falooda':                    'Falooda',
};

// Category fallback — Foodish has these working pools (verified earlier).
const FOODISH_CATEGORIES: Record<string, string> = {
  Biryani: 'biryani',
  'Biryani — Non-Veg': 'biryani',
  'Biryani — Veg': 'biryani',
  'Family Packs & Combos': 'biryani',
  'Hyderabadi Specials': 'butter-chicken',
  'Starters — Non-Veg': 'butter-chicken',
  'Starters — Veg': 'butter-chicken',
  'Tandoor & Kebabs': 'butter-chicken',
  'Curries — Non-Veg': 'butter-chicken',
  'Curries — Veg': 'butter-chicken',
  'Indo-Chinese': 'rice',
  'Breads & Rice': 'butter-chicken',
  'Desserts': 'dessert',
};

// Hand-curated overrides for dishes that need a specific, verified-live image
// (e.g. beverages, where neither TheMealDB nor Foodish has a great pool).
const MANUAL_OVERRIDES: Record<string, string> = {
  'Mango Lassi':         'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&w=1200&q=80',
  'Sweet Lassi':         'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&w=1200&q=80',
  'Masala Chai':         'https://images.unsplash.com/photo-1593560704563-f176a2eb61db?auto=format&fit=crop&w=1200&q=80',
  'Irani Chai':          'https://images.unsplash.com/photo-1546039907-7fa05f864c02?auto=format&fit=crop&w=1200&q=80',
  'Sulaimani Chai':      'https://images.unsplash.com/photo-1599639957043-f3aa5c986398?auto=format&fit=crop&w=1200&q=80',
  'Bottled Soft Drink':  'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?auto=format&fit=crop&w=1200&q=80',
  'Fresh Lime Soda':     'https://images.unsplash.com/photo-1605196560547-b2f7281b7355?auto=format&fit=crop&w=1200&q=80',
  'Falooda':             'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=1200&q=80',
};

async function searchMealDb(query: string): Promise<string | null> {
  try {
    const r = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`);
    if (!r.ok) return null;
    const j: any = await r.json();
    const meal = j.meals?.[0];
    return meal?.strMealThumb ?? null;
  } catch {
    return null;
  }
}

async function verifyUrl(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok;
  } catch {
    return false;
  }
}

function foodishUrlForCategory(cat: string, seed: number): string | null {
  const f = FOODISH_CATEGORIES[cat];
  if (!f) return null;
  // Foodish has 5 images per category. Pick deterministic by hash.
  return `https://foodish-api.com/images/${f}/${f}${(seed % 5) + 1}.jpg`;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function main() {
  const dishes = await prisma.item.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: { name: 'asc' },
  });

  const out: Record<string, { url: string; source: 'mealdb' | 'foodish' | 'none' }> = {};

  let viaMealDb = 0;
  let viaFoodish = 0;
  let missed = 0;

  let viaManual = 0;
  for (const d of dishes) {
    let url: string | null = null;
    let source: 'mealdb' | 'foodish' | 'manual' | 'none' = 'none';

    // 1. Manual override (highest priority — hand-curated for specific dishes)
    if (MANUAL_OVERRIDES[d.name]) {
      url = MANUAL_OVERRIDES[d.name];
      source = 'manual';
      viaManual++;
    }

    // 2. TheMealDB lookup
    if (!url) {
      const query = SEARCH_QUERIES[d.name];
      if (query) {
        const found = await searchMealDb(query);
        if (found && (await verifyUrl(found))) {
          url = found;
          source = 'mealdb';
          viaMealDb++;
        }
      }
    }

    // 3. Foodish category fallback
    if (!url) {
      const fb = foodishUrlForCategory(d.category.name, hashStr(d.name));
      if (fb && (await verifyUrl(fb))) {
        url = fb;
        source = 'foodish';
        viaFoodish++;
      }
    }

    if (!url) {
      missed++;
      out[d.name] = { url: '', source: 'none' };
      console.log(`  ✗ ${d.name} — no image (placeholder will render)`);
    } else {
      out[d.name] = { url, source };
      console.log(`  ✓ ${d.name} — ${source}`);
    }
  }
  console.log(`  manual=${viaManual}`);

  // Write the mapping
  const target = path.join(__dirname, '..', 'apps', 'web', 'src', 'lib', 'dish-images.json');
  fs.writeFileSync(target, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${Object.keys(out).length} entries → ${target}`);
  console.log(`  mealdb=${viaMealDb}  foodish=${viaFoodish}  none=${missed}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
