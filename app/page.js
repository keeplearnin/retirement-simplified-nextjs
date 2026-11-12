import HomeApp from '@/components/HomeApp';
import JsonLd from '@/components/JsonLd';
import { pageMeta, webAppJsonLd, SITE_NAME } from '@/lib/seo';

// Server wrapper so the home page can carry its own metadata (canonical,
// share card, structured data); the app itself is the client HomeApp.
const description =
  'How much can you spend in retirement, and will it last? A free, open-source planner with year-by-year tax math and your best moves ranked in dollars.';

export const metadata = pageMeta({
  title: `Free Retirement Planner: How Much Can I Spend? | ${SITE_NAME}`,
  description,
  path: '/',
  ogTitle: 'Know what you can spend in retirement, not just whether it lasts',
  ogDescription: 'A free, open-source retirement planner with the math shown: your odds, your monthly spending number, and your best moves ranked by dollars.',
});

export default function Home() {
  return (
    <>
      <JsonLd data={webAppJsonLd({ name: SITE_NAME, description, path: '/' })} />
      <HomeApp />
    </>
  );
}
