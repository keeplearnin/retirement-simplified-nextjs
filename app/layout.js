import { Instrument_Serif, Outfit } from 'next/font/google';
import './globals.css';

const instrumentSerif = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
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
    <html lang="en" className={`${instrumentSerif.variable} ${outfit.variable}`}>
      <body>{children}</body>
    </html>
  );
}
