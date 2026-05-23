'use client';

/**
 * Drawer — design-system primitive. The expandable panel that opens
 * below the AI Advisor chip bar (Plan Health, Insights, Optimize,
 * Review, RE, Settings, Tour all use this shape).
 *
 * Renders a card with a titled header (with close button) and a body.
 * Animates in with a subtle slide-up. Press × or call onClose to dismiss.
 *
 * Usage:
 *   <Drawer title="Optimization Report" onClose={() => setActivePanel(null)}>
 *     {report content...}
 *   </Drawer>
 *
 * Why a component: every drawer was ~12 lines of inline styles duplicated
 * across 7 panels in AIAdvisor. Now: one shape, one place to evolve.
 */
export default function Drawer({ title, onClose, children, className = '' }) {
  return (
    <div className={`drawer ${className}`.trim()}>
      <div className="drawer-header">
        <span className="drawer-title">{title}</span>
        {onClose && (
          <button
            className="drawer-close"
            onClick={onClose}
            aria-label="Close panel"
          >
            ×
          </button>
        )}
      </div>
      <div className="drawer-body">{children}</div>
    </div>
  );
}
