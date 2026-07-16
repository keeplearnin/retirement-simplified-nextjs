'use client';

/**
 * Icon — monoline SVG icon set. Hand-curated; ~12 icons covering the most
 * visible emoji-replacement sites (nav categories, chip bar, callouts).
 *
 * Visual brief: stroke 1.6, square 24×24 viewBox, currentColor — sits
 * happily next to text at any size. Use the `size` prop for the line-height
 * match (default 16 inline, 18 in nav, 22 in hero contexts).
 *
 * Why not an emoji: emoji renders differently across every OS and browser,
 * doesn't take currentColor, doesn't sit on a typography baseline, and
 * reads as "calculator app" rather than "considered product." (User
 * feedback from the latest design pass.)
 */
export default function Icon({ name, size = 16, color = 'currentColor', style }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style: { flexShrink: 0, verticalAlign: 'middle', ...style },
    'aria-hidden': true,
  };

  switch (name) {
    case 'chart':
      return (
        <svg {...props}>
          <path d="M3 3v18h18" />
          <path d="M7 14l3-3 4 4 6-7" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg {...props}>
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'book':
      return (
        <svg {...props}>
          <path d="M4 4.5A2.5 2.5 0 016.5 2H20v17H6.5A2.5 2.5 0 004 21.5V4.5z" />
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        </svg>
      );
    case 'heart-pulse':
      return (
        <svg {...props}>
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          <path d="M3.5 13h3l2-5 2 8 2-4h4" />
        </svg>
      );
    case 'lightbulb':
      return (
        <svg {...props}>
          <path d="M9 18h6M10 22h4" />
          <path d="M12 2a7 7 0 00-4 12.7c.6.5 1 1.2 1 2V18h6v-1.3c0-.8.4-1.5 1-2A7 7 0 0012 2z" />
        </svg>
      );
    case 'home':
      return (
        <svg {...props}>
          <path d="M3 11.5L12 4l9 7.5" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
    case 'bolt':
      return (
        <svg {...props}>
          <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 3v4M16 3v4" />
          <circle cx="8.5" cy="14" r="0.5" fill={color} />
          <circle cx="12" cy="14" r="0.5" fill={color} />
          <circle cx="15.5" cy="14" r="0.5" fill={color} />
        </svg>
      );
    case 'cog':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z" />
        </svg>
      );
    case 'chart-pie':
      return (
        <svg {...props}>
          <path d="M21 12A9 9 0 1112 3v9h9z" />
          <path d="M21 12A9 9 0 0012 3" />
        </svg>
      );
    case 'check':
      return (
        <svg {...props}>
          <path d="M5 12l5 5L20 7" />
        </svg>
      );
    case 'arrow-right':
      return (
        <svg {...props}>
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...props}>
          <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
        </svg>
      );
    case 'pencil':
      return (
        <svg {...props}>
          <path d="M17 3a2.8 2.8 0 014 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      );
    default:
      return null;
  }
}
