import IrmaaChecker from '@/components/calculators/IrmaaChecker';

export const metadata = {
  title: 'IRMAA Cliff Checker 2026 — Free Medicare Surcharge Calculator',
  description:
    'Check how close your MAGI is to the next IRMAA tier. One extra dollar of income can trigger a full year of Medicare Part B surcharges — see the 2026 thresholds and your distance to the cliff. Free, no signup.',
  alternates: { canonical: 'https://retiresimplified.com/calculators/irmaa-cliff-checker' },
  openGraph: {
    title: 'IRMAA Cliff Checker 2026 — Am I About to Trigger a Medicare Surcharge?',
    description: 'The IRMAA tiers are cliffs, not phase-ins. Check your distance to the next one with 2026 SSA thresholds.',
  },
};

export default function Page() {
  return <IrmaaChecker />;
}
