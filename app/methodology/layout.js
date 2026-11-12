import { pageMeta } from '@/lib/seo';

// The page is a client component, so its metadata lives here.
export const metadata = pageMeta({
  title: 'Methodology: Tax Figures, Assumptions and Sources — Retire Simplified',
  description:
    'Every assumption behind the retirement engine: 2026 IRS brackets and limits, Social Security and Medicare rules, RMDs, state taxes, market returns, and where each figure comes from.',
  path: '/methodology',
});

export default function Layout({ children }) {
  return children;
}
