'use client';

import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import { investSteps } from './learnData';

export default function WhereToStart() {
  return (
    <Card>
      <SectionLabel>Priority Order for Your Money</SectionLabel>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
        Follow this order to maximize every dollar. Each step builds on the previous one.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {investSteps.map(step => (
          <div key={step.num} style={{
            padding: '16px 20px',
            background: 'var(--bg)',
            borderRadius: 8,
            borderLeft: `4px solid ${step.color}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: `${step.color}22`,
              color: step.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
              flexShrink: 0,
            }}>
              {step.num}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{step.title}</span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: `${step.color}22`,
                  color: step.color,
                  textTransform: 'uppercase',
                  letterSpacing: '.04em',
                }}>
                  {step.priority}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }} dangerouslySetInnerHTML={{ __html: step.desc }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
