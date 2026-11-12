import SsBreakEven from '@/components/calculators/SsBreakEven';
import JsonLd from '@/components/JsonLd';
import { pageMeta, webAppJsonLd } from '@/lib/seo';

const description =
  'Compare every Social Security claiming age from 62 to 70: monthly check size, lifetime benefits to your longevity age, and the break-even age where waiting wins. SSA 2026 rules, free, no signup.';

export const metadata = pageMeta({
  title: 'Social Security Break-Even Calculator — Claim at 62, 67, or 70?',
  description,
  path: '/calculators/social-security-break-even',
  ogTitle: 'Social Security Break-Even Calculator: 62 vs 67 vs 70',
  ogDescription: 'Every claiming age side by side — check size, lifetime total, and break-even age.',
});

export default function Page() {
  return (
    <>
      <JsonLd data={webAppJsonLd({ name: 'Social Security Break-Even Calculator', description, path: '/calculators/social-security-break-even' })} />
      <SsBreakEven />
    </>
  );
}
