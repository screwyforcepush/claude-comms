import { useState, useEffect, useRef } from "react";

/*
  CRANKSHAFT v3 — QUAKE EDITION BRAND KIT
  
  Aesthetic pillars drawn from id Software's Quake (1996):
  - "Nine Inch Nails palette" — copper, runic metal, industrial brown (American McGee's term)
  - Lovecraftian otherworldliness — Shub-Niggurath, slipgates, elder dimensions
  - 256-color constrained palette — heavy browns/coppers, limited fullbright accent colors
  - Trent Reznor sound design influence — "textures and ambiences and whirling machine noises"
  - Riveted metal HUD statusbar, torchlit stone corridors, lava/slime pools
*/

// =============================================================
//  Q — COLOR PALETTE
//  The single source of truth for all color values.
// =============================================================
const Q = {
  void0: "#060504",      void1: "#0c0a07",
  stone0: "#16120d",     stone1: "#1e1813",     stone2: "#28211a",     stone3: "#342a20",
  copper0: "#5c3a1e",    copper1: "#7a4e28",    copper2: "#946232",    copper3: "#b07840",
  torch: "#d4a030",      torchHot: "#e8b840",
  lava0: "#8c2814",      lava1: "#c43818",
  slime0: "#2c5418",     slime1: "#3c7420",
  teleport: "#5c3c7c",   teleportBright: "#7c58a0",
  blood: "#7c1c10",
  bone0: "#6c6454",      bone1: "#908474",      bone2: "#b4a890",      bone3: "#d0c4a8",      bone4: "#e4dcc4",
  iron0: "#3c3830",      iron1: "#504c40",      iron2: "#686050",
};

// =============================================================
//  FONT — TYPEFACE STACK
// =============================================================
const FONT = {
  display: "'Silkscreen', monospace",
  console: "'IBM Plex Mono', monospace",
  body: "'Chakra Petch', sans-serif",
};

// =============================================================
//  T — DESIGN TOKENS
//  Every magic number lives here. Components reference T, not
//  raw values. The Tokens section renders this object live.
// =============================================================
const T = {
  // --- BORDER ---
  border: {
    radius: 0,                          // 0px always. This is Quake.
    width: { standard: 1, depth: 2 },   // 1px normal, 2px bottom for pressed-metal depth
    color: { default: Q.stone3, subtle: `${Q.iron1}33`, abyss: Q.void0 },
  },

  // --- SPACING ---
  space: {
    unit: 4,                            // base grid = 4px
    xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24,
    section: 72,                        // gap between showcase sections
    page: { x: 44, top: 48, bottom: 96 },
  },

  // --- TYPOGRAPHY ---
  type: {
    size: {
      hero: 36, title: 24, heading: 16, subheading: 14,
      body: 14, bodySmall: 13,
      label: 10, labelSmall: 9, badge: 8, micro: 7,
      stat: 28, statMedium: 20, statSmall: 12,
      console: 11, consoleCommand: 15,
    },
    tracking: {                         // letter-spacing in px
      tight: 1, normal: 2, wide: 3, xwide: 4, hero: 6,
    },
    leading: {                          // line-height multiplier
      tight: 1, snug: 1.2, normal: 1.5, relaxed: 1.7, loose: 1.8, consoleLine: 1.9,
    },
    weight: { light: 300, regular: 400, medium: 500, semi: 600 },
  },

  // --- ANIMATION ---
  anim: {
    transition: { fast: "0.1s", normal: "0.15s", slow: "0.2s" },
    meter: { duration: "0.5s", easing: "ease" },
    scanline: { speed: 0.4 },          // px per animation frame
    flicker: { duration: "6s", keyframes: "91%-92%: 0.85 → 93%: 1 → 96%: 0.92 → 97%: 1" },
    pulse: { duration: "2.5s", easing: "ease-in-out" },
    cursor: { duration: "1s" },
    hoverLift: "-1px",
    pressDepth: "1px",
  },

  // --- EFFECTS ---
  fx: {
    grain: { opacity: 0.7, blend: "overlay", intensity: 25, alpha: 35 },
    glow: {
      sm: 6, md: 12, lg: 20, xl: 30,  // px blur radius
      fbMultiplier: [1, 2],             // fullbright: 1x + 2x size glow layers
    },
    surface: {
      gridSize: 64,                     // px between grid lines on CopperTexture
      gridOpacity: { vertical: "40", horizontal: "30" },  // hex alpha
    },
    rivet: { size: 2, offset: 8 },     // px: dot radius, distance from edge
    scanline: { height: 1, tint: Q.copper1, alpha: "06" },
  },

  // --- BUTTONS ---
  button: {
    sizes: {
      sm: { px: 10, py: 5, fs: 10 },
      md: { px: 16, py: 8, fs: 12 },
      lg: { px: 24, py: 12, fs: 14 },
    },
    disabledOpacity: 0.4,
  },

  // --- STATUS BAR ---
  bar: {
    height: { health: 6, meter: 10 },
    tickMarks: [25, 50, 75],            // percentage positions
    scanlineGap: 2,                     // px between scanline stripes
  },

  // --- ICONOGRAPHY ---
  icon: {
    size: { xs: 14, sm: 18, md: 24, lg: 32, xl: 48 },
    stroke: { thin: 1.5, normal: 2, bold: 2.5 },
    viewBox: "0 0 24 24",              // standard viewbox
  },

  // --- SEMANTIC COLORS (derived from Q) ---
  semantic: {
    success: Q.slime1,    successDark: Q.slime0,
    danger: Q.lava1,      dangerDark: Q.lava0,
    warning: Q.torch,
    info: Q.copper3,
    highlight: Q.torchHot,
    special: Q.teleportBright,
  },
};


// =============================================================
//  SURFACE PRIMITIVES
// =============================================================

const CopperTexture = ({ children, style, variant = "dark", ...props }) => {
  const variants = {
    dark:   { bg: Q.stone1, border: Q.stone3, hl: `${Q.copper0}30` },
    medium: { bg: Q.stone2, border: Q.iron0,  hl: `${Q.copper1}20` },
    raised: { bg: Q.stone3, border: Q.iron1,  hl: `${Q.copper0}15` },
  };
  const v = variants[variant];
  const gs = T.fx.surface.gridSize;
  return (
    <div style={{
      background: `
        repeating-linear-gradient(90deg,transparent 0px,transparent ${gs-1}px,${Q.stone0}${T.fx.surface.gridOpacity.vertical} ${gs-1}px,${Q.stone0}${T.fx.surface.gridOpacity.vertical} ${gs}px),
        repeating-linear-gradient(0deg,transparent 0px,transparent ${gs-1}px,${Q.stone0}${T.fx.surface.gridOpacity.horizontal} ${gs-1}px,${Q.stone0}${T.fx.surface.gridOpacity.horizontal} ${gs}px),
        linear-gradient(180deg, ${v.hl}, transparent ${T.border.width.depth}px),
        linear-gradient(135deg, ${v.bg} 0%, ${Q.void1} 100%)
      `,
      border: `${T.border.width.standard}px solid ${v.border}`,
      borderTop: `${T.border.width.standard}px solid ${Q.iron1}44`,
      borderRadius: T.border.radius,
      position: "relative",
      ...style,
    }} {...props}>{children}</div>
  );
};

const RivetedPanel = ({ children, style, glow, ...props }) => {
  const rs = T.fx.rivet.size;
  const ro = T.fx.rivet.offset;
  return (
    <div style={{
      background: `
        radial-gradient(circle at ${ro}px ${ro}px, ${Q.iron0} ${rs}px, transparent ${rs}px),
        radial-gradient(circle at calc(100% - ${ro}px) ${ro}px, ${Q.iron0} ${rs}px, transparent ${rs}px),
        radial-gradient(circle at ${ro}px calc(100% - ${ro}px), ${Q.iron0} ${rs}px, transparent ${rs}px),
        radial-gradient(circle at calc(100% - ${ro}px) calc(100% - ${ro}px), ${Q.iron0} ${rs}px, transparent ${rs}px),
        linear-gradient(180deg, ${Q.stone2} 0%, ${Q.stone1} 100%)
      `,
      border: `${T.border.width.standard}px solid ${T.border.color.default}`,
      borderTop: `${T.border.width.standard}px solid ${T.border.color.subtle}`,
      borderBottom: `${T.border.width.standard}px solid ${T.border.color.abyss}`,
      borderRadius: T.border.radius,
      boxShadow: glow
        ? `inset 0 0 ${T.fx.glow.xl}px ${glow}08, 0 0 ${T.fx.glow.lg}px ${glow}10`
        : `inset 0 1px 0 ${Q.iron1}15`,
      position: "relative",
      ...style,
    }} {...props}>{children}</div>
  );
};


