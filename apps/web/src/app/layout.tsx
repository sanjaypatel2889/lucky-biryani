import './globals.css';
import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-store';
import { CartProvider } from '@/lib/cart-store';

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
  title: 'Lucky Biryani Centre · Hyderabadi dum biryani',
  description:
    'Slow-cooked Hyderabadi biryani delivered hot in 30 minutes — or reserve a table at our flagship in Banjara Hills.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Lucky Biryani Centre',
    description: 'Hyderabad’s slow-cooked biryani, 70 spices, 8 hours, one pot.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
