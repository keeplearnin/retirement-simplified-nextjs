import { Inter, DM_Sans } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata = {
  title: 'Retirement.Simplified — From First Paycheck to Last Withdrawal',
  description: 'Free investment & retirement planning tools: portfolio builder with ETF analytics, growth projector, Monte Carlo simulation, tax-loss harvesting, Roth vs Traditional, withdrawal strategy, and AI advisor. No advisor needed.',
  openGraph: {
    title: 'Retirement.Simplified — From First Paycheck to Last Withdrawal',
    description: 'Everything a financial advisor charges 1% for — free and transparent. From first paycheck to last withdrawal.',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