// =============================================================
//  QUAKE SYMBOL (horseshoe + nail)
// =============================================================
const QuakeSymbol = ({ size = 28, color = Q.copper3, glow = false }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    {glow && <defs><filter id="qglow"><feGaussianBlur stdDeviation="1.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>}
    <g filter={glow ? "url(#qglow)" : undefined}>
      <path d="M8 26 C4 20, 4 10, 16 4 C28 10, 28 20, 24 26" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <line x1="16" y1="14" x2="16" y2="30" stroke={color} strokeWidth="2" />
      <rect x="13" y="12" width="6" height="3" rx="0.5" fill={color} />
    </g>
  </svg>
);


// =============================================================
//  ICON SYSTEM — QIcon
//  All icons share a 24x24 viewBox, stroke-based, no fills
//  unless explicitly needed. Designed for the runic/medieval
//  Quake aesthetic — angular, sharp, no rounded corners.
// =============================================================
const ICON_PATHS = {
  // --- Navigation & Routing ---
  slipgate: (sw) => (
    <>
      <ellipse cx="12" cy="12" rx="7" ry="10" stroke="currentColor" strokeWidth={sw} fill="none" />
      <ellipse cx="12" cy="12" rx="3" ry="6" stroke="currentColor" strokeWidth={sw * 0.7} fill="none" opacity="0.5" />
      <line x1="12" y1="2" x2="12" y2="4" stroke="currentColor" strokeWidth={sw} />
      <line x1="12" y1="20" x2="12" y2="22" stroke="currentColor" strokeWidth={sw} />
    </>
  ),
  route: (sw) => (
    <>
      <polyline points="4,12 8,6 16,18 20,12" stroke="currentColor" strokeWidth={sw} fill="none" strokeLinejoin="miter" />
      <circle cx="4" cy="12" r="1.5" fill="currentColor" />
      <circle cx="20" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  dispatch: (sw) => (
    <>
      <path d="M4 12h12" stroke="currentColor" strokeWidth={sw} />
      <path d="M14 7l6 5-6 5" stroke="currentColor" strokeWidth={sw} fill="none" strokeLinejoin="miter" />
    </>
  ),

  // --- Weapons / Actions ---
  axe: (sw) => (
    <>
      <line x1="6" y1="18" x2="18" y2="6" stroke="currentColor" strokeWidth={sw} />
      <path d="M14 4 L20 4 L20 10 L17 8 L16 7Z" stroke="currentColor" strokeWidth={sw * 0.7} fill="currentColor" opacity="0.7" />
    </>
  ),
  nailgun: (sw) => (
    <>
      <rect x="6" y="9" width="12" height="6" stroke="currentColor" strokeWidth={sw} fill="none" />
      <line x1="18" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth={sw} />
      <line x1="10" y1="9" x2="10" y2="15" stroke="currentColor" strokeWidth={sw * 0.7} />
      <line x1="14" y1="9" x2="14" y2="15" stroke="currentColor" strokeWidth={sw * 0.7} />
      <rect x="2" y="10" width="4" height="4" stroke="currentColor" strokeWidth={sw * 0.7} fill="none" />
    </>
  ),
  rocket: (sw) => (
    <>
      <path d="M12 3 L16 10 L14 10 L14 19 L10 19 L10 10 L8 10Z" stroke="currentColor" strokeWidth={sw} fill="none" strokeLinejoin="miter" />
      <line x1="10" y1="19" x2="8" y2="22" stroke="currentColor" strokeWidth={sw * 0.7} />
      <line x1="14" y1="19" x2="16" y2="22" stroke="currentColor" strokeWidth={sw * 0.7} />
      <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth={sw * 0.7} />
    </>
  ),
  lightning: (sw) => (
    <path d="M13 2 L8 11 L12 11 L11 22 L16 13 L12 13Z" stroke="currentColor" strokeWidth={sw} fill="none" strokeLinejoin="miter" />
  ),

  // --- Status / HUD ---
  health: (sw) => (
    <>
      <rect x="4" y="4" width="16" height="16" stroke="currentColor" strokeWidth={sw} fill="none" />
      <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth={sw + 0.5} />
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth={sw + 0.5} />
    </>
  ),
  armor: (sw) => (
    <path d="M12 3 L4 7 L4 13 C4 17 7 20 12 22 C17 20 20 17 20 13 L20 7Z" stroke="currentColor" strokeWidth={sw} fill="none" strokeLinejoin="miter" />
  ),
  skull: (sw) => (
    <>
      <path d="M6 14 C6 7, 18 7, 18 14 L18 16 L15 16 L14 18 L10 18 L9 16 L6 16Z" stroke="currentColor" strokeWidth={sw} fill="none" />
      <circle cx="10" cy="12" r="1.5" fill="currentColor" />
      <circle cx="14" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  pentagram: (sw) => {
    const pts = [0,1,2,3,4].map(i => {
      const a = (i * 72 - 90) * Math.PI / 180;
      return [12 + 9 * Math.cos(a), 12 + 9 * Math.sin(a)];
    });
    const order = [0,2,4,1,3,0];
    const d = order.map((idx, i) => `${i === 0 ? "M" : "L"}${pts[idx][0].toFixed(1)},${pts[idx][1].toFixed(1)}`).join(" ") + "Z";
    return <path d={d} stroke="currentColor" strokeWidth={sw} fill="none" strokeLinejoin="miter" />;
  },

  // --- Keys & Access ---
  keyGold: (sw) => (
    <>
      <circle cx="8" cy="8" r="4" stroke="currentColor" strokeWidth={sw} fill="none" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" opacity="0.4" />
      <line x1="12" y1="8" x2="20" y2="8" stroke="currentColor" strokeWidth={sw} />
      <line x1="18" y1="8" x2="18" y2="12" stroke="currentColor" strokeWidth={sw} />
      <line x1="15" y1="8" x2="15" y2="11" stroke="currentColor" strokeWidth={sw * 0.7} />
    </>
  ),
  rune: (sw) => (
    <>
      <rect x="5" y="3" width="14" height="18" stroke="currentColor" strokeWidth={sw} fill="none" />
      <path d="M9 7 L12 10 L15 7" stroke="currentColor" strokeWidth={sw * 0.8} fill="none" />
      <line x1="12" y1="10" x2="12" y2="17" stroke="currentColor" strokeWidth={sw * 0.8} />
      <line x1="9" y1="14" x2="15" y2="14" stroke="currentColor" strokeWidth={sw * 0.8} />
    </>
  ),

  // --- System UI ---
  eye: (sw) => (
    <>
      <path d="M2 12 C5 7, 19 7, 22 12 C19 17, 5 17, 2 12Z" stroke="currentColor" strokeWidth={sw} fill="none" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={sw} fill="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </>
  ),
  search: (sw) => (
    <>
      <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth={sw} fill="none" />
      <line x1="15" y1="15" x2="21" y2="21" stroke="currentColor" strokeWidth={sw + 0.5} />
    </>
  ),
  config: (sw) => (
    <>
      <rect x="4" y="4" width="16" height="16" stroke="currentColor" strokeWidth={sw} fill="none" />
      <line x1="8" y1="4" x2="8" y2="20" stroke="currentColor" strokeWidth={sw * 0.6} opacity="0.4" />
      <line x1="16" y1="4" x2="16" y2="20" stroke="currentColor" strokeWidth={sw * 0.6} opacity="0.4" />
      <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" strokeWidth={sw * 0.6} opacity="0.4" />
      <line x1="4" y1="16" x2="20" y2="16" stroke="currentColor" strokeWidth={sw * 0.6} opacity="0.4" />
      <rect x="10" y="10" width="4" height="4" fill="currentColor" opacity="0.6" />
    </>
  ),
  add: (sw) => (
    <>
      <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth={sw} />
      <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth={sw} />
    </>
  ),
  close: (sw) => (
    <>
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth={sw} />
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth={sw} />
    </>
  ),
  check: (sw) => (
    <polyline points="5,13 10,18 19,6" stroke="currentColor" strokeWidth={sw} fill="none" strokeLinejoin="miter" />
  ),
  warning: (sw) => (
    <>
      <path d="M12 3 L2 21 L22 21Z" stroke="currentColor" strokeWidth={sw} fill="none" strokeLinejoin="miter" />
      <line x1="12" y1="10" x2="12" y2="15" stroke="currentColor" strokeWidth={sw} />
      <rect x="11" y="17" width="2" height="2" fill="currentColor" />
    </>
  ),
  info: (sw) => (
    <>
      <rect x="4" y="4" width="16" height="16" stroke="currentColor" strokeWidth={sw} fill="none" />
      <rect x="11" y="6" width="2" height="2" fill="currentColor" />
      <line x1="12" y1="10" x2="12" y2="18" stroke="currentColor" strokeWidth={sw} />
    </>
  ),
  chevronRight: (sw) => (
    <polyline points="9,4 17,12 9,20" stroke="currentColor" strokeWidth={sw} fill="none" strokeLinejoin="miter" />
  ),
  chevronDown: (sw) => (
    <polyline points="4,9 12,17 20,9" stroke="currentColor" strokeWidth={sw} fill="none" strokeLinejoin="miter" />
  ),
  menu: (sw) => (
    <>
      <line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth={sw} />
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth={sw} />
      <line x1="4" y1="17" x2="20" y2="17" stroke="currentColor" strokeWidth={sw} />
    </>
  ),
  spawn: (sw) => (
    <>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth={sw} fill="none" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={sw * 0.7} fill="none" />
      <line x1="12" y1="4" x2="12" y2="7" stroke="currentColor" strokeWidth={sw * 0.7} />
      <line x1="12" y1="17" x2="12" y2="20" stroke="currentColor" strokeWidth={sw * 0.7} />
      <line x1="4" y1="12" x2="7" y2="12" stroke="currentColor" strokeWidth={sw * 0.7} />
      <line x1="17" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth={sw * 0.7} />
    </>
  ),
  frag: (sw) => (
    <>
      <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" strokeWidth={sw * 0.7} />
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth={sw * 0.7} />
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth={sw * 0.5} opacity="0.5" />
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth={sw * 0.5} opacity="0.5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  quad: (sw) => (
    <>
      <rect x="4" y="4" width="16" height="16" stroke="currentColor" strokeWidth={sw} fill="none" transform="rotate(45 12 12)" />
      <rect x="8" y="8" width="8" height="8" stroke="currentColor" strokeWidth={sw * 0.6} fill="none" transform="rotate(45 12 12)" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
};

const QIcon = ({ name, size = T.icon.size.md, color = "currentColor", strokeWidth, glow }) => {
  const sw = strokeWidth || T.icon.stroke.normal;
  const pathFn = ICON_PATHS[name];
  if (!pathFn) return null;
  const glowId = glow ? `icon-glow-${name}-${Math.random().toString(36).slice(2, 6)}` : null;
  return (
    <svg
      width={size} height={size}
      viewBox={T.icon.viewBox}
      fill="none"
      style={{ color, display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      {glow && (
        <defs>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="1.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
      )}
      <g filter={glow ? `url(#${glowId})` : undefined}>
        {pathFn(sw)}
      </g>
    </svg>
  );
};


// =============================================================
//  FULLBRIGHT INDICATOR
// =============================================================
const Fullbright = ({ color, pulse = false, size = 7 }) => (
  <span style={{
    display: "inline-block", width: size, height: size,
    background: `radial-gradient(circle, ${color}, ${color}88)`,
    borderRadius: "50%",
    boxShadow: `0 0 ${size * T.fx.glow.fbMultiplier[0]}px ${color}88, 0 0 ${size * T.fx.glow.fbMultiplier[1]}px ${color}44`,
    animation: pulse ? `fbPulse ${T.anim.pulse.duration} ${T.anim.pulse.easing} infinite` : "none",
  }} />
);


// =============================================================
//  GRAIN OVERLAY
// =============================================================
const Grain = () => {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    c.width = 200; c.height = 200;
    const d = ctx.createImageData(200, 200);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.random() * T.fx.grain.intensity;
      d.data[i] = v; d.data[i+1] = v * 0.9; d.data[i+2] = v * 0.7;
      d.data[i+3] = T.fx.grain.alpha;
    }
    ctx.putImageData(d, 0, 0);
  }, []);
  return <canvas ref={ref} style={{
    position: "fixed", inset: 0, width: "100%", height: "100%",
    pointerEvents: "none", zIndex: 9999,
    opacity: T.fx.grain.opacity, mixBlendMode: T.fx.grain.blend,
  }} />;
};


// =============================================================
//  SECTION HEADER
// =============================================================
const Section = ({ title, subtitle, children }) => (
  <div style={{ marginBottom: T.space.section }}>
    <div style={{ marginBottom: T.space.xxl }}>
      <div style={{ display: "flex", alignItems: "center", gap: T.space.md, marginBottom: T.space.xs }}>
        <div style={{
          width: 3, height: T.space.xxl,
          background: `linear-gradient(180deg, ${Q.torch}, ${Q.copper0})`,
          boxShadow: `0 0 ${T.fx.glow.sm}px ${Q.torch}44`,
        }} />
        <h2 style={{
          fontFamily: FONT.display, fontSize: T.type.size.heading, color: Q.torch,
          letterSpacing: T.type.tracking.xwide, textTransform: "uppercase", margin: 0,
          textShadow: `0 0 ${T.fx.glow.lg}px ${Q.torch}22`,
        }}>{title}</h2>
      </div>
      {subtitle && (
        <div style={{
          fontFamily: FONT.console, fontSize: T.type.size.label,
          color: Q.bone0, marginLeft: T.space.md + 1, letterSpacing: T.type.tracking.tight,
        }}>{subtitle}</div>
      )}
    </div>
    {children}
  </div>
);


// =============================================================
//  SWATCH
// =============================================================
const Swatch = ({ name, hex, role, fullbright }) => {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ cursor: "default", transition: `transform ${T.anim.transition.normal}`, transform: hover ? `translateY(${T.anim.hoverLift})` : "none" }}>
      <div style={{
        height: 48, background: hex, position: "relative",
        border: `${T.border.width.standard}px solid ${T.border.color.default}`, borderBottom: "none",
        borderRadius: T.border.radius,
        boxShadow: fullbright ? `inset 0 0 ${T.fx.glow.lg}px ${hex}44` : "none",
      }}>
        {fullbright && (
          <div style={{
            position: "absolute", top: T.space.xs, right: T.space.xs,
            fontFamily: FONT.display, fontSize: T.type.size.micro,
            color: Q.void0, background: `${hex}cc`, padding: "1px 4px",
            letterSpacing: T.type.tracking.tight,
          }}>FB</div>
        )}
        {hover && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.5)", fontFamily: FONT.console, fontSize: T.type.size.label, color: "#fff",
          }}>{hex}</div>
        )}
      </div>
      <div style={{
        padding: `${T.space.sm - 2}px ${T.space.sm}px`, background: Q.stone1,
        border: `${T.border.width.standard}px solid ${T.border.color.default}`,
        borderTop: `${T.border.width.standard}px solid ${Q.stone2}`,
      }}>
        <div style={{ fontFamily: FONT.console, fontSize: T.type.size.label, color: Q.bone2 }}>{name}</div>
        <div style={{ fontFamily: FONT.console, fontSize: T.type.size.badge, color: Q.bone0, marginTop: 1 }}>{role}</div>
      </div>
    </div>
  );
};


