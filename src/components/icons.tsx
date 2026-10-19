// Animated line icons for the whole console. Each icon has its own small
// motion (the bell rings, bars grow, the scanner beam sweeps, ticks draw
// themselves), defined in globals.css under "Animated icons". An icon plays:
//   - when the pointer is over it or over its nearest `group` (a nav link, a card, a button),
//   - once when `play` turns on (e.g. the nav item becomes the current page),
//   - on repeat with `loop` (e.g. a bell with unread notifications),
//   - drawing itself in when shown, with `draw`.
// Reduced-motion settings switch all of it off (globals.css).

import type { CSSProperties, ReactNode, SVGProps } from "react";

// Every shape has pathLength 1, so "draw" animations work the same for any path.
const P = (p: SVGProps<SVGPathElement>) => <path pathLength={1} {...p} />;
const C = (p: SVGProps<SVGCircleElement>) => <circle pathLength={1} {...p} />;
const R = (p: SVGProps<SVGRectElement>) => <rect pathLength={1} {...p} />;

/** Stagger for parts that move one after another. */
const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const ICONS = {
  dashboard: {
    anim: "ai-tiles",
    body: (
      <>
        <R className="ai-tile" x="3.5" y="3.5" width="7" height="9" rx="1.6" />
        <R className="ai-tile" style={d(70)} x="13.5" y="3.5" width="7" height="5" rx="1.6" />
        <R className="ai-tile" style={d(140)} x="13.5" y="11.5" width="7" height="9" rx="1.6" />
        <R className="ai-tile" style={d(210)} x="3.5" y="15.5" width="7" height="5" rx="1.6" />
      </>
    ),
  },
  store: {
    anim: "ai-sway",
    body: (
      <>
        <g className="ai-awning">
          <P d="M3 9.5 4.7 4.5h14.6L21 9.5" />
          <P d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
        </g>
        <P d="M4.5 12.3V20h15v-7.7" />
        <P className="ai-door" d="M10 20v-4.5h4V20" />
      </>
    ),
  },
  users: {
    anim: "ai-users",
    body: (
      <>
        <C className="ai-head" cx="9" cy="8" r="3.3" />
        <P d="M3.5 19.5v-.7A4.8 4.8 0 0 1 8.3 14h1.4a4.8 4.8 0 0 1 4.8 4.8v.7" />
        <g className="ai-back">
          <P d="M15.8 4.9a3.3 3.3 0 0 1 0 6.2" />
          <P d="M17.6 14.2a4.6 4.6 0 0 1 2.9 4.3v1" />
        </g>
      </>
    ),
  },
  receipt: {
    anim: "ai-receipt",
    body: (
      <>
        <P d="M6 2.8h12v18.4l-3-1.9-3 1.9-3-1.9-3 1.9z" />
        <P className="ai-line" d="M9 7.5h6" />
        <P className="ai-line" style={d(90)} d="M9 11h6" />
        <P className="ai-line" style={d(180)} d="M9 14.5h3.5" />
      </>
    ),
  },
  plusSquare: {
    anim: "ai-plusbox",
    body: (
      <>
        <R x="3.5" y="3.5" width="17" height="17" rx="3.5" />
        <P className="ai-plus" d="M12 8.2v7.6M8.2 12h7.6" />
      </>
    ),
  },
  shieldCheck: {
    anim: "ai-checkmark",
    body: (
      <>
        <P d="M12 3 4.5 6v5.6c0 4.5 3.2 8.2 7.5 9.4 4.3-1.2 7.5-4.9 7.5-9.4V6z" />
        <P className="ai-tick" d="m8.8 12.1 2.3 2.3 4.3-4.6" />
      </>
    ),
  },
  book: {
    anim: "ai-book",
    body: (
      <>
        <P d="M5 19V5.2A2.2 2.2 0 0 1 7.2 3H19v15H7.2A2.2 2.2 0 0 0 5 20.2 1.8 1.8 0 0 0 6.8 22H19v-4" />
        <P className="ai-page" d="M9 7.5h6.5" />
        <P className="ai-page" style={d(110)} d="M9 11h4.5" />
      </>
    ),
  },
  scan: {
    anim: "ai-scan",
    body: (
      <>
        <g className="ai-corners">
          <P d="M3.5 8V5.5a2 2 0 0 1 2-2H8" />
          <P d="M16 3.5h2.5a2 2 0 0 1 2 2V8" />
          <P d="M20.5 16v2.5a2 2 0 0 1-2 2H16" />
          <P d="M8 20.5H5.5a2 2 0 0 1-2-2V16" />
        </g>
        <R x="7.5" y="7.5" width="3.4" height="3.4" rx=".6" />
        <R x="13.1" y="7.5" width="3.4" height="3.4" rx=".6" />
        <R x="7.5" y="13.1" width="3.4" height="3.4" rx=".6" />
        <P d="M13.1 13.1h1.6v1.6M16.5 16.5V15" />
        <P className="ai-beam" d="M2.5 12h19" />
      </>
    ),
  },
  box: {
    anim: "ai-box",
    body: (
      <>
        <P className="ai-lid" d="M3.5 7.5 12 3l8.5 4.5L12 12z" />
        <P d="M3.5 7.5v9L12 21l8.5-4.5v-9M12 12v9" />
      </>
    ),
  },
  chart: {
    anim: "ai-chart",
    body: (
      <>
        <P d="M3 20.5h18" />
        <P className="ai-bar" strokeWidth="2.4" d="M6 20.5v-6" />
        <P className="ai-bar" style={d(80)} strokeWidth="2.4" d="M10.3 20.5V9" />
        <P className="ai-bar" style={d(160)} strokeWidth="2.4" d="M14.6 20.5V12.5" />
        <P className="ai-bar" style={d(240)} strokeWidth="2.4" d="M18.9 20.5V5.5" />
      </>
    ),
  },
  bell: {
    anim: "ai-bell",
    body: (
      <>
        <P d="M6 9.2a6 6 0 1 1 12 0c0 6.3 2.5 7.8 2.5 7.8h-17S6 15.5 6 9.2" />
        <P className="ai-clapper" d="M10 20.3a2.1 2.1 0 0 0 4 0" />
      </>
    ),
  },
  user: {
    anim: "ai-user",
    body: (
      <>
        <C className="ai-head" cx="12" cy="8" r="4" />
        <P d="M4.5 20.5v-.8a5 5 0 0 1 5-5h5a5 5 0 0 1 5 5v.8" />
      </>
    ),
  },
  menu: {
    anim: "ai-menu",
    body: (
      <>
        <P className="ai-l" d="M4 6.5h16" />
        <P className="ai-l" style={d(70)} d="M4 12h16" />
        <P className="ai-l" style={d(140)} d="M4 17.5h16" />
      </>
    ),
  },
  close: { anim: "ai-turn", body: <P d="M6 6l12 12M18 6 6 18" /> },
  plus: { anim: "ai-turn", body: <P d="M12 5v14M5 12h14" /> },
  search: {
    anim: "ai-search",
    body: (
      <>
        <C cx="11" cy="11" r="6.5" />
        <P d="m20 20-4.2-4.2" />
      </>
    ),
  },
  chevronsUpDown: {
    anim: "ai-updown",
    body: (
      <>
        <P className="ai-up" d="m7.5 9.5 4.5-4.5 4.5 4.5" />
        <P className="ai-down" d="m7.5 14.5 4.5 4.5 4.5-4.5" />
      </>
    ),
  },
  camera: {
    anim: "ai-camera",
    body: (
      <>
        <P d="M3.5 8.6A1.6 1.6 0 0 1 5.1 7h2.1l1.6-2.5h6.4L16.8 7h2.1a1.6 1.6 0 0 1 1.6 1.6v8.8a1.6 1.6 0 0 1-1.6 1.6H5.1a1.6 1.6 0 0 1-1.6-1.6z" />
        <C className="ai-lens" cx="12" cy="12.8" r="3.4" />
      </>
    ),
  },
  pin: {
    anim: "ai-bounce",
    body: (
      <>
        <P d="M12 21s-6.5-6.1-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.9 12 21 12 21z" />
        <C cx="12" cy="9.8" r="2.3" />
      </>
    ),
  },
  calendar: {
    anim: "ai-calendar",
    body: (
      <>
        <R x="3.5" y="5" width="17" height="15.5" rx="2.2" />
        <P d="M3.5 10h17" />
        <P className="ai-ring" d="M8 3v4M16 3v4" />
        <P className="ai-dot" strokeWidth="2.6" d="M8 14h.01" />
        <P className="ai-dot" style={d(80)} strokeWidth="2.6" d="M12 14h.01" />
        <P className="ai-dot" style={d(160)} strokeWidth="2.6" d="M16 14h.01" />
      </>
    ),
  },
  check: { anim: "ai-checkmark", body: <P className="ai-tick" d="m5 12.5 4.5 4.5L19 7.5" /> },
  checkCircle: {
    anim: "ai-checkmark",
    body: (
      <>
        <C cx="12" cy="12" r="9" />
        <P className="ai-tick" d="m8 12.3 2.8 2.8 5.4-5.6" />
      </>
    ),
  },
  xCircle: {
    anim: "ai-shake",
    body: (
      <>
        <C cx="12" cy="12" r="9" />
        <P d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
      </>
    ),
  },
  x: { anim: "ai-shake", body: <P d="M6.5 6.5l11 11M17.5 6.5l-11 11" /> },
  hourglass: {
    anim: "ai-hourglass",
    body: (
      <>
        <P d="M6.5 3.5h11M6.5 20.5h11" />
        <P d="M7.5 3.5c0 4 4.5 5.4 4.5 8.5s-4.5 4.5-4.5 8.5M16.5 3.5c0 4-4.5 5.4-4.5 8.5s4.5 4.5 4.5 8.5" />
        <P className="ai-sand" d="M10 18.4h4" />
      </>
    ),
  },
  cart: {
    anim: "ai-cart",
    body: (
      <>
        <P d="M3 4h2.2l2.3 11.1a1.6 1.6 0 0 0 1.6 1.3h8.2a1.6 1.6 0 0 0 1.6-1.2L20.6 8H6.3" />
        <C className="ai-wheel" cx="9.6" cy="20" r="1.3" />
        <C className="ai-wheel" cx="17" cy="20" r="1.3" />
      </>
    ),
  },
  gift: {
    anim: "ai-gift",
    body: (
      <>
        <P d="M4.5 11h15v9.5h-15zM12 11v9.5" />
        <g className="ai-lid">
          <R x="3.5" y="7.5" width="17" height="3.5" rx="1" />
          <P d="M12 7.5s-2.5-4.5-4.5-3.3S9 7.5 12 7.5zm0 0s2.5-4.5 4.5-3.3S15 7.5 12 7.5z" />
        </g>
      </>
    ),
  },
  ticket: {
    anim: "ai-tilt",
    body: (
      <>
        <P d="M3.5 7.6A1.6 1.6 0 0 1 5.1 6h13.8a1.6 1.6 0 0 1 1.6 1.6V10a2 2 0 0 0 0 4v2.4a1.6 1.6 0 0 1-1.6 1.6H5.1a1.6 1.6 0 0 1-1.6-1.6V14a2 2 0 0 0 0-4z" />
        <P d="M14.5 6.5v1.8M14.5 11.1v1.8M14.5 15.7v1.8" />
      </>
    ),
  },
  cash: {
    anim: "ai-cash",
    body: (
      <>
        <R x="2.8" y="6.5" width="18.4" height="11" rx="2.2" />
        <C className="ai-coin" cx="12" cy="12" r="2.6" />
        <P strokeWidth="2.4" d="M6.4 9.6h.01M17.6 14.4h.01" />
      </>
    ),
  },
  bank: {
    anim: "ai-bank",
    body: (
      <>
        <P d="M3.5 9.5 12 4.5l8.5 5zM3.5 20.5h17" />
        <P className="ai-col" d="M6.5 11.5v6.5" />
        <P className="ai-col" style={d(70)} d="M10.2 11.5v6.5" />
        <P className="ai-col" style={d(140)} d="M13.8 11.5v6.5" />
        <P className="ai-col" style={d(210)} d="M17.5 11.5v6.5" />
      </>
    ),
  },
  mail: {
    anim: "ai-mail",
    body: (
      <>
        <R x="3.5" y="5.5" width="17" height="13" rx="2.2" />
        <P className="ai-flap" d="m4.2 7 7.8 6 7.8-6" />
      </>
    ),
  },
  sparkles: {
    anim: "ai-sparkles",
    body: (
      <>
        <P className="ai-star" d="M11 4.5 12.6 9.4 17.5 11 12.6 12.6 11 17.5 9.4 12.6 4.5 11 9.4 9.4z" />
        <P className="ai-star" style={d(140)} d="M19 3v3.6M17.2 4.8h3.6" />
        <P className="ai-star" style={d(260)} d="M18.5 16.5v3.6M16.7 18.3h3.6" />
      </>
    ),
  },
  globe: {
    anim: "ai-globe",
    body: (
      <>
        <C cx="12" cy="12" r="9" />
        <P d="M3 12h18" />
        <ellipse className="ai-meridian" pathLength={1} cx="12" cy="12" rx="4" ry="9" />
      </>
    ),
  },
  home: {
    anim: "ai-bounce",
    body: (
      <>
        <P d="M3.5 11 12 4l8.5 7" />
        <P d="M5.8 9.4V20h12.4V9.4" />
        <P d="M10 20v-5h4v5" />
      </>
    ),
  },
  verified: {
    anim: "ai-verified",
    body: (
      <>
        <polygon className="ai-seal" pathLength={1} points="12,2.8 14.83,5.16 18.51,5.49 18.84,9.17 21.2,12 18.84,14.83 18.51,18.51 14.83,18.84 12,21.2 9.17,18.84 5.49,18.51 5.16,14.83 2.8,12 5.16,9.17 5.49,5.49 9.17,5.16" />
        <P className="ai-tick" d="m8.7 12.1 2.3 2.3 4.3-4.6" />
      </>
    ),
  },
} satisfies Record<string, { anim: string; body: ReactNode }>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  className = "size-5",
  play,
  loop,
  draw,
  title,
  strokeWidth = 1.8,
}: {
  name: IconName;
  className?: string;
  /** Play once when this turns true (e.g. the current page's nav item). */
  play?: boolean;
  /** Keep playing, with a pause between rounds. */
  loop?: boolean;
  /** Draw the lines in when the icon appears. */
  draw?: boolean;
  /** Read out by screen readers; without it the icon is decorative. */
  title?: string;
  strokeWidth?: number;
}) {
  const icon = ICONS[name];
  return (
    <svg
      className={`ai ${icon.anim} ${className} shrink-0`}
      data-play={play || undefined}
      data-loop={loop || undefined}
      data-draw={draw || undefined}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {icon.body}
    </svg>
  );
}
