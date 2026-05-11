import Link from 'next/link';
import { Header } from '@/components/Header';
import { Reveal } from '@/components/Reveal';
import { Marquee } from '@/components/Marquee';
import { Counter } from '@/components/Counter';
import { BranchReviews } from '@/components/BranchReviews';
import { DishImage } from '@/components/DishImage';
import { dishPhoto, HERO, STORY, SPICES, RESTAURANT } from '@/lib/photos';

const SERVER_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

async function loadFeatured() {
  try {
    const r = await fetch(`${SERVER_BASE}/api/v1/menu/items`, { cache: 'no-store' });
    if (!r.ok) return [];
    const j = await r.json();
    // pick a curated set: 1 biryani + 2 sides + 1 dessert if possible
    const items: any[] = j.items || [];
    const order = ['Hyderabadi Chicken Biryani', 'Mutton Dum Biryani', 'Butter Chicken', 'Paneer Tikka', 'Double ka Meetha', 'Mango Lassi'];
    return order
      .map((n) => items.find((i) => i.name === n))
      .filter(Boolean)
      .slice(0, 6);
  } catch {
    return [];
  }
}

export default async function Home() {
  const featured = await loadFeatured();

  return (
    <>
      <Header transparent />

      {/* HERO ============================================================== */}
      <section className="relative isolate -mt-[72px] flex min-h-[100svh] items-center overflow-hidden text-white">
        <img
          src={HERO}
          alt="Hyderabadi biryani in a copper handi"
          className="absolute inset-0 -z-10 h-full w-full animate-kenburns object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-stone-900/60 via-stone-900/55 to-stone-900/85" />
        <div className="absolute inset-0 -z-10 bg-noise opacity-40 mix-blend-overlay" />

        <div className="mx-auto w-full max-w-7xl px-4 pt-32 pb-24 md:pt-40 md:pb-32">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-white/90 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-float" />
              Open now · 11 AM – 11 PM
            </span>
          </Reveal>

          <Reveal delay={120}>
            <h1 className="mt-6 max-w-4xl display text-balance text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl lg:text-[88px]">
              Slow-cooked <em className="italic font-medium text-gold">biryani.</em>
              <br />
              <span className="text-gradient">70 spices.</span> 8 hours. One pot.
            </h1>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-6 max-w-xl text-lg text-white/80 md:text-xl">
              Hyderabad's most-loved dum biryani — sealed in a copper handi, opened at your table or your door, hot in 30 minutes flat.
            </p>
          </Reveal>

          <Reveal delay={360}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/menu" className="btn-primary !px-6 !py-3 text-base shadow-xl shadow-brand-700/30">
                Order now <span className="ml-1">→</span>
              </Link>
              <Link href="/book" className="btn-secondary !px-6 !py-3 !border-white/30 !bg-white/10 !text-white backdrop-blur hover:!bg-white/20">
                Book a table
              </Link>
            </div>
          </Reveal>

          <Reveal delay={480}>
            <div className="mt-12 grid max-w-2xl grid-cols-3 divide-x divide-white/20">
              {[
                { k: <Counter to={4} suffix=".7" />, v: 'Stars · 2.1k reviews' },
                { k: <Counter to={28} suffix=" min" />, v: 'Avg. delivery time' },
                { k: <Counter to={47} suffix=" yrs" />, v: 'Generations old recipe' },
              ].map((s, i) => (
                <div key={i} className="px-4 first:pl-0">
                  <div className="display text-3xl font-bold text-white md:text-4xl">{s.k}</div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-white/60">{s.v}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* scroll cue */}
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 animate-float text-xs uppercase tracking-[0.3em] text-white/60">
          ↓ scroll
        </div>
      </section>

      {/* MARQUEE STRIP ====================================================== */}
      <section className="border-y border-brand-200 bg-brand-700 py-4 text-cream">
        <Marquee items={[
          <span key="1" className="display text-xl italic">Hyderabadi Dum</span>,
          <span key="2" className="text-sm uppercase tracking-[0.3em]">Slow-cooked since 1978</span>,
          <span key="3" className="display text-xl italic">Free delivery over ₹500</span>,
          <span key="4" className="text-sm uppercase tracking-[0.3em]">FSSAI certified</span>,
          <span key="5" className="display text-xl italic">Live rider tracking</span>,
          <span key="6" className="text-sm uppercase tracking-[0.3em]">Tables for 2 to 8</span>,
          <span key="7" className="display text-xl italic">Open 7 days</span>,
        ]} />
      </section>

      {/* STORY ============================================================== */}
      <section className="mx-auto max-w-7xl px-4 py-24 md:py-32">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">The craft</span>
            <h2 className="mt-3 display text-4xl font-bold leading-tight text-stone-900 md:text-5xl">
              The handi is sealed with dough.<br />
              <em className="italic font-medium text-brand-700">Patience does the rest.</em>
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-stone-600">
              We marinate overnight, layer with hand-pounded saffron and fried onions, and seal the copper handi with whole-wheat dough. Eight hours of slow dum, no shortcuts. The first whiff when we break the seal at your table — that's the part you'll remember.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-6 border-l border-stone-300 pl-6">
              <Stat n={70} suf="+" label="Spices, hand-blended" />
              <Stat n={8}  suf="hr" label="Sealed dum cook" />
              <Stat n={1}  suf="" label="Family recipe, untouched" />
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="relative">
              <img src={STORY} alt="Steam rising from a copper handi"
                   className="h-[520px] w-full rounded-2xl object-cover shadow-xl shadow-stone-300/60" />
              <div className="absolute -bottom-6 -left-6 hidden rounded-xl bg-cream p-4 shadow-xl ring-1 ring-stone-200 md:block">
                <div className="display text-3xl font-bold text-brand-700">
                  <Counter to={1247} />+
                </div>
                <div className="text-xs uppercase tracking-wide text-stone-500">biryanis cooked this week</div>
              </div>
              <div className="absolute -right-6 -top-6 hidden rotate-6 rounded-full bg-gold px-4 py-2 text-xs font-bold uppercase tracking-widest text-stone-900 shadow-lg md:block">
                Hyderabad · est. 1978
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FEATURED DISHES ==================================================== */}
      <section className="bg-stone-900 py-24 text-white md:py-32">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-end justify-between gap-6">
            <Reveal>
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Most loved</span>
              <h2 className="mt-3 display text-4xl font-bold leading-tight md:text-5xl">
                Pick a favourite. <em className="italic font-medium text-gold">Or two.</em>
              </h2>
            </Reveal>
            <Reveal delay={150}>
              <Link href="/menu" className="hidden text-sm font-medium text-white/70 underline-offset-4 hover:text-white hover:underline md:inline">
                See full menu →
              </Link>
            </Reveal>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((it: any, idx: number) => (
              <Reveal key={it.id} delay={idx * 90}>
                <Link href="/menu" className="dish-card block">
                  <div className="aspect-[4/5] w-full overflow-hidden">
                    <DishImage
                      src={dishPhoto(it.name, it.categoryName, it.imageUrl)}
                      name={it.name}
                      category={it.categoryName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950 via-stone-950/70 to-transparent p-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="display text-2xl font-semibold leading-tight">{it.name}</h3>
                      <span className="display text-xl text-gold">₹{it.basePrice}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-white/70">{it.description}</p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-white/60">
                      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${it.isVeg ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                      <span>{it.isVeg ? 'Veg' : 'Non-veg'}</span>
                      <span>·</span>
                      <span>~{it.prepMinutes} min</span>
                      {it.spiceLevel >= 2 && <><span>·</span><span className="text-rose-300">🌶 hot</span></>}
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="mt-12 text-center md:hidden">
              <Link href="/menu" className="btn-cream !px-6">See full menu →</Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* HOW IT WORKS ======================================================= */}
      <section className="mx-auto max-w-7xl px-4 py-24 md:py-32">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">How it works</span>
            <h2 className="mt-3 display text-4xl font-bold text-stone-900 md:text-5xl">Three taps to a hot biryani.</h2>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {[
            { n: '01', t: 'Choose your dum',  d: 'Browse the categorised menu, pick your portion, dial in your spice level — every dish is customisable.', icon: '🍽' },
            { n: '02', t: 'Pay or pay later', d: 'UPI, cards, or cash on delivery. First-time customers get ₹50 off automatically.',                       icon: '💳' },
            { n: '03', t: 'Track your rider', d: 'Watch your rider on the map in real time. Auto-assigned to the closest one — no third-party platforms.',  icon: '🛵' },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 120}>
              <div className="card relative overflow-hidden p-7">
                <div className="absolute right-4 top-4 display text-6xl font-bold text-brand-100">{s.n}</div>
                <div className="text-3xl">{s.icon}</div>
                <h3 className="mt-3 display text-2xl font-bold text-stone-900">{s.t}</h3>
                <p className="mt-2 text-stone-600">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Real reviews (DB) — shows only when reviews exist */}
      <BranchReviews />

      {/* TESTIMONIALS ======================================================= */}
      <section className="border-y border-stone-200 bg-cream py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-4">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">In their own words</span>
              <h2 className="mt-3 display text-4xl font-bold text-stone-900 md:text-5xl">2,143 reviews. <em className="italic">94% five-star.</em></h2>
            </div>
          </Reveal>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="card relative h-full p-6">
                  <div className="text-gold">★★★★★</div>
                  <p className="mt-3 text-stone-700 leading-relaxed">"{t.quote}"</p>
                  <div className="mt-5 flex items-center gap-3 border-t border-stone-100 pt-4">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 display text-brand-800 font-semibold">
                      {t.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-stone-900">{t.name}</div>
                      <div className="text-xs text-stone-500">{t.location}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* VISIT ============================================================== */}
      <section className="relative overflow-hidden bg-stone-900 text-white">
        <img src={RESTAURANT} alt="Restaurant interior" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/95 via-stone-900/80 to-stone-900/40" />

        <div className="relative mx-auto grid max-w-7xl gap-16 px-4 py-24 md:grid-cols-2 md:py-32">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Visit us</span>
            <h2 className="mt-3 display text-4xl font-bold md:text-5xl">
              Or come <em className="italic">eat with us.</em>
            </h2>
            <p className="mt-4 text-lg text-white/70">
              22 tables across our indoor dining hall, breezy patio, and family room. Reserve in seconds — we'll text you a QR for instant check-in.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-6">
              <InfoBlock label="Address"  value="Banjara Hills, Road No. 1\nHyderabad 500034" />
              <InfoBlock label="Hours"    value="Lunch 11 AM – 3 PM\nDinner 6 PM – 11 PM" />
              <InfoBlock label="Phone"    value="+91 99990 00001" />
              <InfoBlock label="Email"    value="hello@luckybiryani.in" />
            </div>

            <Link href="/book" className="btn-primary mt-8 !px-6 !py-3">
              Reserve a table →
            </Link>
          </Reveal>

          <Reveal delay={150}>
            <div className="grid grid-cols-2 gap-3">
              <img src={SPICES}     alt="" className="aspect-[3/4] w-full rounded-xl object-cover translate-y-6" />
              <img src={STORY}      alt="" className="aspect-[3/4] w-full rounded-xl object-cover" />
              <img src={RESTAURANT} alt="" className="col-span-2 aspect-[16/9] w-full rounded-xl object-cover" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* FINAL CTA ========================================================== */}
      <section className="bg-cream py-24">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <Reveal>
            <h2 className="display text-4xl font-bold leading-tight text-stone-900 md:text-6xl">
              Hungry yet?
            </h2>
            <p className="mt-4 text-lg text-stone-600">First order on us — code <code className="rounded bg-brand-100 px-2 py-0.5 font-mono text-brand-800">FIRST50</code> auto-applies.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/menu" className="btn-primary !px-7 !py-3.5 text-base">Order now →</Link>
              <Link href="/book" className="btn-secondary !px-7 !py-3.5 text-base">Book a table</Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER ============================================================= */}
      <footer className="border-t border-stone-200 bg-stone-900 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 display font-bold">L</span>
              <span className="display text-lg font-bold">Lucky Biryani</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-white/60">Hyderabadi biryani, three generations deep.</p>
          </div>
          <FooterCol title="Order" links={[['Menu','/menu'],['Cart','/cart'],['Track','/orders'],['Refer & earn','/refer']]} />
          <FooterCol title="Visit" links={[['Reserve a table','/book'],['Hours','#hours'],['Directions','#map']]} />
          <FooterCol title="Legal" links={[['Privacy Policy','/privacy'],['Terms of Service','/terms']]} />
          <FooterCol title="Staff" links={[['Manager dashboard','/admin'],['Rider app','/rider']]} />
        </div>
        <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-white/50">
          © Lucky Biryani Centre · FSSAI #DEMO-12345 · GSTIN 36ABCDE1234F1Z5
        </div>
      </footer>
    </>
  );
}

function Stat({ n, suf, label }: { n: number; suf: string; label: string }) {
  return (
    <div>
      <div className="display text-3xl font-bold text-brand-800"><Counter to={n} />{suf}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-stone-500">{label}</div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{label}</div>
      <div className="mt-1 whitespace-pre-line text-sm text-white/80">{value}</div>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{title}</div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {links.map(([l, h]) => (
          <li key={l}><a href={h} className="text-white/70 hover:text-white">{l}</a></li>
        ))}
      </ul>
    </div>
  );
}

const TESTIMONIALS = [
  { quote: "Came for the dum, stayed for the qubani. The seal-breaking ritual at the table got the whole family quiet for a second.", name: 'Aisha Khatoon', location: 'Banjara Hills' },
  { quote: "Rider showed up in 27 minutes, biryani was still steaming. Tracking was actually accurate — no '5 min away' lies.", name: 'Karthik Reddy', location: 'Jubilee Hills' },
  { quote: "Booked a table for 8 for our anniversary. Pre-ordered the spread, food landed within minutes of being seated. Smooth.", name: 'Rohan & Priya', location: 'Hitech City' },
];
