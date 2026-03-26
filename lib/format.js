export const fmt = (n) => {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
};

export const fmtFull = (n) => '$' + Math.round(n).toLocaleString();

export function descArc(cx, cy, r, s, e) {
  const sa = ((s - 90) * Math.PI) / 180;
  const ea = ((e - 90) * Math.PI) / 180;
  const la = e - s > 180 ? 1 : 0;
  return `M ${cx + r * Math.cos(sa)} ${cy + r * Math.sin(sa)} A ${r} ${r} 0 ${la} 1 ${cx + r * Math.cos(ea)} ${cy + r * Math.sin(ea)}`;
}
