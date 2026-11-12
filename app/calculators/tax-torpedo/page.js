import TaxTorpedoCalc from '@/components/calculators/TaxTorpedoCalc';
import JsonLd from '@/components/JsonLd';
import { pageMeta, webAppJsonLd } from '@/lib/seo';

const description =
  'In the tax torpedo zone, each IRA dollar you withdraw drags $0.85 of Social Security into taxable income — real marginal rates hit 40%+ inside the 22% bracket. Chart your torpedo zone free, no signup.';

export const metadata = pageMeta({
  title: 'Social Security Tax Torpedo Calculator — Your Real Marginal Rate',
  description,
  path: '/calculators/tax-torpedo',
  ogTitle: 'Social Security Tax Torpedo Calculator',
  ogDescription: 'See where the 40%+ hidden marginal rate zone sits for your Social Security and IRA withdrawals.',
});

export default function Page() {
  return (
    <>
      <JsonLd data={webAppJsonLd({ name: 'Social Security Tax Torpedo Calculator', description, path: '/calculators/tax-torpedo' })} />
      <TaxTorpedoCalc />
    </>
  );
}
