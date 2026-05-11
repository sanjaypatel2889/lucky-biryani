// Curated stock photo URLs. Mix of:
//   - TheMealDB (long-stable food image CDN, no key)
//   - Foodish API (random food images per category, no key)
//   - Unsplash for hero / marketing shots (verified live)
//
// Every consumer renders through <DishImage>, which falls back to a CSS
// gradient + emoji placeholder if any of these go 404. So even if a CDN
// dies tomorrow, no card ever renders blank.
//
// To replace any of these with a real photoshoot:
//   1. Upload your image to S3 / R2
//   2. Set Item.imageUrl in the admin/menu panel
//   3. dishPhoto() prefers that field over this table

const ms = (id: string) =>
  `https://www.themealdb.com/images/media/meals/${id}.jpg`;
const food = (cat: string, n: number) =>
  `https://foodish-api.com/images/${cat}/${cat}${n}.jpg`;
const us = (id: string, w = 1400) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

// Hero / marketing — single URL verified live at the time of writing.
// If these die, the home page hero falls back to the brand gradient via CSS.
export const HERO       = us('photo-1633945274405-b6c8069047b0', 1800);
export const STORY      = us('photo-1599043513900-ed6fe01d3833', 1400);
export const SPICES     = us('photo-1532336414038-cf19250c5757', 1200);
export const TANDOOR    = us('photo-1631452180519-c014fe946bc7', 1200);
export const RESTAURANT = us('photo-1592861956120-e524fc739696', 1600);

// Per-dish photo. We lean on TheMealDB for known Indian dishes (these URLs
// have been stable for years) and Foodish for a couple of categories.
const ITEM_PHOTOS: Record<string, string> = {
  'Hyderabadi Chicken Biryani': ms('xrttsx1487339558'),       // Chicken Biryani
  'Mutton Dum Biryani':         food('biryani', 2),
  'Veg Biryani':                food('biryani', 4),
  'Prawn Biryani':              food('biryani', 5),

  'Chicken 65':                 ms('qptpvt1487339892'),       // Tandoori Chicken
  'Paneer Tikka':               food('butter-chicken', 3),    // similar tandoor look
  'Veg Manchurian':             food('rice', 2),

  'Butter Chicken':             food('butter-chicken', 1),
  'Paneer Butter Masala':       food('butter-chicken', 4),
  'Dal Makhani':                food('butter-chicken', 5),

  'Butter Naan':                food('butter-chicken', 2),
  'Garlic Naan':                food('butter-chicken', 3),
  'Tandoori Roti':              food('butter-chicken', 5),

  // For these we rely on the placeholder — TheMealDB/Foodish don't have great
  // matches and the gradient + emoji looks intentional.
  'Double ka Meetha':           '',
  'Gulab Jamun':                '',
  'Qubani ka Meetha':           '',

  'Mango Lassi':                '',
  'Masala Chai':                '',
  'Bottled Soft Drink':         '',
};

const CATEGORY_PHOTOS: Record<string, string> = {
  Biryani:    food('biryani', 1),
  Appetisers: food('butter-chicken', 3),
  Curries:    food('butter-chicken', 1),
  Breads:     food('butter-chicken', 2),
  Desserts:   '',
  Beverages:  '',
};

export function dishPhoto(name: string, category?: string, fallback?: string | null) {
  if (fallback) return fallback;
  const direct = ITEM_PHOTOS[name];
  if (direct) return direct;
  if (category) {
    const c = CATEGORY_PHOTOS[category];
    if (c) return c;
  }
  return ''; // empty string triggers the <DishImage> gradient placeholder
}
