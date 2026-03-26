'use client';

export default function Slider({ label, value, onChange, min, max, step = 1, format, suffix = '', prefix = '', tooltip }) {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-24">
      <div className="flex justify-between items-center mb-8">
        <span className="slider-label">
          {label}
          {tooltip && <span title={tooltip} style={{ marginLeft: 6, cursor: 'help', opacity: .5 }} className="f12">ⓘ</span>}
        </span>
        <span className="slider-value">{prefix}{format ? format(value) : value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ background: `linear-gradient(to right,var(--accent) 0%,var(--accent) ${p}%,var(--border) ${p}%,var(--border) 100%)` }}
      />
      <div className="flex justify-between mt-4">
        <span className="dim f11">{prefix}{format ? format(min) : min}{suffix}</span>
        <span className="dim f11">{prefix}{format ? format(max) : max}{suffix}</span>
      </div>
    </div>
  );
}
