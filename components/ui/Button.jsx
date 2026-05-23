'use client';

/**
 * Button — design-system primitive. Thin wrapper around the .btn CSS
 * class family in globals.css.
 *
 * Variants:
 *   primary    — accent fill, the call-to-action. One per surface.
 *   secondary  — neutral background, the default actionable button.
 *   ghost      — no background until hover. For inline / quiet actions.
 *   outline    — accent outline only. "Refresh" / secondary primary.
 *   danger     — for destructive actions.
 *
 * Sizes: sm (compact) · md (default) · lg (hero CTA)
 *
 * Pass `icon` as a React node to render alongside the label.
 *
 * Usage:
 *   <Button variant="primary" onClick={runOptimization}>Optimize</Button>
 *   <Button variant="ghost" size="sm" icon={<Icon name="cog" />}>Settings</Button>
 */
export default function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  className = '',
  ...rest
}) {
  const classes = ['btn', `btn-${size}`, `btn-${variant}`, className]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={classes} {...rest}>
      {icon}
      {children}
    </button>
  );
}
