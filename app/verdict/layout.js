import { pageMeta } from '@/lib/seo';

// The page is a client component, so its metadata lives here.
export const metadata = pageMeta({
  title: 'Quick Retirement Verdict — Am I on Track? | Retire Simplified',
  description:
    'Three questions, one answer in about 90 seconds: are you on track to retire, and what spending keeps you there. Free, no account, your numbers stay in your browser.',
  path: '/verdict',
});

export default function Layout({ children }) {
  return children;
}