// =============================================================
//  BUTTON
// =============================================================
const QButton = ({ children, variant = "primary", size = "md", disabled, icon }) => {
  const [h, setH] = useState(false);
  const [p, setP] = useState(false);
  const variants = {
    primary: {
      bg: `linear-gradient(180deg, ${h ? Q.copper2 : Q.copper1} 0%, ${h ? Q.copper1 : Q.copper0} 100%)`,
      border: Q.copper2, color: Q.void0, shadow: h ? `0 0 ${T.fx.glow.md}px ${Q.torch}33` : "none",
      textShadow: `0 1px 0 ${Q.copper3}44`,
    },
    runic: {
      bg: `linear-gradient(180deg, ${h ? Q.stone3 : Q.stone2} 0%, ${h ? Q.stone2 : Q.stone1} 100%)`,
      border: Q.iron1, color: Q.bone2, shadow: "none", textShadow: "none",
    },
    lava: {
      bg: `linear-gradient(180deg, ${h ? Q.lava1 : Q.lava0} 0%, ${h ? Q.lava0 : Q.blood} 100%)`,
      border: Q.lava1, color: Q.bone4, shadow: h ? `0 0 ${T.fx.glow.md}px ${Q.lava1}44` : "none",
      textShadow: `0 1px ${T.border.width.depth}px ${Q.void0}88`,
    },
    slime: {
      bg: `linear-gradient(180deg, ${h ? Q.slime1 : Q.slime0} 0%, ${h ? Q.slime0 : "#1c3c10"} 100%)`,
      border: Q.slime1, color: Q.bone4, shadow: h ? `0 0 ${T.fx.glow.md - 2}px ${Q.slime1}33` : "none",
      textShadow: `0 1px ${T.border.width.depth}px ${Q.void0}88`,
    },
    teleport: {
      bg: `linear-gradient(180deg, ${h ? Q.teleportBright : Q.teleport} 0%, ${h ? Q.teleport : "#3c2858"} 100%)`,
      border: Q.teleportBright, color: Q.bone4, shadow: h ? `0 0 ${T.fx.glow.md + 2}px ${Q.teleport}44` : "none",
      textShadow: "none",
    },
    ghost: {
      bg: h ? `${Q.stone2}88` : "transparent",
      border: h ? Q.iron0 : "transparent", color: Q.bone1, shadow: "none", textShadow: "none",
    },
  };
  const s = T.button.sizes[size]; const v = variants[variant];
  return (
    <button
      onMouseEnter={() => setH(true)} onMouseLeave={() => { setH(false); setP(false); }}
      onMouseDown={() => setP(true)} onMouseUp={() => setP(false)}
      disabled={disabled}
      style={{
        fontFamily: FONT.display, fontSize: s.fs,
        letterSpacing: T.type.tracking.normal, textTransform: "uppercase",
        padding: `${s.py}px ${s.px}px`,
        background: disabled ? Q.stone2 : v.bg,
        border: `${T.border.width.standard}px solid ${disabled ? T.border.color.default : v.border}`,
        borderTop: `${T.border.width.standard}px solid ${disabled ? T.border.color.default : v.border}88`,
        borderBottom: `${T.border.width.depth}px solid ${disabled ? Q.void1 : T.border.color.abyss}`,
        borderRadius: T.border.radius,
        color: disabled ? Q.bone0 : v.color, cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled ? "none" : v.shadow, textShadow: v.textShadow,
        transform: p ? `translateY(${T.anim.pressDepth})` : "none",
        transition: `all ${T.anim.transition.fast}`,
        display: "inline-flex", alignItems: "center", gap: T.space.sm - 2,
        opacity: disabled ? T.button.disabledOpacity : 1,
      }}
    >{icon}{children}</button>
  );
};


