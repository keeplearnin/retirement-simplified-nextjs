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
  title: 'Retirement.Simplified — Free Retirement Planning',
  description: 'Free retirement planning tools: growth projector, Monte Carlo simulation, fee impact, portfolio builder, tax-aware projections, Social Security estimator, and step-by-step guide. No advisor needed.',
  openGraph: {
    title: 'Retirement.Simplified — Free Retirement Planning',
    description: 'Everything a financial advisor charges 1% for — free and transparent.',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${outfit.variable}`}>
      <body>{children}</body>
    </html>
  );
}
