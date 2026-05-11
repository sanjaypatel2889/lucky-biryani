import { Header } from '@/components/Header';

export const metadata = {
  title: 'Privacy Policy · Lucky Biryani Centre',
  description: 'How Lucky Biryani Centre collects, uses, and protects your data under India\'s DPDP Act and other applicable laws.',
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10 leading-relaxed text-stone-700">
        <h1 className="display text-4xl font-bold text-stone-900">Privacy Policy</h1>
        <p className="mt-1 text-sm text-stone-500">Last updated: May 2026</p>

        <Section title="1. Who we are">
          Lucky Biryani Centre ("we", "us") operates this website and the in-house delivery service from Banjara Hills, Hyderabad. You can reach our grievance officer at <a className="text-brand-700 underline" href="mailto:hello@luckybiryani.in">hello@luckybiryani.in</a>.
        </Section>

        <Section title="2. What we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>Email address — required for account creation and login.</li>
            <li>Optional phone number — used for SMS/WhatsApp delivery updates.</li>
            <li>Delivery address and approximate coordinates — required to deliver food.</li>
            <li>Order history, cart, ratings, and loyalty balance.</li>
            <li>Device data (user agent) when you enable push notifications.</li>
          </ul>
        </Section>

        <Section title="3. How we use it">
          To fulfil and track your order, run our loyalty programme, send transactional updates, and improve menu recommendations. We do not sell personal data to third parties.
        </Section>

        <Section title="4. Sharing">
          Riders, payment gateways (Razorpay), email/SMS providers (Brevo, MSG91), and analytics providers receive only the minimum data needed to do their job. All sub-processors are listed on request.
        </Section>

        <Section title="5. Retention">
          Order data is retained for 7 years as required by GST. Push subscription endpoints are kept until you turn them off in your browser settings. You can request deletion of your account at any time.
        </Section>

        <Section title="6. Your rights (DPDP Act 2023)">
          You may access, correct, port, or delete the data we hold about you. To exercise any of these rights, email our grievance officer above. We respond within 30 days.
        </Section>

        <Section title="7. Cookies">
          We use a single first-party cookie ("token") to keep you logged in. We do not use third-party advertising cookies.
        </Section>

        <Section title="8. Changes">
          Material changes will be announced on this page at least 14 days before they take effect.
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