// =============================================================
//  STATUS RUNE
// =============================================================
const StatusRune = ({ status, label }) => {
  const c = {
    active:  { color: T.semantic.success,   label: label || "ALIVE" },
    idle:    { color: T.semantic.warning,    label: label || "IDLE" },
    error:   { color: T.semantic.danger,     label: label || "GIBBED" },
    offline: { color: Q.iron1,              label: label || "DEAD" },
    warp:    { color: T.semantic.special,    label: label || "SLIPGATE" },
  }[status];
  return (
    <span style={{
      fontFamily: FONT.display, fontSize: T.type.size.badge,
      letterSpacing: T.type.tracking.normal,
      color: c.color, background: `${c.color}12`,
      border: `${T.border.width.standard}px solid ${c.color}33`,
      padding: `${T.space.xs - 1}px ${T.space.sm}px`, textTransform: "uppercase",
      display: "inline-flex", alignItems: "center", gap: T.space.xs + 1,
    }}>
      <Fullbright color={c.color} pulse={status === "active"} size={5} />
      {c.label}
    </span>
  );
};


// =============================================================
//  AGENT HUD CARD
// =============================================================
const AgentHUD = ({ name, classname, status, health, armor, frags }) => {
  const [hover, setHover] = useState(false);
  const healthColor = health > 60 ? T.semantic.success : health > 25 ? T.semantic.warning : T.semantic.danger;
  return (
    <RivetedPanel
      glow={status === "active" ? T.semantic.successDark : status === "error" ? T.semantic.dangerDark : null}
      style={{ padding: 0, overflow: "hidden", cursor: "default", transition: `all ${T.anim.transition.slow}` }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, transparent, ${
          status === "active" ? T.semantic.success : status === "error" ? T.semantic.danger : Q.copper1
        }44, transparent)`,
      }} />
      <div style={{ padding: `${T.space.md}px ${T.space.lg - 2}px` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: T.space.md - 2 }}>
          <div>
            <div style={{
              fontFamily: FONT.display, fontSize: T.type.size.subheading, color: Q.bone3,
              letterSpacing: T.type.tracking.normal,
              textShadow: hover ? `0 0 ${T.fx.glow.md - 2}px ${Q.torch}33` : "none",
              transition: `text-shadow ${T.anim.transition.slow}`,
            }}>{name}</div>
            <div style={{
              fontFamily: FONT.console, fontSize: T.type.size.labelSmall,
              color: Q.bone0, letterSpacing: T.type.tracking.tight, marginTop: 1,
            }}>{classname}</div>
          </div>
          <StatusRune status={status} />
        </div>
        <div style={{ display: "flex", gap: T.space.md, alignItems: "flex-end" }}>
          {/* Health */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: T.space.xs - 1 }}>
              <span style={{ fontFamily: FONT.display, fontSize: T.type.size.badge, color: Q.bone0, letterSpacing: T.type.tracking.tight }}>HP</span>
              <span style={{ fontFamily: FONT.display, fontSize: T.type.size.statSmall, color: healthColor,
                textShadow: `0 0 ${T.fx.glow.sm}px ${healthColor}44` }}>{health}</span>
            </div>
            <div style={{ height: T.bar.height.health, background: Q.void1, border: `${T.border.width.standard}px solid ${T.border.color.default}` }}>
              <div style={{
                height: "100%", width: `${health}%`,
                transition: `width ${T.anim.meter.duration} ${T.anim.meter.easing}`,
                background: `linear-gradient(90deg, ${healthColor}88, ${healthColor})`,
                boxShadow: `0 0 ${T.fx.glow.sm}px ${healthColor}33`,
              }} />
            </div>
          </div>
          {/* Armor */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: T.space.xs - 1 }}>
              <span style={{ fontFamily: FONT.display, fontSize: T.type.size.badge, color: Q.bone0, letterSpacing: T.type.tracking.tight }}>ARM</span>
              <span style={{ fontFamily: FONT.display, fontSize: T.type.size.statSmall, color: Q.copper3 }}>{armor}</span>
            </div>
            <div style={{ height: T.bar.height.health, background: Q.void1, border: `${T.border.width.standard}px solid ${T.border.color.default}` }}>
              <div style={{
                height: "100%", width: `${Math.min(armor, 200) / 2}%`,
                transition: `width ${T.anim.meter.duration} ${T.anim.meter.easing}`,
                background: `linear-gradient(90deg, ${Q.copper1}88, ${Q.copper3})`,
              }} />
            </div>
          </div>
          {/* Frags */}
          <div style={{ textAlign: "right", minWidth: 48 }}>
            <div style={{ fontFamily: FONT.display, fontSize: T.type.size.badge, color: Q.bone0, letterSpacing: T.type.tracking.tight }}>FRAGS</div>
            <div style={{
              fontFamily: FONT.display, fontSize: T.type.size.statMedium, color: T.semantic.highlight,
              lineHeight: T.type.leading.tight,
              textShadow: `0 0 ${T.fx.glow.md}px ${Q.torch}44`,
            }}>{frags}</div>
          </div>
        </div>
      </div>
    </RivetedPanel>
  );
};


// =============================================================
//  CONSOLE
// =============================================================
const QuakeConsole = ({ lines }) => (
  <div style={{
    background: `
      linear-gradient(180deg, ${Q.void0}f0, ${Q.stone1}e0),
      repeating-linear-gradient(0deg, transparent 0px, transparent 1px, ${Q.void0}15 1px, ${Q.void0}15 2px)
    `,
    border: `${T.border.width.standard}px solid ${T.border.color.default}`,
    borderTop: `${T.border.width.depth}px solid ${Q.copper0}44`,
    borderRadius: T.border.radius,
    padding: T.space.lg - 2,
    fontFamily: FONT.console, fontSize: T.type.size.console, lineHeight: T.type.leading.consoleLine,
    maxHeight: 220, overflow: "auto",
  }}>
    {lines.map((l, i) => (
      <div key={i} style={{ display: "flex", gap: T.space.md - 2 }}>
        <span style={{ color: Q.bone0, minWidth: 65, fontVariantNumeric: "tabular-nums" }}>{l.t}</span>
        <span style={{
          color: l.lv === "ERR" ? T.semantic.danger : l.lv === "WRN" ? T.semantic.warning : l.lv === "OK" ? T.semantic.success : Q.bone0,
          minWidth: 28,
        }}>{l.lv}</span>
        <span style={{ color: Q.bone2 }}>{l.msg}</span>
      </div>
    ))}
    <div style={{ marginTop: T.space.xs - 2 }}>
      <span style={{ color: Q.copper3 }}>]</span>
      <span style={{ color: T.semantic.highlight, animation: `fbPulse ${T.anim.cursor.duration} infinite` }}> █</span>
    </div>
  </div>
);


// =============================================================
//  HUD STAT
// =============================================================
const HUDStat = ({ label, value, trend, glow }) => (
  <RivetedPanel style={{ padding: `${T.space.md}px ${T.space.lg}px` }}>
    <div style={{
      fontFamily: FONT.display, fontSize: T.type.size.badge, color: Q.bone0,
      letterSpacing: T.type.tracking.normal, textTransform: "uppercase",
      marginBottom: T.space.sm - 2,
    }}>{label}</div>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <span style={{
        fontFamily: FONT.display, fontSize: T.type.size.stat,
        color: glow || T.semantic.highlight, lineHeight: T.type.leading.tight,
        textShadow: `0 0 ${T.fx.glow.lg - 4}px ${glow || Q.torch}33`,
        letterSpacing: T.type.tracking.normal,
      }}>{value}</span>
      {trend !== undefined && (
        <span style={{
          fontFamily: FONT.console, fontSize: T.type.size.label,
          color: trend > 0 ? T.semantic.success : T.semantic.danger,
        }}>{trend > 0 ? "+" : ""}{trend}%</span>
      )}
    </div>
  </RivetedPanel>
);


// =============================================================
//  RUNIC METER
// =============================================================
const RunicMeter = ({ value, max, label }) => {
  const pct = (value / max) * 100;
  return (
    <div style={{ marginBottom: T.space.lg - 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: T.space.xs }}>
        <span style={{ fontFamily: FONT.display, fontSize: T.type.size.labelSmall, color: Q.bone0, letterSpacing: T.type.tracking.tight }}>{label}</span>
        <span style={{ fontFamily: FONT.console, fontSize: T.type.size.label, color: Q.copper3 }}>
          {value}<span style={{ color: Q.bone0 }}>/{max}</span>
        </span>
      </div>
      <div style={{
        height: T.bar.height.meter, background: Q.void1,
        border: `${T.border.width.standard}px solid ${T.border.color.default}`,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0, width: `${pct}%`,
          background: `linear-gradient(90deg, ${Q.copper0}, ${Q.copper2}, ${Q.torch}aa)`,
          boxShadow: `0 0 ${T.fx.glow.sm}px ${Q.torch}22`,
          transition: `width 0.6s ${T.anim.meter.easing}`,
        }} />
        {T.bar.tickMarks.map(p => (
          <div key={p} style={{
            position: "absolute", left: `${p}%`, top: 0, bottom: 0,
            width: 1, background: `${Q.void0}99`,
          }} />
        ))}
        <div style={{
          position: "absolute", inset: 0,
          background: `repeating-linear-gradient(0deg, transparent 0px, transparent ${T.bar.scanlineGap}px, rgba(0,0,0,0.15) ${T.bar.scanlineGap}px, rgba(0,0,0,0.15) ${T.bar.scanlineGap * 2}px)`,
        }} />
      </div>
    </div>
  );
};


// =============================================================
//  TABS
// =============================================================
const RuneTabs = () => {
  const [active, setActive] = useState(0);
  const tabs = ["Dimension 1", "Dimension 2", "Dimension 3", "The Elder"];
  return (
    <div>
      <div style={{ display: "flex", gap: 1, background: Q.void0, borderBottom: `${T.border.width.depth}px solid ${T.border.color.default}` }}>
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setActive(i)} style={{
            fontFamily: FONT.display, fontSize: T.type.size.label,
            letterSpacing: T.type.tracking.normal, textTransform: "uppercase",
            padding: `${T.space.sm + 1}px ${T.space.xl - 2}px`,
            cursor: "pointer", transition: `all ${T.anim.transition.fast}`, border: "none",
            background: active === i ? `linear-gradient(180deg, ${Q.stone2}, ${Q.stone1})` : Q.void1,
            color: active === i ? Q.torch : Q.bone0,
            borderBottom: active === i ? `${T.border.width.depth}px solid ${Q.torch}` : `${T.border.width.depth}px solid transparent`,
            borderTop: active === i ? `${T.border.width.standard}px solid ${T.border.color.default}` : `${T.border.width.standard}px solid transparent`,
            marginBottom: -T.border.width.depth,
          }}>{t}</button>
        ))}
      </div>
      <CopperTexture style={{ padding: T.space.lg }}>
        <span style={{ fontFamily: FONT.console, fontSize: T.type.size.console, color: Q.bone1 }}>
          {active === 0 && "The Doomed Dimension — lead routing through the slipgates begins here."}
          {active === 1 && "The Realm of Black Magic — qualification runes are applied to each entity."}
          {active === 2 && "The Netherworld — dispatching qualified leads to the closing arena."}
          {active === 3 && "The Elder World — final conversion before Shub-Niggurath consumes all."}
        </span>
      </CopperTexture>
    </div>
  );
};


// =============================================================
//  FORM CONTROLS
// =============================================================
const RuneInput = ({ label, placeholder, type = "text" }) => {
  const [f, setF] = useState(false);
  return (
    <div>
      {label && <label style={{
        fontFamily: FONT.display, fontSize: T.type.size.labelSmall, color: Q.bone0,
        letterSpacing: T.type.tracking.normal, display: "block",
        marginBottom: T.space.xs + 1, textTransform: "uppercase",
      }}>{label}</label>}
      <input type={type} placeholder={placeholder}
        onFocus={() => setF(true)} onBlur={() => setF(false)}
        style={{
          width: "100%", padding: `${T.space.sm + 1}px ${T.space.md}px`,
          fontFamily: FONT.console, fontSize: T.type.size.statSmall, color: Q.bone3,
          background: Q.void1,
          border: `${T.border.width.standard}px solid ${f ? Q.copper1 : T.border.color.default}`,
          borderBottom: `${T.border.width.depth}px solid ${f ? Q.copper0 : T.border.color.abyss}`,
          borderRadius: T.border.radius, outline: "none",
          boxShadow: f ? `0 0 ${T.fx.glow.md}px ${Q.copper1}18, inset 0 0 ${T.fx.glow.lg}px ${Q.copper0}08` : "none",
          transition: `all ${T.anim.transition.normal}`, boxSizing: "border-box",
        }}
      />
    </div>
  );
};

const RuneToggle = ({ label, on: initialOn = false }) => {
  const [on, setOn] = useState(initialOn);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${T.space.xs}px 0` }}>
      <span style={{ fontFamily: FONT.console, fontSize: T.type.size.console, color: Q.bone2 }}>{label}</span>
      <div onClick={() => setOn(!on)} style={{
        width: 36, height: 18, cursor: "pointer", position: "relative",
        transition: `all ${T.anim.transition.slow}`,
        background: on ? T.semantic.successDark : Q.void1,
        border: `${T.border.width.standard}px solid ${on ? T.semantic.success : T.border.color.default}`,
        boxShadow: on ? `0 0 ${T.fx.glow.sm}px ${T.semantic.successDark}44, inset 0 0 ${T.fx.glow.sm}px ${T.semantic.successDark}33` : "none",
      }}>
        <div style={{
          width: T.space.md, height: T.space.md, position: "absolute", top: T.border.width.depth,
          left: on ? T.space.xl : T.border.width.depth,
          transition: `all ${T.anim.transition.normal}`,
          background: on ? T.semantic.success : Q.iron1,
          boxShadow: on ? `0 0 ${T.fx.glow.sm}px ${T.semantic.success}88` : "none",
        }} />
      </div>
    </div>
  );
};


