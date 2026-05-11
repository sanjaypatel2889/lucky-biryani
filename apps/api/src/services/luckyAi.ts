// Lucky AI — wraps Anthropic Claude when ANTHROPIC_API_KEY is set, and falls
// back to a menu-aware rule-based responder when it isn't. The fallback reads
// live menu rows so it can answer "spicy under ₹300", "veg dessert", etc. —
// not just match keywords against canned strings.

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { prisma } from '../db';

const client = config.ai.enabled ? new Anthropic({ apiKey: config.ai.anthropicKey }) : null;

export type ChatMsg = { role: 'user' | 'assistant'; content: string };

type Dish = {
  id: string;
  name: string;
  category: string;
  price: number;
  isVeg: boolean;
  spiceLevel: number; // 0-3
  prepMinutes: number;
  bestseller: boolean;
  trending: boolean;
  allergens: string[];
  calories: number | null;
  description: string;
};

async function loadMenu(): Promise<Dish[]> {
  const items = await prisma.item.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: [{ category: { position: 'asc' } }, { basePrice: 'asc' }],
  });
  return items.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category.name,
    price: i.basePrice,
    isVeg: i.isVeg,
    spiceLevel: i.spiceLevel,
    prepMinutes: i.prepMinutes,
    bestseller: i.isBestseller,
    trending: i.isTrending,
    allergens: safeJson<string[]>(i.allergens, []),
    calories: i.calories,
    description: i.description ?? '',
  }));
}

function menuAsText(dishes: Dish[]): string {
  return dishes
    .map((d) => {
      const tags: string[] = [d.isVeg ? 'veg' : 'non-veg'];
      if (d.spiceLevel >= 2) tags.push('spicy');
      if (d.bestseller) tags.push('bestseller');
      if (d.trending) tags.push('trending');
      if (d.allergens.length) tags.push(`allergens:${d.allergens.join('+')}`);
      if (d.calories) tags.push(`${d.calories}kcal`);
      return `- ${d.name} (${d.category}) ₹${d.price} · ~${d.prepMinutes}min · [${tags.join(', ')}] — ${d.description}`;
    })
    .join('\n');
}

const SYSTEM_PROMPT = (menu: string) => `You are "Lucky AI", the personal food concierge for Lucky Biryani Centre, a single-restaurant Hyderabadi biryani spot in Banjara Hills, Hyderabad, est. 1978.

Your job:
- Recommend dishes from THE MENU BELOW based on the customer's mood, dietary needs, occasion, or hunger level.
- Answer questions about allergens, spice level, prep time, price.
- Suggest combos (biryani + side + dessert) when it fits.
- Help with table bookings (party size 1-8, 30-min slots, 90-min hold).
- Gently steer customers toward the Hyderabadi Chicken Biryani or Mutton Dum Biryani — they're the bestsellers.
- If the customer asks for something not on the menu, politely say it's not on offer and suggest the closest match.

Style: warm, concise (2-4 short sentences), zero corporate jargon. Use ₹ for prices. When listing items, format as a tight bullet list, max 5 items.

THE MENU:
${menu}

Restaurant hours: 11 AM – 11 PM. Delivery radius ~6 km, free over ₹500. Coupons: FIRST50 (₹50 off first order, min ₹200), OFFPEAK10 (10% off, min ₹200), FREEDEL (free delivery, min ₹300).`;

