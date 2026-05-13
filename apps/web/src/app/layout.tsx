import './globals.css';
import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-store';
import { CartProvider } from '@/lib/cart-store';
import { LuckyAi } from '@/components/LuckyAi';
import { ToastProvider } from '@/components/ui/Toast';
import { ScrollProgress } from '@/components/ui/ScrollProgress';
import { StickyCartBar } from '@/components/StickyCartBar';

const display = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});
const body = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'Lucky Biryani Centre · Hyderabadi dum biryani',
  description:
    'Slow-cooked Hyderabadi biryani delivered hot in 30 minutes — or reserve a table at our flagship in Banjara Hills.',
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.webmanifest',
  themeColor: '#c2410c',
  openGraph: {
    title: 'Lucky Biryani Centre',
    description: 'Hyderabad’s slow-cooked biryani, 70 spices, 8 hours, one pot.',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

// Restaurant structured data — picked up by Google for rich result cards.
const restaurantJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: 'Lucky Biryani Centre',
  description: 'Slow-cooked Hyderabadi dum biryani, est. 1978.',
  servesCuisine: ['Hyderabadi', 'Indian', 'Biryani'],
  priceRange: '₹₹',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Road No. 1, Banjara Hills',
    addressLocality: 'Hyderabad',
    addressRegion: 'TS',
    postalCode: '500034',
    addressCountry: 'IN',
  },
  geo: { '@type': 'GeoCoordinates', latitude: 17.385, longitude: 78.4867 },
  openingHours: 'Mo-Su 11:00-23:00',
  telephone: '+91-9999000001',
  email: 'hello@luckybiryani.in',
  acceptsReservations: true,
  hasMenu: { '@type': 'Menu', url: '/menu' },
  aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.7', reviewCount: '2143' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd) }}
        />
      </head>
      <body>
        <ScrollProgress />
        <AuthProvider>
          <ToastProvider>
            <CartProvider>
              {children}
              <StickyCartBar />
              <LuckyAi />
            </CartProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
