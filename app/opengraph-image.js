import { ImageResponse } from 'next/og';

// Share card for links on social, messaging and search. Navy theme colors
// from globals.css; built once at build time.
export const alt = 'Retire Simplified — know what you can spend in retirement, not just whether it lasts';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(135deg, #0B1222 0%, #152039 100%)',
          color: '#F1F5FB',
        }}
      >
        <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, letterSpacing: -0.5 }}>
          Retire<span style={{ color: '#63C794' }}>.</span>Simplified
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: 96, height: 6, background: '#E6B45C', borderRadius: 3, marginBottom: 36 }} />
          <div style={{ display: 'flex', fontSize: 68, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 1000 }}>
            Know what you can spend in retirement, not just whether it lasts.
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 30, color: '#9AA8BF' }}>
          Free <span style={{ color: '#63C794', margin: '0 18px' }}>·</span> Open source
          <span style={{ color: '#63C794', margin: '0 18px' }}>·</span> Every number shows its math
        </div>
      </div>
    ),
    { ...size }
  );
}
