// Lucky AI — wraps Anthropic Claude when ANTHROPIC_API_KEY is set, and falls
// back to a menu-aware rule-based responder when it isn't. The fallback reads
// live menu rows so it can answer "spicy under ₹300", "veg dessert", etc. —
// not just match keywords against canned strings.

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { prisma } from '../db';
import {
  TEXT_SYSTEM_PROMPT,
  VOICE_SYSTEM_PROMPT,
  pickExamples,
  SCRIPTED_EXAMPLES,
} from './luckyAi-script';

const client = config.ai.enabled ? new Anthropic({ apiKey: config.ai.anthropicKey }) : null;

export type ChatMsg = { role: 'user' | 'assistant'; content: string };
export type ChatMode = 'text' | 'voice';

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

export async function chat(
  history: ChatMsg[],
  mode: ChatMode = 'text',
): Promise<{ reply: string; mode: 'live' | 'fallback' }> {
  const dishes = await loadMenu();
  const menu = menuAsText(dishes);
  const systemPrompt = mode === 'voice' ? VOICE_SYSTEM_PROMPT(menu) : TEXT_SYSTEM_PROMPT(menu);
  const lastUser = [...history].reverse().find((m) => m.role === 'user')?.content ?? '';

  if (client) {
    // Prepend a small set of relevant scripted examples as past turns so the
    // model anchors on the right tone (especially in voice mode).
    const examples = pickExamples(lastUser, mode, 6);
    const seeded: ChatMsg[] = [];
    for (const ex of examples) {
      seeded.push({ role: 'user', content: ex.user });
      seeded.push({ role: 'assistant', content: mode === 'voice' ? ex.assistantVoice : ex.assistantText });
    }

    const r = await client.messages.create({
      model: config.ai.model,
      max_tokens: mode === 'voice' ? 200 : 500,
      system: [
        { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
      ] as any,
      messages: [...seeded, ...history].map((m) => ({ role: m.role, content: m.content })),
    });
    let reply = r.content
      .filter((b) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');
    if (mode === 'voice') reply = sanitizeForVoice(reply);
    return { reply, mode: 'live' };
  }

  // Fallback path — menu-aware responder first (handles veg/spice/price/etc),
  // scripted greeting/thanks reply only when there's no menu intent.
  let reply = fallbackReply(history, dishes);
  if (mode === 'voice') reply = sanitizeForVoice(reply);
  return { reply, mode: 'fallback' };
}

// Word-boundary scripted match used by the menu-aware fallback when the
// message is pure small-talk and has no menu intent. Strict thresholds so
// "I want chicken" doesn't match "hi".
function matchScriptedExample(userText: string, mode: ChatMode, allowedIntents?: Set<string>): string | null {
  if (!userText) return null;
  const t = userText.toLowerCase().trim();
  let best: { score: number; reply: string } | null = null;
  for (const ex of SCRIPTED_EXAMPLES) {
    if (allowedIntents && !allowedIntents.has(ex.intent)) continue;
    const eu = ex.user.toLowerCase().trim();
    let score = 0;
    if (t === eu) score = 100;
    else {
      // Word-boundary check on the example utterance as a whole phrase.
      const phraseRe = new RegExp(`(?:^|\\W)${escapeRegex(eu)}(?:\\W|$)`);
      if (phraseRe.test(t)) score = 80;
      else {
        const words = eu.split(/\s+/).filter((w) => w.length > 2);
        if (words.length === 0) continue;
        const matched = words.filter((w) => new RegExp(`\\b${escapeRegex(w)}\\b`).test(t)).length;
        score = (matched / words.length) * 60; // fractional match
      }
    }
    if (score >= 70 && (!best || score > best.score)) {
      best = { score, reply: mode === 'voice' ? ex.assistantVoice : ex.assistantText };
    }
  }
  return best ? best.reply : null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Convert text/markdown output into TTS-friendly speech.
function sanitizeForVoice(s: string): string {
  let out = s;
  out = out.replace(/[\*\_`#>]+/g, '');                 // markdown
  out = out.replace(/^[\-•·]\s*/gm, '');      // leading bullets
  out = out.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ''); // emojis
  out = out.replace(/₹\s*(\d+)/g, (_, n) => `${spellOutRupees(Number(n))}`);
  out = out.replace(/Rs\.?\s*(\d+)/gi, (_, n) => `${spellOutRupees(Number(n))}`);
  out = out.replace(/\s+/g, ' ').trim();
  // Cap to 3 sentences so the TTS reply stays short.
  const sentences = out.match(/[^.!?]+[.!?]+/g) ?? [out];
  return sentences.slice(0, 3).join(' ').trim();
}

function spellOutRupees(n: number): string {
  return n === 0 ? 'free' : `${spellOutNumber(n)} rupees`;
}

function spellOutNumber(n: number): string {
  if (n < 0 || !Number.isFinite(n)) return String(n);
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const r = n % 10;
    return r === 0 ? TENS[t] : `${TENS[t]} ${ONES[r]}`;
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return r === 0 ? `${ONES[h]} hundred` : `${ONES[h]} hundred and ${spellOutNumber(r)}`;
  }
  if (n < 100000) {
    const t = Math.floor(n / 1000);
    const r = n % 1000;
    return r === 0 ? `${spellOutNumber(t)} thousand` : `${spellOutNumber(t)} thousand ${spellOutNumber(r)}`;
  }
  return String(n);
}

const ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];

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
    recommendAsk: /\b(recommend|suggest|whats good|what's good|what should|wyd|top picks?|popular|trending|bestseller|something good|i am hungry|i'?m hungry|what to (eat|order))\b/.test(t),
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
    if (i.category && !categoryMatches(d.category, i.category)) return false;
    if (i.maxPrice != null && d.price > i.maxPrice) return false;
    if (i.minPrice != null && d.price < i.minPrice) return false;
    if (i.spicy === 'spicy' && d.spiceLevel < 2) return false;
    if (i.spicy === 'mild' && d.spiceLevel > 1) return false;
    if (i.allergenAsk.length && d.allergens.some((a) => i.allergenAsk.includes(a))) return false;
    return true;
  });
}

// Schema changed from single "Biryani" / "Curries" categories to split
// "Biryani — Non-Veg" / "Biryani — Veg" and "Curries — Non-Veg" / "Curries — Veg".
// Treat the user-intent label as a prefix that matches any split.
function categoryMatches(dishCategory: string, wanted: string): boolean {
  const d = dishCategory.toLowerCase();
  const w = wanted.toLowerCase();
  if (d === w) return true;
  // Strip the " — non-veg" / " — veg" suffix when matching the generic label
  const dStripped = d.split(/[—-]/)[0].trim();
  const wStripped = w.split(/[—-]/)[0].trim();
  if (dStripped === wStripped) return true;
  if (d.startsWith(w) || w.startsWith(d)) return true;
  return false;
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

  // If the user expressed any actionable food intent (dietary, category, price,
  // mood, allergen, etc.) skip the greeting reply and go straight to the menu
  // logic — even if they prefixed with "hi". The menu intent wins.
  const hasMenuIntent =
    i.preferVeg !== null ||
    i.category !== null ||
    i.maxPrice !== null || i.minPrice !== null ||
    i.spicy !== 'any' ||
    i.mood !== null ||
    i.hungerLevel !== null ||
    i.allergenAsk.length > 0 ||
    i.priceAsk !== null ||
    i.recommendAsk;

  if (!hasMenuIntent) {
    // Pure greeting / smalltalk / thanks / goodbye — pick a scripted reply
    // restricted to those intents so we never accidentally return a recipe.
    const scripted = matchScriptedExample(last, 'text', new Set(['greet','thanks','goodbye','smalltalk']));
    if (scripted) return scripted;
    if (i.greeting) {
      return "Hey! I'm Lucky — I can recommend dishes, help you book a table, or answer menu questions. What are you craving?";
    }
    if (i.thanks) {
      return "Any time. Want me to pick a starter or dessert to go with that?";
    }
  }

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
