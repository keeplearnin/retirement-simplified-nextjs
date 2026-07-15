import SsBreakEven from '@/components/calculators/SsBreakEven';

export const metadata = {
  title: 'Social Security Break-Even Calculator — Claim at 62, 67, or 70?',
  description:
    'Compare every Social Security claiming age from 62 to 70: monthly check size, lifetime benefits to your longevity age, and the break-even age where waiting wins. SSA 2026 rules, free, no signup.',
  alternates: { canonical: 'https://retiresimplified.com/calculators/social-security-break-even' },
  openGraph: {
    title: 'Social Security Break-Even Calculator: 62 vs 67 vs 70',
    description: 'Every claiming age side by side — check size, lifetime total, and break-even age.',
  },
};

export default function Page() {
  return <SsBreakEven />;
}
