// Lucky AI — small wrapper around Anthropic Claude. Falls back to a
// deterministic helper when no API key is configured so the chatbot UI is
// always functional.

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { prisma } from '../db';

const client = config.ai.enabled ? new Anthropic({ apiKey: config.ai.anthropicKey }) : null;

export type ChatMsg = { role: 'user' | 'assistant'; content: string };

async function buildMenuContext() {
  const items = await prisma.item.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: [{ category: { position: 'asc' } }, { name: 'asc' }],
  });
  const lines = items.map((i) => {
    const allergens = safeJson<string[]>(i.allergens, []);
    const tags: string[] = [];
    if (i.isVeg) tags.push('veg'); else tags.push('non-veg');
    if (i.spiceLevel >= 2) tags.push('spicy');
    if (i.isBestseller) tags.push('bestseller');
    if (i.isTrending) tags.push('trending');
    if (allergens.length) tags.push(`allergens:${allergens.join('+')}`);
    if (i.calories) tags.push(`${i.calories}kcal`);
    return `- ${i.name} (${i.category.name}) ₹${i.basePrice} · ~${i.prepMinutes}min · [${tags.join(', ')}] — ${i.description ?? ''}`;
  });
  return lines.join('\n');
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
  const menu = await buildMenuContext();

  if (client) {
    const r = await client.messages.create({
      model: config.ai.model,
      max_tokens: 400,
      system: [
        { type: 'text', text: SYSTEM_PROMPT(menu), cache_control: { type: 'ephemeral' } },
      ] as any,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    });
    const reply = r.content
      .filter((b) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');
    return { reply, mode: 'live' };
  }
  // Fallback — small rule-based responder so the UI works without a key.
  return { reply: fallbackReply(history), mode: 'fallback' };
}

function fallbackReply(history: ChatMsg[]): string {
  const last = history[history.length - 1]?.content.toLowerCase() ?? '';
  if (/biryani|hungry|recommend/.test(last)) {
    return 'Go with the Hyderabadi Chicken Biryani (₹320) — 8-hour dum, our bestseller. Pair it with Butter Naan and a Mango Lassi.';
  }
  if (/veg/.test(last)) {
    return 'For veg, try the Veg Biryani (₹240) or Paneer Butter Masala (₹240) with Butter Naan. Light and rich respectively.';
  }
  if (/dessert|sweet/.test(last)) {
    return 'Double ka Meetha (₹120) is our signature Hyderabadi bread pudding. Gulab Jamun (₹80) if you want something simpler.';
  }
  if (/book|table|reserve/.test(last)) {
    return 'Tap "Book a table" in the header. We hold tables for 90 minutes; 22 tables across indoor, patio and family room.';
  }
  if (/coupon|discount|offer/.test(last)) {
    return 'Use FIRST50 for ₹50 off your first order, or FREEDEL for free delivery on ₹300+ orders.';
  }
  return 'Hey! I can recommend dishes, help book a table, or answer menu questions. What are you craving?';
}

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