// =============================================================
//  TOAST NOTIFICATION
// =============================================================
const RuneToast = ({ type, msg }) => {
  const colors = { info: Q.torch, ok: T.semantic.success, err: T.semantic.danger, warn: T.semantic.info };
  const c = colors[type];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: T.space.md - 2,
      background: `linear-gradient(90deg, ${c}08, transparent)`,
      borderLeft: `3px solid ${c}`,
      border: `${T.border.width.standard}px solid ${c}22`,
      borderRadius: T.border.radius,
      padding: `${T.space.sm + 1}px ${T.space.lg - 2}px`,
    }}>
      <Fullbright color={c} size={T.fx.glow.sm} />
      <span style={{ fontFamily: FONT.console, fontSize: T.type.size.console, color: Q.bone2, flex: 1 }}>{msg}</span>
      <span style={{ fontFamily: FONT.console, fontSize: T.type.size.bodySmall, color: Q.bone0, cursor: "pointer", lineHeight: T.type.leading.tight }}>×</span>
    </div>
  );
};


// =============================================================
//  LIVE TOKEN RENDERER
//  Recursively walks the T object and renders it as a live table.
// =============================================================
const TokenRow = ({ path, value, depth = 0 }) => {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return Object.entries(value).map(([k, v]) => (
      <TokenRow key={`${path}.${k}`} path={`${path}.${k}`} value={v} depth={depth + 1} />
    ));
  }
  const displayVal = Array.isArray(value) ? `[${value.join(", ")}]` : String(value);
  const isColor = typeof value === "string" && value.startsWith("#");
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: T.space.sm,
      padding: `${T.space.xs + 1}px ${T.space.md}px`,
      paddingLeft: T.space.md + (depth * T.space.md),
      background: Q.stone1,
      borderBottom: `1px solid ${Q.void1}`,
    }}>
      <span style={{
        fontFamily: FONT.console, fontSize: T.type.size.labelSmall,
        color: Q.copper2, minWidth: 200,
      }}>{path}</span>
      <span style={{ fontFamily: FONT.console, fontSize: T.type.size.labelSmall, color: Q.bone1 }}>{displayVal}</span>
      {isColor && <span style={{
        display: "inline-block", width: T.space.md, height: T.space.md,
        background: value, border: `1px solid ${Q.stone3}`, marginLeft: T.space.xs,
      }} />}
    </div>
  );
};

