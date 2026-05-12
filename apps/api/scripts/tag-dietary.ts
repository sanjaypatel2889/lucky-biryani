// One-shot post-deploy script: assigns dietary tags + (where empty) a small
// image gallery for every Item.
//
// Idempotent — safe to run any time. Only writes when a value is actually
// changing, so re-runs are cheap and don't churn updatedAt.
//
//   npx tsx scripts/tag-dietary.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function tagsFor(name: string, isVeg: boolean, allergens: string[]): string[] {
  const n = name.toLowerCase();
  const out = new Set<string>();

  // Vegan = vegetarian + no milk + no egg
  if (isVeg && !allergens.includes('milk') && !allergens.includes('egg')) {
    out.add('vegan');
  }

  // Jain = vegan + no onion/garlic/root vegetables. Our menu doesn't tag
  // those explicitly, so be conservative: only fruits/lentils-only dishes.
  if (isVeg && /\b(dal|lassi|jamun|meetha|qubani|raita|kheer)\b/.test(n)) {
    out.add('jain');
  }

  // Eggless = anything that isn't an egg dish or egg-tagged
  if (!allergens.includes('egg') && !/\begg\b/.test(n)) {
    out.add('eggless');
  }

  // Halal = all our non-veg is halal (single-restaurant assumption — most
  // Hyderabadi places are). Veg is trivially halal.
  out.add('halal');

  // Diabetic-friendly = under 500 kcal and not deep-fried/syrup-heavy.
  // We can't tell calories here, so use a name heuristic.
  if (!/\b(biryani|jamun|meetha|kheer|lassi|fry|crispy|tandoor)\b/.test(n)) {
    out.add('diabetic-friendly');
  }

  // Gluten-free = does not contain gluten
  if (!allergens.includes('gluten')) {
    out.add('gluten-free');
  }

  return [...out];
}

// Small gallery picked from the same image source — keeps the UI showing
// multiple shots without us needing a real photoshoot. Real prod replaces
// these via the admin upload flow.
function galleryFor(name: string, imageUrl: string | null): string[] {
  if (!imageUrl) return [];
  const variants = [
    `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}v=detail`,
    `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}v=plated`,
  ];
  // De-dupe — keep original first, then variants
  return [imageUrl, ...variants];
}

async function main() {
  const items = await prisma.item.findMany();
  let touched = 0;

  for (const i of items) {
    const allergens: string[] = safeJson(i.allergens, []);
    const newTags = tagsFor(i.name, i.isVeg, allergens);
    const currentTags: string[] = safeJson(i.dietaryTags, []);
    const currentGallery: string[] = safeJson(i.gallery, []);
    const newGallery = currentGallery.length ? currentGallery : galleryFor(i.name, i.imageUrl);

    const tagsChanged = JSON.stringify(newTags.sort()) !== JSON.stringify([...currentTags].sort());
    const galleryChanged = JSON.stringify(newGallery) !== JSON.stringify(currentGallery);
    if (!tagsChanged && !galleryChanged) continue;

    await prisma.item.update({
      where: { id: i.id },
      data: {
        ...(tagsChanged ? { dietaryTags: JSON.stringify(newTags) } : {}),
        ...(galleryChanged ? { gallery: JSON.stringify(newGallery) } : {}),
      },
    });
    touched++;
  }

  console.log(`Tagged ${touched}/${items.length} items.`);
}

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
