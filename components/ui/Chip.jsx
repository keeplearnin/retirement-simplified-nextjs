'use client';

/**
 * Chip — design-system primitive. The status pill used in the AI Advisor
 * chip bar and the sub-nav row. Thin wrapper around the .chip CSS class
 * family in globals.css.
 *
 * Variants:
 *   default  — neutral pill (status, info)
 *   active   — accent border + accent-dim background (the drawer this
 *              chip belongs to is currently open)
 *   primary  — solid accent fill (the call-to-action chip, e.g. Optimize)
 *
 * Props:
 *   dot       — optional colored dot rendered before the children
 *               (passed as a CSS color string)
 *   onClick   — standard button onClick
 *   children  — chip label / icon group
 *
 * Usage:
 *   <Chip variant="active" onClick={...} dot="#10b981">
 *     <Icon name="heart-pulse" /> Plan health: Good
 *   </Chip>
 *   <Chip variant="primary" onClick={runOptimization}>
 *     <Icon name="bolt" /> Optimize
 *   </Chip>
 */
export default function Chip({
  children,
  variant = 'default',
  dot,
  className = '',
  ...rest
}) {
  const variantClass = variant === 'default' ? '' : `chip-${variant}`;
  const classes = ['chip', variantClass, className].filter(Boolean).join(' ');
  return (
    <button className={classes} {...rest}>
      {dot && <span className="chip-dot" style={{ background: dot }} />}
      {children}
    </button>
  );
}
