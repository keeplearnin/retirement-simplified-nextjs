'use client';

import Card from '@/components/ui/Card';
import SectionLabel from '@/components/ui/SectionLabel';
import { fundCards } from './learnData';

export default function WhatToBuy() {
  return (
    <Card>
      <SectionLabel>Core Index Funds</SectionLabel>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
        These are the only funds most people need. All have expense ratios under 0.10%.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {fundCards.map(fund => (
          <div key={fund.title} style={{
            padding: 20,
            background: 'var(--bg)',
            borderRadius: 10,
            border: `1px solid ${fund.color}33`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: fund.color, fontFamily: 'var(--serif)' }}>{fund.title}</div>
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 10,
                background: `${fund.color}18`,
                color: fund.color,
              }}>
                {fund.allocation}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 14 }} dangerouslySetInnerHTML={{ __html: fund.desc }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(fund.tickers).map(([provider, ticker]) => (
                <div key={provider} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-dim)' }}>{provider}</span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 500 }}>{ticker}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
