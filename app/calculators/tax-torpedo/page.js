import TaxTorpedoCalc from '@/components/calculators/TaxTorpedoCalc';

export const metadata = {
  title: 'Social Security Tax Torpedo Calculator — Your Real Marginal Rate',
  description:
    'In the tax torpedo zone, each IRA dollar you withdraw drags $0.85 of Social Security into taxable income — real marginal rates hit 40%+ inside the 22% bracket. Chart your torpedo zone free, no signup.',
  alternates: { canonical: 'https://retiresimplified.com/calculators/tax-torpedo' },
  openGraph: {
    title: 'Social Security Tax Torpedo Calculator',
    description: 'See where the 40%+ hidden marginal rate zone sits for your Social Security and IRA withdrawals.',
  },
};

export default function Page() {
  return <TaxTorpedoCalc />;
}
