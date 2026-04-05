import type { Allocation } from './types';

export function computeTarget(age: number, risk: number): Allocation {
  const base = Math.max(20, Math.min(95, 110 - age));
  const adj = (risk - 3) * 8;
  const stock = Math.max(15, Math.min(95, base + adj));
  const intl = Math.round(stock * 0.3);
  const dom = stock - intl;
  const bond = Math.max(5, 100 - stock - 5);
  const cash = Math.max(0, 100 - dom - intl - bond);
  // Ensure total = 100 by adjusting bond if needed
  const total = dom + intl + bond + cash;
  const adjBond = total !== 100 ? bond + (100 - total) : bond;
  return { us_stock: dom, intl_stock: intl, bond: adjBond, cash };
}
