'use client';

import Card from '@/components/ui/Card';
import InfoBox from '@/components/ui/InfoBox';

export default function ManualAccountForm({ onOpenModal, btnPrimary }) {
  return (
    <div className="fade-up">
      <InfoBox title="Link Your Accounts" color="var(--accent)">
        Connect your financial institutions to automatically aggregate all your accounts. See your complete net worth, retirement progress, and asset allocation in one place.
      </InfoBox>

      <Card style={{ textAlign: 'center', padding: '60px 32px', marginTop: 16 }}>
        <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.25 }}></div>
        <div className="serif f20 mb-8" style={{ color: 'var(--text-muted)' }}>
          Connect Your First Account
        </div>
        <div className="f13 dim lh-loose" style={{ maxWidth: 460, margin: '0 auto 12px' }}>
          Link your bank, brokerage, and retirement accounts to get a unified view of your finances. We use bank-level encryption to keep your data secure.
        </div>

        <div style={{
          display: 'flex', gap: 20, justifyContent: 'center', margin: '24px auto 32px',
          maxWidth: 400, flexWrap: 'wrap',
        }}>
          {[
            { icon: '', text: 'Unified net worth' },
            { icon: '', text: 'Bank-level security' },
            { icon: '', text: 'Auto-sync balances' },
            { icon: '', text: 'Track retirement goals' },
          ].map(item => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <span>{item.icon}</span> {item.text}
            </div>
          ))}
        </div>

        <button onClick={onOpenModal} style={{ ...btnPrimary, padding: '12px 28px', fontSize: 14 }}>
          Connect Account
        </button>
      </Card>
    </div>
  );
}
