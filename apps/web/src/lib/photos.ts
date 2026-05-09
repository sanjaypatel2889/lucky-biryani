// Curated stock photo URLs (Unsplash, royalty-free) — keyed by item name or
// category. In production, replace with a real photo shoot uploaded to S3/R2
// (doc §10.2). The Item.imageUrl column is already wired to render whatever
// you put there.

const u = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

// Hero / marketing
export const HERO = u('photo-1631452180519-c014fe946bc7', 1800);
export const STORY = u('photo-1601050690597-df0568f70950', 1400);
export const SPICES = u('photo-1596797038530-2c107229654b', 1200);
export const TANDOOR = u('photo-1565557623262-b51c2513a641', 1200);
export const RESTAURANT = u('photo-1517248135467-4c7edcad34c4', 1600);

// Per-item or per-category photos (deterministic, no flicker)
const ITEM_PHOTOS: Record<string, string> = {
  'Hyderabadi Chicken Biryani': u('photo-1631452180519-c014fe946bc7'),
  'Mutton Dum Biryani':         u('photo-1633945274405-b6c8069047b0'),
  'Veg Biryani':                u('photo-1589302168068-964664d93dc0'),
  'Prawn Biryani':              u('photo-1604908176997-125f25cc6f3d'),
  'Chicken 65':                 u('photo-1626777553635-3e4c0e29ab8d'),
  'Paneer Tikka':               u('photo-1567188040759-fb8a883dc6d8'),
  'Veg Manchurian':             u('photo-1626804475297-41608ea09aeb'),
  'Butter Chicken':             u('photo-1603894584373-5ac82b2ae398'),
  'Paneer Butter Masala':       u('photo-1631452180775-d9a91a44e6f4'),
  'Dal Makhani':                u('photo-1626777553635-3e4c0e29ab8d'),
  'Butter Naan':                u('photo-1601050690597-df0568f70950'),
  'Garlic Naan':                u('photo-1626501280073-3a87b7c2e7e7'),
  'Tandoori Roti':              u('photo-1565557623262-b51c2513a641'),
  'Double ka Meetha':           u('photo-1565557623262-b51c2513a641'),
  'Gulab Jamun':                u('photo-1601050690597-df0568f70950'),
  'Qubani ka Meetha':           u('photo-1551024601-bec78aea704b'),
  'Mango Lassi':                u('photo-1571805341302-f857702a8568'),
  'Masala Chai':                u('photo-1576092768241-dec231879fc3'),
  'Bottled Soft Drink':         u('photo-1622483767028-3f66f32aef97'),
};

const CATEGORY_PHOTOS: Record<string, string> = {
  Biryani:    u('photo-1631452180519-c014fe946bc7'),
  Appetisers: u('photo-1626777553635-3e4c0e29ab8d'),
  Curries:    u('photo-1603894584373-5ac82b2ae398'),
  Breads:     u('photo-1601050690597-df0568f70950'),
  Desserts:   u('photo-1551024601-bec78aea704b'),
  Beverages:  u('photo-1571805341302-f857702a8568'),
};

export function dishPhoto(name: string, category?: string, fallback?: string | null) {
  return fallback || ITEM_PHOTOS[name] || (category && CATEGORY_PHOTOS[category]) || HERO;
}
