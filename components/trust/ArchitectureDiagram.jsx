// Static architecture picture for /how-it-works. Four screens on top, the
// assistant under the two that use it, one engine (highlighted) with the
// stress test beside it, and the two places data lives at the bottom.
// Pure SVG with the app's CSS variables so it follows light/dark themes.

const ink = 'var(--heading)';
const quiet = 'var(--text-muted)';
const edge = 'var(--border-light)';
const accent = 'var(--accent)';
const tint = 'var(--card)';

const rowA = 64, rowB = 176, rowC = 304, rowD = 448;

function Box({ x, y, w, h, main, fill }) {
  return (
    <rect
      x={x} y={y} width={w} height={h} rx="8"
      fill={main ? 'var(--accent-dim)' : fill || 'none'}
      stroke={main ? accent : edge}
      strokeWidth={main ? 2 : 1.25}
    />
  );
}

function Name({ x, y, children, anchor }) {
  return <text x={x} y={y} textAnchor={anchor} fontSize="13" fontWeight="600" fill={ink}>{children}</text>;
}
function Line({ x, y, children, anchor, strong }) {
  return <text x={x} y={y} textAnchor={anchor} fontSize="11.5" fill={strong ? ink : quiet}>{children}</text>;
}

export default function ArchitectureDiagram() {
  return (
    <svg
      viewBox="0 0 760 544" role="img" width="100%"
      aria-label="One engine answers every screen; the assistant only explains it"
      style={{ fontFamily: 'var(--sans)', display: 'block', maxWidth: 760, margin: '0 auto' }}
    >
      <defs>
        <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={edge} />
        </marker>
      </defs>
      <text x="24" y="34" fontSize="15" fontWeight="600" fill={ink}>One engine answers every screen; the assistant only explains it</text>

      <g fill="none" stroke={edge} strokeWidth="1.25">
        <path d={`M100 ${rowA + 72}V${rowC}`} markerEnd="url(#arch-arrow)" />
        <path d={`M277 ${rowA + 72}V${rowC}`} markerEnd="url(#arch-arrow)" />
        <path d={`M454 ${rowA + 72}V${rowB}`} markerEnd="url(#arch-arrow)" />
        <path d={`M631 ${rowA + 72}V${rowB}`} markerEnd="url(#arch-arrow)" />
        <path d={`M430 ${rowB + 88}V${rowC}`} markerEnd="url(#arch-arrow)" />
        <path d={`M480 ${rowC + 52}H504`} markerEnd="url(#arch-arrow)" />
        <path d={`M190 ${rowD}V${rowC + 104}`} markerEnd="url(#arch-arrow)" />
        <path d={`M706 ${rowD + 36}H730V${rowB + 44}H706`} markerEnd="url(#arch-arrow)" />
      </g>
      <Line x={438} y={rowB + 112}>13 tools</Line>
      <Line x={198} y={rowD - 14}>plan inputs</Line>

      <Box x={24} y={rowA} w={151} h={72} />
      <Name x={100} y={rowA + 24} anchor="middle">Plan</Name>
      <Line x={100} y={rowA + 42} anchor="middle">Your plan, the odds,</Line>
      <Line x={100} y={rowA + 58} anchor="middle">year-by-year ledger</Line>

      <Box x={201} y={rowA} w={151} h={72} />
      <Name x={277} y={rowA + 24} anchor="middle">Improve</Name>
      <Line x={277} y={rowA + 42} anchor="middle">Ranked moves with</Line>
      <Line x={277} y={rowA + 58} anchor="middle">the math shown</Line>

      <Box x={378} y={rowA} w={151} h={72} />
      <Name x={454} y={rowA + 24} anchor="middle">Ask</Name>
      <Line x={454} y={rowA + 42} anchor="middle">Questions answered</Line>
      <Line x={454} y={rowA + 58} anchor="middle">from tool results</Line>

      <Box x={555} y={rowA} w={151} h={72} />
      <Name x={631} y={rowA + 24} anchor="middle">Weekly check</Name>
      <Line x={631} y={rowA + 42} anchor="middle">Scheduled health</Line>
      <Line x={631} y={rowA + 58} anchor="middle">report, by email</Line>

      <Box x={378} y={rowB} w={328} h={88} />
      <Name x={394} y={rowB + 24}>Assistant: Claude + 13 tools</Name>
      <Line x={394} y={rowB + 42}>Reads the plan, runs the engine through tools</Line>
      <Line x={394} y={rowB + 58}>Never names investments; proposes, never changes</Line>
      <Line x={394} y={rowB + 74}>Shared rules in code, locked by tests</Line>

      <Box x={24} y={rowC} w={456} h={104} main />
      <Name x={40} y={rowC + 24}>One projection engine, year by year</Name>
      <Line x={40} y={rowC + 42} strong>Income, spending, healthcare and long-term care, RMDs, withdrawals</Line>
      <Line x={40} y={rowC + 58} strong>Federal and state tax with inflation-indexed thresholds</Line>
      <Line x={40} y={rowC + 74} strong>Growth applied after withdrawals; liquid balance decides lasts-to</Line>
      <Line x={40} y={rowC + 90} strong>Every number traceable to a Ledger row</Line>

      <Box x={504} y={rowC} w={202} h={104} />
      <Name x={520} y={rowC + 24}>Stress test</Name>
      <Line x={520} y={rowC + 42}>Reruns the engine across</Line>
      <Line x={520} y={rowC + 58}>500 simulated markets and</Line>
      <Line x={520} y={rowC + 74}>every real sequence</Line>
      <Line x={520} y={rowC + 90}>since 1928</Line>

      <Box x={24} y={rowD} w={328} h={72} fill={tint} />
      <Name x={40} y={rowD + 24}>Your browser</Name>
      <Line x={40} y={rowD + 42}>Plan, scenarios and settings in localStorage</Line>
      <Line x={40} y={rowD + 58}>A random device ID, no accounts</Line>

      <Box x={378} y={rowD} w={328} h={72} fill={tint} />
      <Name x={394} y={rowD + 24}>Server, keyed by device ID</Name>
      <Line x={394} y={rowD + 42}>Chat history, health-check reports,</Line>
      <Line x={394} y={rowD + 58}>email preference (DynamoDB)</Line>
    </svg>
  );
}
