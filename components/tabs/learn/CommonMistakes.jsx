'use client';

import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import { mistakes } from './learnData';

export default function CommonMistakes() {
  return (
    <Card>
      <SectionLabel>Common Investing Mistakes</SectionLabel>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
        Avoiding these mistakes is just as important as picking the right investments.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {mistakes.map((m, i) => (
          <div key={i} style={{
            padding: 18,
            background: 'var(--bg)',
            borderRadius: 10,
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              {m.title}
            </div>
            <div style={{
              fontSize: 11,
              color: 'var(--danger)',
              fontWeight: 600,
              marginBottom: 10,
              padding: '4px 10px',
              background: 'var(--danger)12',
              borderRadius: 4,
              display: 'inline-block',
            }}>
              Cost: {m.cost}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: m.fix }} />
          </div>
        ))}
      </div>
    </Card>
  );
}
