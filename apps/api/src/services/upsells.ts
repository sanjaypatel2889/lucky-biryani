// Cart upsells — given the current cart, pick 3 dishes that pair well.
//
// Heuristic, not ML: biryani in cart → suggest bread + raita-side + lassi.
// No bread in cart → suggest a Butter Naan. No dessert → suggest a Gulab
// Jamun. Filters anything already in the cart so we don't double-recommend.

import { prisma } from '../db';

type SuggestedItem = {
  id: string;
  name: string;
  basePrice: number;
  imageUrl: string | null;
  categoryName: string;
  reason: string;
};

export async function suggestUpsells(currentItemIds: string[]): Promise<SuggestedItem[]> {
  const inCart = new Set(currentItemIds);
  if (currentItemIds.length === 0) return [];

  const cartItems = await prisma.item.findMany({
    where: { id: { in: currentItemIds } },
    include: { category: true },
  });
  const cartCats = new Set(cartItems.map((i) => i.category.name.toLowerCase()));
  const hasBiryani = [...cartCats].some((c) => c.includes('biryani'));
  const hasBread = [...cartCats].some((c) => c.includes('bread') || c.includes('breads'));
  const hasDessert = [...cartCats].some((c) => c.includes('dessert'));
  const hasDrink = [...cartCats].some((c) => c.includes('beverage') || c.includes('drink'));

  // Candidate pool: bestsellers + trending across complementary categories
  const candidates = await prisma.item.findMany({
    where: {
      isActive: true,
      id: { notIn: currentItemIds },
      OR: [{ isBestseller: true }, { isTrending: true }],
    },
    include: { category: true },
    take: 30,
  });

  const picks: SuggestedItem[] = [];

  // Rule 1: biryani → suggest a bread + a lassi (if not already in cart)
  if (hasBiryani) {
    if (!hasBread) {
      const bread = candidates.find((i) => /bread/i.test(i.category.name));
      if (bread) picks.push(toSuggested(bread, 'Pairs perfectly with biryani'));
    }
    if (!hasDrink) {
      const lassi = candidates.find((i) => /lassi|chai|mango/i.test(i.name));
      if (lassi) picks.push(toSuggested(lassi, 'Cools the spice'));
    }
  }

  // Rule 2: no dessert in cart → suggest the most-loved dessert
  if (!hasDessert) {
    const sweet = candidates.find((i) => /dessert/i.test(i.category.name));
    if (sweet) picks.push(toSuggested(sweet, 'Finish on something sweet'));
  }

  // Rule 3: no drink in cart → suggest a drink
  if (!hasDrink && !picks.some((p) => /lassi|chai/i.test(p.name))) {
    const drink = candidates.find((i) => /beverage|drink/i.test(i.category.name));
    if (drink) picks.push(toSuggested(drink, 'Round it off with a drink'));
  }

  // Pad with bestsellers if we still don't have 3
  for (const c of candidates) {
    if (picks.length >= 3) break;
    if (picks.find((p) => p.id === c.id)) continue;
    if (inCart.has(c.id)) continue;
    picks.push(toSuggested(c, c.isBestseller ? 'Bestseller' : 'Trending'));
  }

  return picks.slice(0, 3);
}

function toSuggested(i: any, reason: string): SuggestedItem {
  return {
    id: i.id,
    name: i.name,
    basePrice: i.basePrice,
    imageUrl: i.imageUrl,
    categoryName: i.category.name,
    reason,
  };
}
