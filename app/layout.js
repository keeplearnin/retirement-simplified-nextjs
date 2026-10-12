// Public Sans — the US Web Design System typeface. Plain, civic, built for
// forms and figures: the right voice for a tool whose numbers come from the
// IRS, SSA and CMS. Self-hosted via Fontsource so builds don't depend on a
// network fetch to Google Fonts. One family carries both UI and display;
// hierarchy comes from weight and size, not a second face.
import '@fontsource-variable/public-sans/wght.css';
import './globals.css';

export const metadata = {
  title: 'Retirement.Simplified — From First Paycheck to Last Withdrawal',
  description: 'Free investment & retirement planning tools: portfolio builder with ETF analytics, growth projector, Monte Carlo simulation, tax-loss harvesting, Roth vs Traditional, withdrawal strategy, and AI advisor. No advisor needed.',
  openGraph: {
    title: 'Retirement.Simplified — From First Paycheck to Last Withdrawal',
    description: 'Everything a financial advisor charges 1% for — free and transparent. From first paycheck to last withdrawal.',
  },
};

// Apply the saved theme before first paint on every route (home, verdict,
// calculators, methodology) so there's no light/dark flash and the choice
// carries across pages. Light is the default.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
