import IrmaaChecker from '@/components/calculators/IrmaaChecker';
import JsonLd from '@/components/JsonLd';
import { pageMeta, webAppJsonLd } from '@/lib/seo';

const description =
  'Check how close your MAGI is to the next IRMAA tier. One extra dollar of income can trigger a full year of Medicare Part B surcharges — see the 2026 thresholds and your distance to the cliff. Free, no signup.';

export const metadata = pageMeta({
  title: 'IRMAA Cliff Checker 2026 — Free Medicare Surcharge Calculator',
  description,
  path: '/calculators/irmaa-cliff-checker',
  ogTitle: 'IRMAA Cliff Checker 2026 — Am I About to Trigger a Medicare Surcharge?',
  ogDescription: 'The IRMAA tiers are cliffs, not phase-ins. Check your distance to the next one with 2026 SSA thresholds.',
});

export default function Page() {
  return (
    <>
      <JsonLd data={webAppJsonLd({ name: 'IRMAA Cliff Checker', description, path: '/calculators/irmaa-cliff-checker' })} />
      <IrmaaChecker />
    </>
  );
}
