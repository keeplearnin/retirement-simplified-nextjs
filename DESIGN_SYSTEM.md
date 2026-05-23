# Design System

Retire.Simplified's visual + component vocabulary. Started as an answer to the design-review feedback "the site looks like a basic calculator" — the root cause was inline styles everywhere with no consistent design tokens.

## Status

| Layer | Status |
|-------|--------|
| Design tokens (color, type, space, radii, shadow, motion) | ✅ Shipped — see `app/globals.css` |
| Primitives (`Button`, `Chip`, `Drawer`, `Card`, `Stat`, `Icon`) | 🟡 6 of ~12 — see `components/ui/` |
| Migration (replace inline styles in tabs) | 🟡 AIAdvisor chip bar migrated; rest pending |
| Homepage / hero | 🔴 Deferred to Level C+ |

The migration is **incremental**. Old inline-styled buttons still work. New code (and refactored components) use the primitives. No big-bang rewrite.

---

## Tokens

All defined in `app/globals.css` under `:root` / `[data-theme="light"]`. Use the CSS variable, not the literal value.

### Color
```
--bg, --bg2, --card, --card-hover   Surfaces
--accent, --accent-dim, --accent-glow   Brand green
--warn, --warn-dim                  Yellow status
--danger, --danger-dim              Red status
--blue, --purple                    Decorative
--heading, --text, --text-muted, --text-dim   Typography
--border, --border-light            Hairlines
--glass, --glass-border             Frosted overlays
```

### Typography
Scale: 1.125 ratio (major second), anchored at 13px body.
```
--text-xs   11px    Labels, captions
--text-sm   12px    Secondary text
--text-base 13px    Body
--text-md   14px    Default UI
--text-lg   16px    Emphasized body
--text-xl   20px    Section headings
--text-2xl  24px    Page headings
--text-3xl  32px    Hero numbers
--text-4xl  44px    Signature numbers (portfolio value)
```
Weights: `--fw-regular` 400 · `--fw-medium` 500 · `--fw-semi` 600 · `--fw-bold` 700 · `--fw-black` 800

Family: `--serif` (DM Sans display) · `--sans` (Inter UI)

Use **tabular-nums** for any number that will animate or compare — keeps digits from jittering sideways.

### Spacing
4pt base, 8pt is the dominant rhythm.
```
--space-1  4px
--space-2  8px
--space-3  12px
--space-4  16px
--space-5  20px
--space-6  24px
--space-8  32px
--space-10 40px
--space-12 48px
--space-16 64px
```

### Radii
```
--radius-xs   6px    Small chips, inline elements
--radius-sm   10px   Buttons, drawers
--radius      14px   Cards (default)
--radius-lg   18px   Hero cards
--radius-pill 999px  Pills, status chips
```

### Shadows
```
--shadow-sm    Subtle hairline depth
--shadow-md    Default card / drawer elevation
--shadow-lg    Modals, dialogs
--shadow-glow  Accent-colored glow on hover for the primary CTA
```

### Motion
```
--motion-fast   150ms   Hovers, focus rings
--motion-base   250ms   State changes, drawer open
--motion-slow   500ms   Entrances, reveals

--ease-out      cubic-bezier(0.22, 0.61, 0.36, 1)   Standard
--ease-in-out   cubic-bezier(0.65, 0, 0.35, 1)      Bidirectional
--ease-spring   cubic-bezier(0.34, 1.56, 0.64, 1)   Bouncy (for celebrations)
```

Respect `prefers-reduced-motion` — `AnimatedNumber` already does.

### Z-index
```
--z-base       1
--z-dropdown   100
--z-drawer     200
--z-modal      300
--z-toast      1000
```

---

## Primitives

### `<Button>` (`components/ui/Button.jsx`)

```jsx
<Button variant="primary" size="md" icon={<Icon name="bolt" />} onClick={...}>
  Optimize
</Button>
```

Variants: `primary` · `secondary` · `ghost` · `outline` · `danger`
Sizes: `sm` · `md` · `lg`

CSS: `.btn`, `.btn-{size}`, `.btn-{variant}`

### `<Chip>` (`components/ui/Chip.jsx`)

The status pill used in the AI Advisor chip bar.

```jsx
<Chip variant="active" dot="#10b981" onClick={...}>
  <Icon name="heart-pulse" /> Plan health: Good
</Chip>
```

Variants: `default` · `active` (drawer is open) · `primary` (CTA)

CSS: `.chip`, `.chip-active`, `.chip-primary`, `.chip-dot`

### `<Drawer>` (`components/ui/Drawer.jsx`)

The expandable panel below the chip bar (Plan Health, Insights, Optimize, etc.). Animated slide-in.

```jsx
<Drawer title="Optimization Report" onClose={() => setActivePanel(null)}>
  {content}
</Drawer>
```

CSS: `.drawer`, `.drawer-header`, `.drawer-title`, `.drawer-close`, `.drawer-body`

### `<Icon>` (`components/ui/Icon.jsx`)

Monoline SVG icons. 12 names: `chart`, `sparkles`, `book`, `heart-pulse`, `lightbulb`, `home`, `bolt`, `calendar`, `cog`, `chart-pie`, `check`, `arrow-right`.

```jsx
<Icon name="bolt" size={14} />
```

`color` defaults to `currentColor` — inherits from parent text color.

### `<AnimatedNumber>` (`components/ui/AnimatedNumber.jsx`)

Counts smoothly between successive `value` props. easeOutCubic, 600ms default. Respects `prefers-reduced-motion`.

```jsx
<AnimatedNumber value={portfolioAtRetire} format={(v) => fmt(v)} />
```

### `<SequencedLoader>` (`components/ui/SequencedLoader.jsx`)

Cycles through loading messages with a pulsing dot. Used during agent calls.

```jsx
<SequencedLoader messages={['Reading plan…', 'Modeling tax…', '…']} />
```

### `<Card>` (`components/ui/Card.jsx`)
*(pre-existing — audit for token consistency)*

### `<Stat>` (`components/ui/Stat.jsx`)
*(pre-existing — audit for token consistency)*

---

## Migration guide

Old inline style:
```jsx
<button
  style={{
    padding: '8px 16px',
    background: 'var(--accent)',
    color: 'var(--bg)',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
  }}
  onClick={onClick}
>
  Save
</button>
```

New:
```jsx
<Button variant="primary" size="md" onClick={onClick}>Save</Button>
```

When migrating:
1. Look for repeated style blobs — if a pattern appears 3+ times, it should be a primitive.
2. Replace pixel values with token variables (`var(--space-3)` not `12px`).
3. Use `:hover` / `:focus-visible` via CSS classes, not inline `onMouseEnter` handlers.
4. Animations go through `--motion-*` and `--ease-*` tokens.
5. Test in both `[data-theme="dark"]` and `[data-theme="light"]`.

---

## What's left

Next sessions, in priority order:

1. **Migrate AIAdvisor drawer headers** to `<Drawer>` (~15 of 7 panels currently inline)
2. **Migrate Apply buttons + toast** in AIAdvisor to `<Button>`
3. **Audit + extend `<Card>` and `<Stat>`** to use tokens
4. **Add `<NumberDisplay>` primitive** for big hero numbers (composes `AnimatedNumber` + token typography + currency formatting)
5. **Migrate My Plan collapsibles** (separate from this design system but uses the tokens)
6. **Migrate the Optimize / Roth Strategy / Retirement Income tabs**
7. **Build a `<Hero>` and homepage** at `/`
8. **Add `<Sparkline>` and `<Donut>` data-viz primitives** for the hero numbers

Each is a separate commit. No big-bang.
