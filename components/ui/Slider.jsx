'use client';

import { useState, useRef, useEffect } from 'react';

export default function Slider({ label, value, onChange, min, max, step = 1, format, suffix = '', prefix = '', tooltip }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');
  const inputRef = useRef(null);
  const p = ((value - min) / (max - min)) * 100;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function startEdit() {
    setEditVal(String(value));
    setEditing(true);
  }

  function commitEdit() {
    setEditing(false);
    let num = parseFloat(editVal);
    if (isNaN(num)) return;
    // Clamp to min/max
    num = Math.max(min, Math.min(max, num));
    // Snap to step
    num = Math.round(num / step) * step;
    onChange(num);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditing(false);
  }

  const displayVal = `${prefix}${format ? format(value) : value}${suffix}`;

  return (
    <div className="mb-24">
      <div className="flex justify-between items-center mb-8">
        <span className="slider-label">
          {label}
          {tooltip && <span title={tooltip} style={{ marginLeft: 6, cursor: 'help', opacity: .5 }} className="f12">ⓘ</span>}
        </span>
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            style={{
              width: 90, padding: '2px 8px', borderRadius: 6, textAlign: 'right',
              border: '1.5px solid var(--accent)', background: 'var(--bg)',
              color: 'var(--accent)', fontSize: 14, fontWeight: 700,
              fontFamily: 'var(--sans)', outline: 'none',
            }}
          />
        ) : (
          <span
            className="slider-value"
            onClick={startEdit}
            title="Click to type a value"
            style={{ cursor: 'text', borderBottom: '1px dashed var(--border)', paddingBottom: 1 }}
          >
            {displayVal}
          </span>
        )}
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
