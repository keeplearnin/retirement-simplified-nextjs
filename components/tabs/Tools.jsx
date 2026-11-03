'use client';

// Tools: deeper calculators for specific situations, kept out of the main
// nav so Plan / Improve / Ask stay simple. Each reads the same saved plan.
// `id` is the app tab id (see app/page.js); `href` is a standalone page.
export const TOOLS = [
  { id: 'income', title: 'Social Security and income', desc: 'When to claim, which accounts to draw from first, health cover before 65, and tax spikes.' },
  { id: 'roth-strategy', title: 'Roth', desc: 'Roth or traditional contributions now, and converting to Roth later.' },
  { id: 'accounts', title: 'Your accounts', desc: 'Link or list your accounts to fill in your balances.' },
  { id: 'portfolio', title: 'Portfolio', desc: 'Pick a fund mix and see its risk and costs.' },
  { id: 'equity', title: 'Stock compensation', desc: 'RSUs and options: vesting income and the taxes on it.' },
  { id: 'college', title: 'College', desc: '529 savings and the years tuition is due.' },
  { id: 'inheritance', title: 'Inheritance', desc: 'What your heirs would receive after taxes.' },
  { id: 'guide', title: 'Getting started', desc: 'Account types and first steps if you are new to investing.' },
];

const PAGES = [
  { href: '/verdict', title: 'Quick verdict' },
  { href: '/accuracy', title: 'How we check the math' },
  { href: '/report', title: 'Print your plan (PDF)' },
  { href: '/calculators/social-security-break-even', title: 'Social Security break-even' },
  { href: '/calculators/irmaa-cliff-checker', title: 'Medicare surcharge (IRMAA) check' },
  { href: '/calculators/tax-torpedo', title: 'Tax torpedo' },
];

export default function Tools({ onOpen }) {
  return (
    <div className="fade-up">
      <h1 className="tools-title">Tools</h1>
      <p className="tools-sub">Deeper calculators for specific situations. They use the numbers from your plan.</p>
      <div className="tools-grid">
        {TOOLS.map(t => (
          <button key={t.id} type="button" className="tool-card" onClick={() => onOpen(t.id)}>
            <span className="tool-card-title">{t.title}</span>
            <span className="tool-card-desc">{t.desc}</span>
          </button>
        ))}
      </div>
      <h2 className="tools-section">Quick pages</h2>
      <ul className="tools-links">
        {PAGES.map(p => <li key={p.href}><a href={p.href}>{p.title}</a></li>)}
      </ul>
    </div>
  );
}
