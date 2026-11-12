import { pageMeta } from '@/lib/seo';

// The page is a client component, so its metadata lives here.
export const metadata = pageMeta({
  title: 'Your Retirement Plan Report — Retire Simplified',
  description:
    'A printable report of the retirement plan saved in your browser.',
  path: '/report',
  noindex: true,
});

export default function Layout({ children }) {
  return children;
}
