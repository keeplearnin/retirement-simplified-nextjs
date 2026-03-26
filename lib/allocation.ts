import type { Allocation } from './types';

export function computeTarget(age: number, risk: number): Allocation {
  const base = Math.max(20, Math.min(95, 110 - age));
  const adj = (risk - 3) * 8;
  const stock = Math.max(15, Math.min(95, base + adj));
  const intl = Math.round(stock * 0.3);
  const dom = stock - intl;
  const bond = Math.max(5, 100 - stock - 5);
  const cash = 100 - dom - intl - bond;
  return { us_stock: dom, intl_stock: intl, bond, cash };
}
