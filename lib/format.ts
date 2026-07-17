// A financial planner can never render "$NaN" or "$Infinity" — a single bad
// number destroys trust in every number on the page. All currency formatting
// funnels through here, so guard non-finite input once, centrally, and treat
// it as $0. Negatives are formatted symmetrically (e.g. "-$2.0M", not the
// leaky "$-2,000,000" the raw toLocaleString produced for the K/M ranges).
export const fmt = (n: number): string => {
  if (!Number.isFinite(n)) return '$0';
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(a >= 1e5 ? 0 : 1)}K`;
  return `${sign}$${Math.round(a).toLocaleString()}`;
};

export const fmtFull = (n: number): string => {
  if (!Number.isFinite(n)) return '$0';
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.round(Math.abs(n)).toLocaleString()}`;
};

export function descArc(cx: number, cy: number, r: number, s: number, e: number): string {
  const sa = ((s - 90) * Math.PI) / 180;
  const ea = ((e - 90) * Math.PI) / 180;
  const la = e - s > 180 ? 1 : 0;
  return `M ${cx + r * Math.cos(sa)} ${cy + r * Math.sin(sa)} A ${r} ${r} 0 ${la} 1 ${cx + r * Math.cos(ea)} ${cy + r * Math.sin(ea)}`;
}
