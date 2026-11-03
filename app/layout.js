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
  description: 'Free, open-source retirement planner. See the chance your money lasts, which moves are worth the most (Social Security timing, Roth conversions, taxes), and ask questions about your own plan. Every number shows its math.',
  openGraph: {
    title: 'Retirement.Simplified — From First Paycheck to Last Withdrawal',
    description: 'A free, open-source second opinion on your retirement plan — with the math shown.',
  },
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: the inline script below may set data-theme
    // before React hydrates, so <html> legitimately differs from the server.
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply a saved dark preference before first paint — doing it in an
            effect flashed the light default first. Runs on every page, so
            /verdict, /methodology etc. now honor the choice too. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