const LiveTokens = () => {
  const [expanded, setExpanded] = useState(null);
  const sections = Object.keys(T);
  return (
    <div style={{ border: `${T.border.width.standard}px solid ${T.border.color.default}`, overflow: "hidden" }}>
      {sections.map(section => (
        <div key={section}>
          <div
            onClick={() => setExpanded(expanded === section ? null : section)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: `${T.space.sm}px ${T.space.md}px`,
              background: expanded === section ? Q.stone2 : Q.stone1,
              borderBottom: `1px solid ${Q.void1}`,
              cursor: "pointer", transition: `background ${T.anim.transition.fast}`,
            }}
          >
            <span style={{
              fontFamily: FONT.display, fontSize: T.type.size.labelSmall,
              color: expanded === section ? Q.torch : Q.copper2,
              letterSpacing: T.type.tracking.normal, textTransform: "uppercase",
            }}>T.{section}</span>
            <span style={{
              fontFamily: FONT.console, fontSize: T.type.size.label, color: Q.bone0,
              transform: expanded === section ? "rotate(90deg)" : "none",
              transition: `transform ${T.anim.transition.normal}`,
            }}>▸</span>
          </div>
          {expanded === section && (
            <div style={{ maxHeight: 300, overflow: "auto" }}>
              {Object.entries(T[section]).map(([k, v]) => (
                <TokenRow key={`T.${section}.${k}`} path={`T.${section}.${k}`} value={v} depth={0} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};


// =============================================================
//  MAIN EXPORT
// =============================================================
export default function QuakeBrandKit() {
  const [scan, setScan] = useState(0);
  useEffect(() => {
    let y = 0;
    const tick = () => {
      y = (y + T.anim.scanline.speed) % 2000;
      setScan(y);
      requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div style={{ background: Q.void0, minHeight: "100vh", color: Q.bone2, position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=IBM+Plex+Mono:wght@300;400;500&family=Chakra+Petch:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${Q.void0}; }
        ::-webkit-scrollbar-thumb { background: ${Q.stone3}; }
        @keyframes fbPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes torchFlicker {
          0%,100% { opacity: 1; } 91% { opacity: 1; } 92% { opacity: 0.85; }
          93% { opacity: 1; } 96% { opacity: 0.92; } 97% { opacity: 1; }
        }
        input::placeholder { color: ${Q.bone0}88; }
      `}</style>

      <Grain />
      <div style={{
        position: "fixed", left: 0, right: 0,
        height: T.fx.scanline.height, top: scan,
        background: `linear-gradient(90deg, transparent 5%, ${T.fx.scanline.tint}${T.fx.scanline.alpha} 30%, ${T.fx.scanline.tint}${T.fx.scanline.alpha} 70%, transparent 95%)`,
        zIndex: 9998, pointerEvents: "none",
      }} />

      {/* ===== HEADER ===== */}
      <header style={{
        borderBottom: `${T.border.width.standard}px solid ${T.border.color.default}`,
        padding: `${T.space.section / 2}px ${T.space.page.x}px ${T.space.xxl + 8}px`,
        background: `linear-gradient(180deg, ${Q.stone1}40 0%, transparent 100%)`,
        position: "relative",
      }}>
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${Q.copper1}33, ${Q.copper0}33, transparent)`,
        }} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: T.space.lg }}>
          <div style={{ marginTop: T.space.xs - 2 }}><QuakeSymbol size={36} color={Q.copper3} glow /></div>
          <div>
            <h1 style={{
              fontFamily: FONT.display, fontSize: T.type.size.title, color: Q.torchHot,
              letterSpacing: T.type.tracking.hero, textTransform: "uppercase", margin: 0,
              textShadow: `0 0 ${T.fx.glow.xl}px ${Q.torch}22, 0 ${T.border.width.depth}px ${T.space.xs}px ${Q.void0}`,
              animation: `torchFlicker ${T.anim.flicker.duration} infinite`,
            }}>CRANKSHAFT v3</h1>
            <div style={{
              fontFamily: FONT.console, fontSize: T.type.size.label, color: Q.bone0,
              letterSpacing: T.type.tracking.wide, marginTop: T.space.xs - 1,
            }}>AGENT ORCHESTRATION — QUAKE EDITION</div>
          </div>
        </div>
        <p style={{
          fontFamily: FONT.body, fontSize: T.type.size.bodySmall, color: Q.bone1,
          maxWidth: 540, lineHeight: T.type.leading.relaxed,
          marginTop: T.space.lg, fontWeight: T.type.weight.light,
        }}>
          Brand system & component kit. Copper and runic metal, Lovecraftian depths, torchlit fullbright accents.
          Inspired by id Software's Quake — the NIN palette, 256 constrained colors, and the feeling of
          descending through slipgates into something that doesn't want you there.
        </p>
      </header>

      <main style={{
        padding: `${T.space.page.top}px ${T.space.page.x}px ${T.space.page.bottom}px`,
        maxWidth: 920, margin: "0 auto",
      }}>

        {/* ===== PALETTE ===== */}
        <Section title="Color Palette" subtitle="256 colors. Mostly brown. Intentionally.">
          <div style={{ marginBottom: T.space.xl }}>
            <div style={{ fontFamily: FONT.display, fontSize: T.type.size.labelSmall, color: Q.copper1, letterSpacing: T.type.tracking.normal, marginBottom: T.space.md - 2 }}>VOID & STONE</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: T.space.sm - 2 }}>
              <Swatch name="Void" hex={Q.void0} role="bg-abyss" />
              <Swatch name="Void Lite" hex={Q.void1} role="bg-base" />
              <Swatch name="Stone Dark" hex={Q.stone0} role="bg-sunken" />
              <Swatch name="Stone" hex={Q.stone1} role="bg-surface" />
              <Swatch name="Stone Lite" hex={Q.stone2} role="bg-raised" />
              <Swatch name="Stone Bright" hex={Q.stone3} role="bg-border" />
            </div>
          </div>
          <div style={{ marginBottom: T.space.xl }}>
            <div style={{ fontFamily: FONT.display, fontSize: T.type.size.labelSmall, color: Q.copper1, letterSpacing: T.type.tracking.normal, marginBottom: T.space.md - 2 }}>COPPER & RUNIC METAL</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: T.space.sm - 2 }}>
              <Swatch name="Copper Dark" hex={Q.copper0} role="primary-dark" />
              <Swatch name="Copper" hex={Q.copper1} role="primary" />
              <Swatch name="Copper Lite" hex={Q.copper2} role="primary-hover" />
              <Swatch name="Copper Bright" hex={Q.copper3} role="primary-accent" />
            </div>
          </div>
          <div style={{ marginBottom: T.space.xl }}>
            <div style={{ fontFamily: FONT.display, fontSize: T.type.size.labelSmall, color: Q.copper1, letterSpacing: T.type.tracking.normal, marginBottom: T.space.md - 2 }}>FULLBRIGHT ACCENTS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: T.space.sm - 2 }}>
              <Swatch name="Torch" hex={Q.torch} role="highlight" fullbright />
              <Swatch name="Torch Hot" hex={Q.torchHot} role="highlight-max" fullbright />
              <Swatch name="Lava Deep" hex={Q.lava0} role="danger-dark" fullbright />
              <Swatch name="Lava" hex={Q.lava1} role="danger" fullbright />
              <Swatch name="Slime Dark" hex={Q.slime0} role="success-dark" fullbright />
              <Swatch name="Slime" hex={Q.slime1} role="success" fullbright />
              <Swatch name="Slipgate" hex={Q.teleport} role="special" fullbright />
            </div>
          </div>
          <div>
            <div style={{ fontFamily: FONT.display, fontSize: T.type.size.labelSmall, color: Q.copper1, letterSpacing: T.type.tracking.normal, marginBottom: T.space.md - 2 }}>BONE, BLOOD & IRON</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: T.space.sm - 2 }}>
              <Swatch name="Blood" hex={Q.blood} role="error-deep" />
              <Swatch name="Iron Dark" hex={Q.iron0} role="muted" />
              <Swatch name="Iron" hex={Q.iron1} role="disabled" />
              <Swatch name="Iron Lite" hex={Q.iron2} role="subtle" />
              <Swatch name="Bone 0" hex={Q.bone0} role="text-muted" />
              <Swatch name="Bone 1" hex={Q.bone1} role="text-dim" />
              <Swatch name="Bone 2" hex={Q.bone2} role="text-base" />
              <Swatch name="Bone 3" hex={Q.bone3} role="text-bright" />
            </div>
          </div>
        </Section>

        {/* ===== TYPOGRAPHY ===== */}
        <Section title="Typography" subtitle="Three faces. One for killing, one for logging, one for reading.">
          <div style={{ display: "flex", flexDirection: "column", gap: T.space.lg }}>
            <RivetedPanel style={{ padding: T.space.xl }}>
              <div style={{ fontFamily: FONT.console, fontSize: T.type.size.labelSmall, color: Q.copper2, letterSpacing: T.type.tracking.normal, marginBottom: T.space.md - 2 }}>DISPLAY — SILKSCREEN</div>
              <div style={{
                fontFamily: FONT.display, fontSize: T.type.size.hero, color: Q.torchHot,
                letterSpacing: T.type.tracking.xwide, lineHeight: T.type.leading.snug,
                textShadow: `0 0 ${T.fx.glow.lg}px ${Q.torch}22`,
              }}>QUAD DAMAGE</div>
              <div style={{ fontFamily: FONT.display, fontSize: 18, color: Q.bone3, letterSpacing: T.type.tracking.wide, marginTop: T.space.xs }}>AGENT ORCHESTRATION</div>
              <div style={{ fontFamily: FONT.display, fontSize: T.type.size.statSmall, color: Q.bone0, letterSpacing: T.type.tracking.normal, marginTop: T.space.sm - 2 }}>
                Statusbar numbers · headings · badges · counters — sizes {T.type.size.badge}px–{T.type.size.hero}px
              </div>
            </RivetedPanel>
            <RivetedPanel style={{ padding: T.space.xl }}>
              <div style={{ fontFamily: FONT.console, fontSize: T.type.size.labelSmall, color: Q.copper2, letterSpacing: T.type.tracking.normal, marginBottom: T.space.md - 2 }}>CONSOLE — IBM PLEX MONO</div>
              <div style={{ fontFamily: FONT.console, fontSize: T.type.size.consoleCommand, color: Q.bone3, lineHeight: T.type.leading.normal }}>
                <span style={{ color: Q.copper3 }}>]</span> spawn_agent <span style={{ color: T.semantic.success }}>"ranger"</span> --arena=dm4 --priority=<span style={{ color: T.semantic.highlight }}>QUAD</span>
              </div>
              <div style={{ fontFamily: FONT.console, fontSize: T.type.size.statSmall, color: Q.bone0, marginTop: T.space.sm }}>
                Console output · QuakeC vars · timestamps · data — {T.type.size.labelSmall}px–{T.type.size.consoleCommand}px
              </div>
            </RivetedPanel>
            <RivetedPanel style={{ padding: T.space.xl }}>
              <div style={{ fontFamily: FONT.console, fontSize: T.type.size.labelSmall, color: Q.copper2, letterSpacing: T.type.tracking.normal, marginBottom: T.space.md - 2 }}>BODY — CHAKRA PETCH</div>
              <div style={{ fontFamily: FONT.body, fontSize: T.type.size.body, color: Q.bone2, lineHeight: T.type.leading.loose, fontWeight: T.type.weight.light }}>
                The orchestrator dispatches leads through slipgate qualification runes, scoring each
                against configurable thresholds before routing to the closing arena. Agents in the active
                pool receive assignments based on kill rating and current frag load.
              </div>
              <div style={{ fontFamily: FONT.console, fontSize: T.type.size.statSmall, color: Q.bone0, marginTop: T.space.sm }}>
                Body copy · descriptions · line-height {T.type.leading.loose} · weight {T.type.weight.light}
              </div>
            </RivetedPanel>
          </div>
        </Section>

        {/* ===== ICONOGRAPHY ===== */}
        <Section title="Iconography" subtitle={`${Object.keys(ICON_PATHS).length} custom SVGs. Stroke-based, ${T.icon.viewBox} viewBox, angular/miter joins. No rounded corners.`}>
          {/* Full icon grid */}
          <div style={{ marginBottom: T.space.xl }}>
            <div style={{ fontFamily: FONT.display, fontSize: T.type.size.labelSmall, color: Q.copper1, letterSpacing: T.type.tracking.normal, marginBottom: T.space.md - 2 }}>FULL SET — DEFAULT ({T.icon.size.md}px)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 1 }}>
              {Object.keys(ICON_PATHS).map(name => (
                <CopperTexture key={name} variant="dark" style={{
                  padding: `${T.space.lg}px ${T.space.sm}px ${T.space.sm}px`,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: T.space.sm,
                }}>
                  <QIcon name={name} color={Q.bone2} />
                  <span style={{ fontFamily: FONT.console, fontSize: T.type.size.badge, color: Q.bone0, letterSpacing: T.type.tracking.tight }}>{name}</span>
                </CopperTexture>
              ))}
            </div>
          </div>

          {/* Size scale */}
          <div style={{ marginBottom: T.space.xl }}>
            <div style={{ fontFamily: FONT.display, fontSize: T.type.size.labelSmall, color: Q.copper1, letterSpacing: T.type.tracking.normal, marginBottom: T.space.md - 2 }}>SIZE SCALE</div>
            <RivetedPanel style={{ padding: T.space.xl }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: T.space.xl }}>
                {Object.entries(T.icon.size).map(([label, px]) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: T.space.sm }}>
                    <QIcon name="axe" size={px} color={Q.copper3} />
                    <div style={{ fontFamily: FONT.display, fontSize: T.type.size.badge, color: Q.bone0, letterSpacing: T.type.tracking.tight }}>{label.toUpperCase()}</div>
                    <div style={{ fontFamily: FONT.console, fontSize: T.type.size.micro, color: Q.iron2 }}>{px}px</div>
                  </div>
                ))}
              </div>
            </RivetedPanel>
          </div>

          {/* Stroke weight */}
          <div style={{ marginBottom: T.space.xl }}>
            <div style={{ fontFamily: FONT.display, fontSize: T.type.size.labelSmall, color: Q.copper1, letterSpacing: T.type.tracking.normal, marginBottom: T.space.md - 2 }}>STROKE WEIGHTS</div>
            <RivetedPanel style={{ padding: T.space.xl }}>
              <div style={{ display: "flex", gap: T.space.xxl }}>
                {Object.entries(T.icon.stroke).map(([label, sw]) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: T.space.sm }}>
                    <div style={{ display: "flex", gap: T.space.md }}>
                      <QIcon name="armor" size={T.icon.size.lg} color={Q.bone2} strokeWidth={sw} />
                      <QIcon name="lightning" size={T.icon.size.lg} color={Q.bone2} strokeWidth={sw} />
                      <QIcon name="slipgate" size={T.icon.size.lg} color={Q.bone2} strokeWidth={sw} />
                    </div>
                    <div style={{ fontFamily: FONT.display, fontSize: T.type.size.badge, color: Q.bone0, letterSpacing: T.type.tracking.tight }}>{label.toUpperCase()}</div>
                    <div style={{ fontFamily: FONT.console, fontSize: T.type.size.micro, color: Q.iron2 }}>{sw}px</div>
                  </div>
                ))}
              </div>
            </RivetedPanel>
          </div>

          {/* Color variants + glow */}
          <div style={{ marginBottom: T.space.xl }}>
            <div style={{ fontFamily: FONT.display, fontSize: T.type.size.labelSmall, color: Q.copper1, letterSpacing: T.type.tracking.normal, marginBottom: T.space.md - 2 }}>COLOR VARIANTS & FULLBRIGHT GLOW</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 1 }}>
              {[
                { name: "health", color: T.semantic.success, label: "Success", glow: true },
                { name: "warning", color: T.semantic.warning, label: "Warning", glow: true },
                { name: "skull", color: T.semantic.danger, label: "Danger", glow: true },
                { name: "slipgate", color: T.semantic.special, label: "Special", glow: true },
                { name: "config", color: Q.copper3, label: "Copper", glow: false },
                { name: "eye", color: Q.bone1, label: "Muted", glow: false },
              ].map(({ name, color, label, glow: g }) => (
                <CopperTexture key={label} variant="dark" style={{
                  padding: T.space.lg, display: "flex", flexDirection: "column", alignItems: "center", gap: T.space.sm,
                }}>
                  <QIcon name={name} size={T.icon.size.lg} color={color} glow={g} />
                  <span style={{ fontFamily: FONT.console, fontSize: T.type.size.badge, color: Q.bone0 }}>{label}</span>
                </CopperTexture>
              ))}
            </div>
          </div>

          {/* Icons in context — inline with text, in buttons, in badges */}
          <div>
            <div style={{ fontFamily: FONT.display, fontSize: T.type.size.labelSmall, color: Q.copper1, letterSpacing: T.type.tracking.normal, marginBottom: T.space.md - 2 }}>IN CONTEXT</div>
            <CopperTexture style={{ padding: T.space.xl }}>
              <div style={{ display: "flex", flexDirection: "column", gap: T.space.lg }}>
                {/* Icon buttons */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: T.space.sm }}>
                  <QButton variant="primary" icon={<QIcon name="spawn" size={T.icon.size.sm} />}>Spawn Agent</QButton>
                  <QButton variant="lava" icon={<QIcon name="skull" size={T.icon.size.sm} />}>Terminate</QButton>
                  <QButton variant="slime" icon={<QIcon name="check" size={T.icon.size.sm} />}>Verified</QButton>
                  <QButton variant="teleport" icon={<QIcon name="slipgate" size={T.icon.size.sm} />}>Warp</QButton>
                  <QButton variant="runic" icon={<QIcon name="config" size={T.icon.size.sm} />}>Settings</QButton>
                </div>
                {/* Inline with text */}
                <div style={{ display: "flex", alignItems: "center", gap: T.space.sm, fontFamily: FONT.console, fontSize: T.type.size.console, color: Q.bone2 }}>
                  <QIcon name="dispatch" size={T.icon.size.sm} color={Q.copper3} />
                  <span>Lead #4821 routed through slipgate</span>
                  <QIcon name="chevronRight" size={T.icon.size.xs} color={Q.iron2} />
                  <span style={{ color: T.semantic.success }}>qualified</span>
                  <QIcon name="chevronRight" size={T.icon.size.xs} color={Q.iron2} />
                  <span style={{ color: T.semantic.highlight }}>dispatched to arena</span>
                </div>
                {/* Nav-style row */}
                <div style={{ display: "flex", gap: 1 }}>
                  {[
                    { icon: "route", label: "Routes" },
                    { icon: "rune", label: "Runes" },
                    { icon: "frag", label: "Arenas" },
                    { icon: "eye", label: "Monitor" },
                    { icon: "config", label: "Config" },
                  ].map(({ icon, label }) => (
                    <div key={label} style={{
                      flex: 1, padding: `${T.space.md}px ${T.space.sm}px`,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: T.space.xs,
                      background: Q.stone1, cursor: "pointer",
                      borderBottom: `${T.border.width.depth}px solid ${label === "Routes" ? Q.torch : "transparent"}`,
                    }}>
                      <QIcon name={icon} size={T.icon.size.sm} color={label === "Routes" ? Q.torch : Q.bone0} />
                      <span style={{
                        fontFamily: FONT.display, fontSize: T.type.size.micro,
                        color: label === "Routes" ? Q.torch : Q.bone0,
                        letterSpacing: T.type.tracking.tight,
                      }}>{label.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CopperTexture>
          </div>
        </Section>

        {/* ===== BUTTONS ===== */}
        <Section title="Buttons" subtitle={`Copper gradient, ${T.border.width.depth}px bottom depth, ${T.anim.pressDepth} press offset. Sizes: ${Object.keys(T.button.sizes).join("/")}.`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: T.space.md - 2, marginBottom: T.space.lg }}>
            <QButton variant="primary" icon={<QIcon name="spawn" size={T.icon.size.sm} />}>Deploy Agent</QButton>
            <QButton variant="runic" icon={<QIcon name="config" size={T.icon.size.sm} />}>Configure</QButton>
            <QButton variant="lava" icon={<QIcon name="close" size={T.icon.size.sm} />}>Terminate</QButton>
            <QButton variant="slime" icon={<QIcon name="check" size={T.icon.size.sm} />}>Connected</QButton>
            <QButton variant="teleport" icon={<QIcon name="slipgate" size={T.icon.size.sm} />}>Warp</QButton>
            <QButton variant="ghost">Dismiss</QButton>
            <QButton variant="primary" disabled>Sealed</QButton>
          </div>
          <div style={{ display: "flex", gap: T.space.md - 2, alignItems: "center" }}>
            <QButton variant="primary" size="sm">sm: {T.button.sizes.sm.fs}px</QButton>
            <QButton variant="primary" size="md">md: {T.button.sizes.md.fs}px</QButton>
            <QButton variant="primary" size="lg">lg: {T.button.sizes.lg.fs}px</QButton>
          </div>
        </Section>

        {/* ===== STATUS ===== */}
        <Section title="Status Runes" subtitle={`Fullbright dot (${T.fx.glow.fbMultiplier.join("x/")}x glow layers), ${T.anim.pulse.duration} pulse on active.`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: T.space.md - 2 }}>
            <StatusRune status="active" />
            <StatusRune status="idle" />
            <StatusRune status="error" />
            <StatusRune status="offline" />
            <StatusRune status="warp" />
            <StatusRune status="active" label="FRAGGING" />
            <StatusRune status="idle" label="RESPAWNING" />
            <StatusRune status="error" label="TELEFRAGGED" />
          </div>
        </Section>

        {/* ===== AGENT CARDS ===== */}
        <Section title="Agent Cards" subtitle={`Riveted panels (${T.fx.rivet.size}px dots @ ${T.fx.rivet.offset}px offset). Health bar ${T.bar.height.health}px, ticks at [${T.bar.tickMarks.join(",")}]%.`}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: T.space.md }}>
            <AgentHUD name="RANGER" classname="Lead Router // Dim. 1" status="active" health={92} armor={150} frags={847} />
            <AgentHUD name="FIEND" classname="Qualifier // Dim. 2" status="active" health={74} armor={80} frags={632} />
            <AgentHUD name="SHAMBLER" classname="Closer Dispatch // Dim. 3" status="idle" health={38} armor={20} frags={291} />
            <AgentHUD name="VORE" classname="Callback // Elder World" status="error" health={8} armor={0} frags={156} />
          </div>
        </Section>

        {/* ===== HUD STATS ===== */}
        <Section title="HUD Stats" subtitle={`Stat font ${T.type.size.stat}px, glow blur ${T.fx.glow.lg - 4}px.`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: T.space.md - 2 }}>
            <HUDStat label="Agents Alive" value="12" trend={8} glow={T.semantic.success} />
            <HUDStat label="Frags / Min" value="347" trend={-3} glow={T.semantic.highlight} />
            <HUDStat label="Queue Depth" value="89" trend={12} glow={T.semantic.info} />
          </div>
        </Section>

        {/* ===== PROGRESS ===== */}
        <Section title="Runic Meters" subtitle={`Height ${T.bar.height.meter}px, scanline gap ${T.bar.scanlineGap}px, copper gradient fill.`}>
          <CopperTexture style={{ padding: T.space.xl }}>
            <RunicMeter value={847} max={1000} label="Leads Entered Slipgate" />
            <RunicMeter value={632} max={1000} label="Rune Qualified" />
            <RunicMeter value={291} max={1000} label="Dispatched to Arena" />
            <RunicMeter value={156} max={1000} label="Fragged (Closed)" />
          </CopperTexture>
        </Section>

        {/* ===== TABS ===== */}
        <Section title="Dimension Tabs" subtitle="Episode-style navigation. Each dimension loads its own arena.">
          <RuneTabs />
        </Section>

        {/* ===== FORMS ===== */}
        <Section title="Form Controls" subtitle={`Focus glow: ${T.fx.glow.md}px copper. Toggle: ${T.semantic.success} slime.`}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: T.space.lg - 2, marginBottom: T.space.lg }}>
            <RuneInput label="Agent Classname" placeholder="e.g. SHAMBLER" />
            <RuneInput label="Spawn Interval (ms)" placeholder="100" type="number" />
          </div>
          <CopperTexture style={{ padding: T.space.lg, display: "flex", flexDirection: "column", gap: T.space.md - 2 }}>
            <RuneToggle label="Auto-respawn on telefrag" on />
            <RuneToggle label="Quad damage multiplier" />
            <RuneToggle label="Broadcast to all arenas" on />
            <RuneToggle label="Pentagram of protection (godmode)" />
          </CopperTexture>
        </Section>

        {/* ===== CONSOLE ===== */}
        <Section title="Console" subtitle={`Font ${T.type.size.console}px, line-height ${T.type.leading.consoleLine}, cursor blink ${T.anim.cursor.duration}.`}>
          <QuakeConsole lines={[
            { t: "14:32:01", lv: "---", msg: "Crankshaft v3.0 — Quake Edition initialized" },
            { t: "14:32:01", lv: "OK", msg: "4 agents spawned across 3 dimensions" },
            { t: "14:32:03", lv: "---", msg: "RANGER routing lead #4821 → qualifier slipgate" },
            { t: "14:32:04", lv: "OK", msg: "FIEND applied rune qualification — score: 87/100" },
            { t: "14:32:05", lv: "WRN", msg: "SHAMBLER health critical (38 HP) — respawn recommended" },
            { t: "14:32:06", lv: "ERR", msg: "VORE callback failed — slipgate endpoint unreachable [RETRY 2/3]" },
            { t: "14:32:08", lv: "---", msg: "Lead #4821 dispatched to arena closer DEATHKNIGHT" },
            { t: "14:32:09", lv: "OK", msg: "Arena stats: 847 frags // 12 alive // 89 queued" },
          ]} />
        </Section>

        {/* ===== TOASTS ===== */}
        <Section title="Notifications" subtitle={`Left-border severity. Fullbright dot ${T.fx.glow.sm}px.`}>
          <div style={{ display: "flex", flexDirection: "column", gap: T.space.sm - 2 }}>
            <RuneToast type="ok" msg="Agent RANGER deployed to arena DM4 — quad damage active" />
            <RuneToast type="err" msg="Slipgate connection severed — VORE lost in the void between dimensions" />
            <RuneToast type="warn" msg="Queue depth exceeds rune threshold — consider spawning reinforcements" />
            <RuneToast type="info" msg="New rune configuration detected in the Elder World" />
          </div>
        </Section>

        {/* ===== SURFACES ===== */}
        <Section title="Surface Textures" subtitle={`Grid: ${T.fx.surface.gridSize}px. Rivets: ${T.fx.rivet.size}px @ ${T.fx.rivet.offset}px.`}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: T.space.md }}>
            <CopperTexture variant="dark" style={{ padding: T.space.xl, textAlign: "center" }}>
              <div style={{ fontFamily: FONT.display, fontSize: T.type.size.label, color: Q.bone0, letterSpacing: T.type.tracking.normal }}>COPPER DARK</div>
              <div style={{ fontFamily: FONT.console, fontSize: T.type.size.labelSmall, color: Q.bone0, marginTop: T.space.xs }}>Containers, cards, panels</div>
            </CopperTexture>
            <CopperTexture variant="medium" style={{ padding: T.space.xl, textAlign: "center" }}>
              <div style={{ fontFamily: FONT.display, fontSize: T.type.size.label, color: Q.bone0, letterSpacing: T.type.tracking.normal }}>COPPER MED</div>
              <div style={{ fontFamily: FONT.console, fontSize: T.type.size.labelSmall, color: Q.bone0, marginTop: T.space.xs }}>Raised surfaces, hover</div>
            </CopperTexture>
            <RivetedPanel style={{ padding: T.space.xl, textAlign: "center" }}>
              <div style={{ fontFamily: FONT.display, fontSize: T.type.size.label, color: Q.bone0, letterSpacing: T.type.tracking.normal }}>RIVETED</div>
              <div style={{ fontFamily: FONT.console, fontSize: T.type.size.labelSmall, color: Q.bone0, marginTop: T.space.xs }}>Stat panels, HUD elements</div>
            </RivetedPanel>
          </div>
        </Section>

        {/* ===== LIVE TOKENS ===== */}
        <Section title="Design Tokens" subtitle="Live readout of T — the object every component consumes. Click to expand.">
          <LiveTokens />
        </Section>

        {/* ===== FOOTER ===== */}
        <div style={{
          borderTop: `${T.border.width.standard}px solid ${T.border.color.default}`,
          paddingTop: T.space.xxl + 4,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: T.space.md - 2 }}>
            <QuakeSymbol size={16} color={Q.iron1} />
            <span style={{ fontFamily: FONT.console, fontSize: T.type.size.labelSmall, color: Q.bone0, letterSpacing: T.type.tracking.normal }}>
              CRANKSHAFT v3 — QUAKE EDITION — 2026
            </span>
          </div>
          <span style={{ fontFamily: FONT.console, fontSize: T.type.size.labelSmall, color: Q.iron2, fontStyle: "italic" }}>
            "It is clear the door has been nailed shut."
          </span>
        </div>
      </main>
    </div>
  );
}