export async function chat(history: ChatMsg[]): Promise<{ reply: string; mode: 'live' | 'fallback' }> {
  const dishes = await loadMenu();

  if (client) {
    const r = await client.messages.create({
      model: config.ai.model,
      max_tokens: 500,
      system: [
        { type: 'text', text: SYSTEM_PROMPT(menuAsText(dishes)), cache_control: { type: 'ephemeral' } },
      ] as any,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    });
    const reply = r.content
      .filter((b) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');
    return { reply, mode: 'live' };
  }

  return { reply: fallbackReply(history, dishes), mode: 'fallback' };
}

// ---------------------------------------------------------------------------
// Rule-based responder. Parses intent then queries the live menu list so
// answers reference real prices/dishes and respect filters in the user's
// message ("under 300", "spicy", "veg dessert", etc.).
// ---------------------------------------------------------------------------

type Intent = {
  raw: string;
  greeting: boolean;
  thanks: boolean;
  booking: boolean;
  coupon: boolean;
  hours: boolean;
  allergenAsk: string[];   // user asked to AVOID these
  preferVeg: boolean | null; // true=veg only, false=non-veg only, null=any
  category: string | null;   // 'biryani' | 'dessert' | 'curries' | 'breads' | 'appetisers' | 'beverages'
  maxPrice: number | null;
  minPrice: number | null;
  spicy: 'any' | 'mild' | 'spicy';
  mood: 'romantic' | 'family' | 'kids' | 'party' | 'hangover' | 'late-night' | null;
  hungerLevel: 'light' | 'heavy' | null;
  recommendAsk: boolean;     // "what's good", "recommend", "suggest"
  partySize: number | null;  // "for 4"
  priceAsk: string | null;   // dish name the user is asking the price of
};

function parseIntent(text: string): Intent {
  const t = text.toLowerCase().trim();
  const intent: Intent = {
    raw: text,
    greeting: /^(hi|hello|hey|namaste|hola|yo|sup)\b/.test(t),
    thanks: /\b(thanks|thank you|thx|ty)\b/.test(t),
    booking: /\b(book(ing)?|table|reserve|reservation|seat|dine[ -]?in)\b/.test(t),
    coupon: /\b(coupons?|discounts?|offers?|promos?|codes?|cheap(er)?|deal)\b/.test(t),
    hours: /\b(open|hours?|timings?|closed|close|when do you)\b/.test(t),
    allergenAsk: [],
    preferVeg: null,
    category: null,
    maxPrice: null,
    minPrice: null,
    spicy: 'any',
    mood: null,
    hungerLevel: null,
    recommendAsk: /\b(recommend|suggest|whats good|what's good|what should|wyd|top picks?|popular|trending|bestseller|something good)\b/.test(t) ||
                  /^(?:tell me )?(?:whats|what's|whats up|sup|hi|hello|hey)$/i.test(text.trim()),
    partySize: null,
    priceAsk: null,
  };

  // Veg / non-veg / dietary
  if (/\b(non[- ]?veg|chicken|mutton|prawn|meat|fish|eggs?|beef|lamb)\b/.test(t)) intent.preferVeg = false;
  else if (/\b(vegetarian|veggie|vegan|plant[- ]?based)\b/.test(t)) intent.preferVeg = true;
  else if (/(^|\s)veg(\s|$|,|\.)/.test(t)) intent.preferVeg = true;

  // Allergen avoidance
  for (const a of ['milk', 'dairy', 'gluten', 'wheat', 'egg', 'nut', 'tree-nut', 'soy', 'shellfish', 'crustacean']) {
    if (new RegExp(`\\b(no |without |avoid |allerg.* ?to |skip )${a}s?`).test(t) || new RegExp(`${a}s?[- ]?free`).test(t)) {
      const canonical = a === 'dairy' ? 'milk' : a === 'wheat' ? 'gluten' : a === 'nut' || a === 'tree-nut' ? 'tree-nuts' : a === 'shellfish' || a === 'crustacean' ? 'crustaceans' : a;
      if (!intent.allergenAsk.includes(canonical)) intent.allergenAsk.push(canonical);
    }
  }

  // Category (pluralised + common synonyms)
  if (/\bbiryanis?\b/.test(t)) intent.category = 'Biryani';
  else if (/\b(desserts?|sweets?|meetha|jamun|kheer|pudding|ice ?cream)\b/.test(t)) intent.category = 'Desserts';
  else if (/\b(curr(y|ies)|gravy|gravies|masala dish)\b/.test(t)) intent.category = 'Curries';
  else if (/\b(naans?|rotis?|breads?|paratha|kulcha)\b/.test(t)) intent.category = 'Breads';
  else if (/\b(starters?|appetisers?|appetizers?|tikkas?|kebabs?|crispy|tandoori|chaat)\b/.test(t)) intent.category = 'Appetisers';
  else if (/\b(drinks?|beverages?|lassi|chai|tea|cola|soft drink|juice|water)\b/.test(t)) intent.category = 'Beverages';

  // Price
  const under = t.match(/\b(under|below|less than|max|upto|up to|<=?|cheaper than|within)\s*(?:₹|rs\.?|inr)?\s*(\d{2,4})/);
  if (under) intent.maxPrice = Number(under[2]);
  const over = t.match(/\b(over|above|more than|>=?|atleast|at least)\s*(?:₹|rs\.?|inr)?\s*(\d{2,4})/);
  if (over) intent.minPrice = Number(over[2]);
  const bareRupees = !under && !over ? t.match(/(?:₹|rs\.?|inr)\s*(\d{2,4})/) : null;
  if (bareRupees) intent.maxPrice = Number(bareRupees[1]);

  // Spice
  if (/\b(spicy|hot|fire|chilli|chili|teekha|extra spicy)\b/.test(t)) intent.spicy = 'spicy';
  else if (/\b(mild|not spicy|less spicy|baby|toddler)\b/.test(t)) intent.spicy = 'mild';

  // Mood
  if (/\b(date|romantic|girlfriend|boyfriend|anniversary)\b/.test(t)) intent.mood = 'romantic';
  else if (/\b(famil(y|ies)|parents|mom|dad|children)\b/.test(t)) intent.mood = 'family';
  else if (/\b(kids?|baby|child|toddler)\b/.test(t) && intent.mood == null) intent.mood = 'kids';
  else if (/\b(party|friends|gang|squad|group)\b/.test(t)) intent.mood = 'party';
  else if (/\b(hangover|hungover|drunk|hung[ -]over)\b/.test(t)) intent.mood = 'hangover';
  else if (/\b(late night|midnight|after work)\b/.test(t)) intent.mood = 'late-night';

  // Hunger
  if (/\b(light|small|quick|snack|just a bite)\b/.test(t)) intent.hungerLevel = 'light';
  else if (/\b(heavy|big|full|stuffed|feast|hungry as|starving|famished)\b/.test(t)) intent.hungerLevel = 'heavy';

  // Party size
  const party = t.match(/\b(?:for|party of|table for|book for)\s*(\d{1,2})\b/);
  if (party) intent.partySize = Number(party[1]);

  // Price-of-X queries — covers "how much is X", "price of X", "X price", "what's the X cost"
  const priceOfA = t.match(/\b(?:price of|how much (?:does|is|are|for)|cost of|rate of|what(?:'s|s)? the price of)\s+(?:the |a |an )?(.+?)(?:\?|cost|$)/);
  const priceOfB = !priceOfA ? t.match(/\b(?:how much).*?(.+?)\s*\??$/) : null;
  if (priceOfA) intent.priceAsk = priceOfA[1].trim();
  else if (priceOfB) intent.priceAsk = priceOfB[1].trim();
  if (intent.priceAsk) {
    intent.priceAsk = intent.priceAsk.replace(/^(the|a|an)\s+/i, '').replace(/\s*\?$/, '').trim();
  }

  return intent;
}

function filterMenu(dishes: Dish[], i: Intent): Dish[] {
  return dishes.filter((d) => {
    if (i.preferVeg === true && !d.isVeg) return false;
    if (i.preferVeg === false && d.isVeg) return false;
    if (i.category && d.category !== i.category) return false;
    if (i.maxPrice != null && d.price > i.maxPrice) return false;
    if (i.minPrice != null && d.price < i.minPrice) return false;
    if (i.spicy === 'spicy' && d.spiceLevel < 2) return false;
    if (i.spicy === 'mild' && d.spiceLevel > 1) return false;
    if (i.allergenAsk.length && d.allergens.some((a) => i.allergenAsk.includes(a))) return false;
    return true;
  });
}

function formatDish(d: Dish): string {
  return `• ${d.name} — ₹${d.price}${d.isVeg ? ' 🟢' : ' 🔴'}${d.bestseller ? ' ★' : ''}`;
}

function fallbackReply(history: ChatMsg[], dishes: Dish[]): string {
  const last = history[history.length - 1]?.content ?? '';
  if (!last.trim()) {
    return "Hey! Tell me what you're in the mood for — spicy, veg, under a budget, or just say 'recommend' and I'll pick for you.";
  }
  const i = parseIntent(last);

  // Price-of-X — try a few matching strategies
  if (i.priceAsk) {
    const q = i.priceAsk.toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    const target =
      dishes.find((d) => d.name.toLowerCase() === q) ??
      dishes.find((d) => d.name.toLowerCase().includes(q)) ??
      dishes.find((d) => {
        const dn = d.name.toLowerCase();
        return words.every((w) => dn.includes(w));
      }) ??
      dishes.find((d) => {
        const dn = d.name.toLowerCase();
        return words.some((w) => w.length > 2 && dn.includes(w));
      });
    if (target) return `${target.name} is ₹${target.price} (${target.isVeg ? 'veg' : 'non-veg'}, ~${target.prepMinutes} min).`;
    return `I couldn't find "${i.priceAsk}" on our menu. Want me to suggest something similar?`;
  }

  // Hours / open
  if (i.hours) return 'We are open every day, 11 AM to 11 PM. Last delivery order goes out around 10:30 PM.';

  // Coupons
  if (i.coupon) return 'Best codes: FIRST50 (₹50 off your first order, min ₹200), OFFPEAK10 (10% off, min ₹200), FREEDEL (free delivery on ₹300+).';

  // Booking
  if (i.booking) {
    const ps = i.partySize ? ` for ${i.partySize}` : '';
    return `Tap "Book a table" in the header to reserve${ps}. We hold tables for 90 minutes; indoor, patio and family-room zones.`;
  }

  // Mood-driven canned answers (still grounded in menu)
  if (i.mood === 'hangover') {
    const pick = dishes.find((d) => d.name === 'Mutton Dum Biryani') ?? dishes.find((d) => d.name === 'Hyderabadi Chicken Biryani');
    return `Hangover cure mode: heavy on the spice and protein. Go with the ${pick?.name} (₹${pick?.price}), Mango Lassi (₹90) to cool, and a Masala Chai after.`;
  }
  if (i.mood === 'romantic') {
    return 'Order for two: Mutton Dum Biryani (₹420) family-portion if you want to share, Paneer Butter Masala (₹240), Butter Naan (₹50), finish with Qubani ka Meetha (₹140).';
  }
  if (i.mood === 'family' || i.mood === 'party') {
    return 'Family/party combo: 1× Hyderabadi Chicken Biryani (₹320, family portion is +₹180), 1× Veg Biryani (₹240), Paneer Tikka (₹240), 4× Butter Naan (₹50 each), Double ka Meetha for dessert.';
  }
  if (i.mood === 'kids') {
    return 'Kid-friendly picks (mild): Veg Biryani (₹240, ask for Mild), Butter Naan (₹50), Mango Lassi (₹90), Gulab Jamun (₹80) for after.';
  }
  if (i.mood === 'late-night') {
    return 'Quick + comforting: Chicken 65 (₹220) and a Masala Chai (₹40). Or a half-portion Chicken Biryani if you want something heavier.';
  }

  // Filtered recommendation path
  const filtered = filterMenu(dishes, i);

  if (filtered.length === 0) {
    // Be helpful even on a miss
    const why: string[] = [];
    if (i.maxPrice != null) why.push(`under ₹${i.maxPrice}`);
    if (i.preferVeg === true) why.push('veg');
    if (i.preferVeg === false) why.push('non-veg');
    if (i.spicy === 'spicy') why.push('spicy');
    if (i.category) why.push(i.category.toLowerCase());
    if (i.allergenAsk.length) why.push(`no ${i.allergenAsk.join('/')}`);
    const desc = why.length ? why.join(', ') : 'that combination';
    return `Nothing on the menu matches ${desc} right now. Try loosening one filter — or say "recommend" and I'll pick our bestsellers.`;
  }

  // Sort: bestsellers, then trending, then category priority (mains > sides),
  // then price ascending. When the user explicitly picked a category, we keep
  // bestseller/trending as the primary signal but skip the category priority.
  const catRank: Record<string, number> = {
    Biryani: 1, Curries: 2, Appetisers: 3, Desserts: 4, Breads: 5, Beverages: 6,
  };
  filtered.sort((a, b) => {
    if (a.bestseller !== b.bestseller) return a.bestseller ? -1 : 1;
    if (a.trending !== b.trending) return a.trending ? -1 : 1;
    if (!i.category) {
      const ra = catRank[a.category] ?? 99;
      const rb = catRank[b.category] ?? 99;
      if (ra !== rb) return ra - rb;
    }
    return a.price - b.price;
  });

  // If the message looks like a question/recommendation request, give the top picks.
  // Otherwise also list the top 3 — be useful by default.
  const picks = filtered.slice(0, Math.min(5, filtered.length));
  const lead = leadLine(i, picks.length);
  const list = picks.map(formatDish).join('\n');
  const tail = pairingTail(i, picks);
  return `${lead}\n${list}${tail ? `\n\n${tail}` : ''}`;
}

function leadLine(i: Intent, count: number): string {
  const bits: string[] = [];
  if (i.spicy === 'spicy') bits.push('spicy');
  else if (i.spicy === 'mild') bits.push('mild');
  if (i.preferVeg === true) bits.push('veg');
  else if (i.preferVeg === false) bits.push('non-veg');
  if (i.category) bits.push(i.category.toLowerCase());
  if (i.maxPrice != null) bits.push(`under ₹${i.maxPrice}`);
  if (i.minPrice != null) bits.push(`over ₹${i.minPrice}`);
  if (i.allergenAsk.length) bits.push(`no ${i.allergenAsk.join('/')}`);

  if (bits.length === 0) {
    if (count === 1) return "One pick that's good today:";
    return `Here are ${count} top picks today:`;
  }
  const label = bits.join(', ');
  if (count === 1) return `One match for ${label}:`;
  return `Here are ${count} picks · ${label}:`;
}

function pairingTail(i: Intent, picks: Dish[]): string {
  // If the user picked a biryani-ish flow, suggest a side + drink combo.
  if (picks.some((d) => d.category === 'Biryani')) {
    return 'Want me to add a Butter Naan (₹50) and a Mango Lassi (₹90) to round it out?';
  }
  if (i.category === 'Desserts') return '';
  if (i.greeting || i.recommendAsk) {
    return 'Tell me a budget, a spice level, or "veg/non-veg" and I will narrow it down.';
  }
  return '';
}

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
