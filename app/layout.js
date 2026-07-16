import { Inter, Fraunces } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Display face — carries the product's personality. Fraunces is an
// editorial serif with optical sizing: warm and characterful at hero-number
// sizes, quiet at heading sizes. Deliberately NOT the geometric-sans that
// every generated dashboard ships with. Inter stays for UI text.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['opsz'],
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
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
