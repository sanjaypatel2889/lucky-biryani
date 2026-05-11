import { Header } from '@/components/Header';

export const metadata = {
  title: 'Terms of Service · Lucky Biryani Centre',
  description: 'The rules under which you order from and use the Lucky Biryani Centre website and mobile experience.',
};

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10 leading-relaxed text-stone-700">
        <h1 className="display text-4xl font-bold text-stone-900">Terms of Service</h1>
        <p className="mt-1 text-sm text-stone-500">Last updated: May 2026</p>

        <Section title="1. Acceptance">
          By creating an account, placing an order, or booking a table, you agree to these terms. If you are under 18, please get a parent or guardian to use the site for you.
        </Section>

        <Section title="2. Ordering">
          Prices include 5% GST unless marked otherwise. Quoted prep and delivery times are best-effort estimates. We reserve the right to refuse service if an order looks fraudulent.
        </Section>

        <Section title="3. Cancellation & Refunds">
          You may cancel an order while it is still in PENDING_PAYMENT or PAID status. Once cooking starts, the order cannot be cancelled. Refunds for failed payments are credited back within 5–7 business days.
        </Section>

        <Section title="4. Reservations">
          Tables are held for 15 minutes past the slot start. After that they are released to walk-ins. Three no-shows within 90 days mean future reservations require a refundable deposit of ₹100 per seat.
        </Section>

        <Section title="5. Coupons & loyalty">
          Coupon codes are single-use per order unless stated otherwise. Loyalty points are credited only on DELIVERED orders, expire after 12 months, and have no cash value.
        </Section>

        <Section title="6. Reviews">
          You may post reviews tied to a delivered order. Reviews must be your honest experience, free of personal attacks and unrelated content. We may remove reviews that violate this policy.
        </Section>

        <Section title="7. Liability">
          We make every effort to disclose allergens accurately, but cross-contact in a shared kitchen is possible. If you have severe allergies, please let us know in the order notes before checkout.
        </Section>

        <Section title="8. Disputes">
          These terms are governed by the laws of India. Any disputes are subject to the exclusive jurisdiction of courts in Hyderabad, Telangana.
        </Section>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold text-stone-900">{title}</h2>
      <div className="mt-2 text-sm">{children}</div>
    </section>
  );
}
