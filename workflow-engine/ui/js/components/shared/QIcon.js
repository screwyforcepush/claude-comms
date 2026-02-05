// QIcon - Quake-themed iconography system
// Ported from brandkit.jsx - All 27 icons with React.createElement syntax
import React from 'react';

// =============================================================
//  ICON_CONFIG - Design tokens for icons
//  Ported from T.icon in brandkit.jsx
// =============================================================
export const ICON_CONFIG = {
  size: { xs: 14, sm: 18, md: 24, lg: 32, xl: 48 },
  stroke: { thin: 1.5, normal: 2, bold: 2.5 },
  viewBox: '0 0 24 24',
};

// =============================================================
//  ICON_PATHS - SVG path generators for each icon
//  Each function takes strokeWidth (sw) and returns React elements
// =============================================================
export const ICON_PATHS = {
  // --- Navigation & Routing ---
  slipgate: (sw) => React.createElement(React.Fragment, null,
    React.createElement('ellipse', { cx: 12, cy: 12, rx: 7, ry: 10, stroke: 'currentColor', strokeWidth: sw, fill: 'none' }),
    React.createElement('ellipse', { cx: 12, cy: 12, rx: 3, ry: 6, stroke: 'currentColor', strokeWidth: sw * 0.7, fill: 'none', opacity: 0.5 }),
    React.createElement('line', { x1: 12, y1: 2, x2: 12, y2: 4, stroke: 'currentColor', strokeWidth: sw }),
    React.createElement('line', { x1: 12, y1: 20, x2: 12, y2: 22, stroke: 'currentColor', strokeWidth: sw })
  ),
  route: (sw) => React.createElement(React.Fragment, null,
    React.createElement('polyline', { points: '4,12 8,6 16,18 20,12', stroke: 'currentColor', strokeWidth: sw, fill: 'none', strokeLinejoin: 'miter' }),
    React.createElement('circle', { cx: 4, cy: 12, r: 1.5, fill: 'currentColor' }),
    React.createElement('circle', { cx: 20, cy: 12, r: 1.5, fill: 'currentColor' })
  ),
  dispatch: (sw) => React.createElement(React.Fragment, null,
    React.createElement('path', { d: 'M4 12h12', stroke: 'currentColor', strokeWidth: sw }),
    React.createElement('path', { d: 'M14 7l6 5-6 5', stroke: 'currentColor', strokeWidth: sw, fill: 'none', strokeLinejoin: 'miter' })
  ),

  // --- Weapons / Actions ---
  axe: (sw) => React.createElement(React.Fragment, null,
    React.createElement('line', { x1: 6, y1: 18, x2: 18, y2: 6, stroke: 'currentColor', strokeWidth: sw }),
    React.createElement('path', { d: 'M14 4 L20 4 L20 10 L17 8 L16 7Z', stroke: 'currentColor', strokeWidth: sw * 0.7, fill: 'currentColor', opacity: 0.7 })
  ),
  nailgun: (sw) => React.createElement(React.Fragment, null,
    React.createElement('rect', { x: 6, y: 9, width: 12, height: 6, stroke: 'currentColor', strokeWidth: sw, fill: 'none' }),
    React.createElement('line', { x1: 18, y1: 12, x2: 22, y2: 12, stroke: 'currentColor', strokeWidth: sw }),
    React.createElement('line', { x1: 10, y1: 9, x2: 10, y2: 15, stroke: 'currentColor', strokeWidth: sw * 0.7 }),
    React.createElement('line', { x1: 14, y1: 9, x2: 14, y2: 15, stroke: 'currentColor', strokeWidth: sw * 0.7 }),
    React.createElement('rect', { x: 2, y: 10, width: 4, height: 4, stroke: 'currentColor', strokeWidth: sw * 0.7, fill: 'none' })
  ),
  rocket: (sw) => React.createElement(React.Fragment, null,
    React.createElement('path', { d: 'M12 3 L16 10 L14 10 L14 19 L10 19 L10 10 L8 10Z', stroke: 'currentColor', strokeWidth: sw, fill: 'none', strokeLinejoin: 'miter' }),
    React.createElement('line', { x1: 10, y1: 19, x2: 8, y2: 22, stroke: 'currentColor', strokeWidth: sw * 0.7 }),
    React.createElement('line', { x1: 14, y1: 19, x2: 16, y2: 22, stroke: 'currentColor', strokeWidth: sw * 0.7 }),
    React.createElement('line', { x1: 12, y1: 19, x2: 12, y2: 22, stroke: 'currentColor', strokeWidth: sw * 0.7 })
  ),
  lightning: (sw) => React.createElement('path', {
    d: 'M13 2 L8 11 L12 11 L11 22 L16 13 L12 13Z',
    stroke: 'currentColor',
    strokeWidth: sw,
    fill: 'none',
    strokeLinejoin: 'miter'
  }),

  // --- Status / HUD ---
  health: (sw) => React.createElement(React.Fragment, null,
    React.createElement('rect', { x: 4, y: 4, width: 16, height: 16, stroke: 'currentColor', strokeWidth: sw, fill: 'none' }),
    React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 16, stroke: 'currentColor', strokeWidth: sw + 0.5 }),
    React.createElement('line', { x1: 8, y1: 12, x2: 16, y2: 12, stroke: 'currentColor', strokeWidth: sw + 0.5 })
  ),
  armor: (sw) => React.createElement('path', {
    d: 'M12 3 L4 7 L4 13 C4 17 7 20 12 22 C17 20 20 17 20 13 L20 7Z',
    stroke: 'currentColor',
    strokeWidth: sw,
    fill: 'none',
    strokeLinejoin: 'miter'
  }),
  skull: (sw) => React.createElement(React.Fragment, null,
    React.createElement('path', { d: 'M6 14 C6 7, 18 7, 18 14 L18 16 L15 16 L14 18 L10 18 L9 16 L6 16Z', stroke: 'currentColor', strokeWidth: sw, fill: 'none' }),
    React.createElement('circle', { cx: 10, cy: 12, r: 1.5, fill: 'currentColor' }),
    React.createElement('circle', { cx: 14, cy: 12, r: 1.5, fill: 'currentColor' })
  ),
  pentagram: (sw) => {
    const pts = [0, 1, 2, 3, 4].map(i => {
      const a = (i * 72 - 90) * Math.PI / 180;
      return [12 + 9 * Math.cos(a), 12 + 9 * Math.sin(a)];
    });
    const order = [0, 2, 4, 1, 3, 0];
    const d = order.map((idx, i) => `${i === 0 ? 'M' : 'L'}${pts[idx][0].toFixed(1)},${pts[idx][1].toFixed(1)}`).join(' ') + 'Z';
    return React.createElement('path', { d, stroke: 'currentColor', strokeWidth: sw, fill: 'none', strokeLinejoin: 'miter' });
  },

  // --- Keys & Access ---
  keyGold: (sw) => React.createElement(React.Fragment, null,
    React.createElement('circle', { cx: 8, cy: 8, r: 4, stroke: 'currentColor', strokeWidth: sw, fill: 'none' }),
    React.createElement('circle', { cx: 8, cy: 8, r: 1.5, fill: 'currentColor', opacity: 0.4 }),
    React.createElement('line', { x1: 12, y1: 8, x2: 20, y2: 8, stroke: 'currentColor', strokeWidth: sw }),
    React.createElement('line', { x1: 18, y1: 8, x2: 18, y2: 12, stroke: 'currentColor', strokeWidth: sw }),
    React.createElement('line', { x1: 15, y1: 8, x2: 15, y2: 11, stroke: 'currentColor', strokeWidth: sw * 0.7 })
  ),
  rune: (sw) => React.createElement(React.Fragment, null,
    React.createElement('rect', { x: 5, y: 3, width: 14, height: 18, stroke: 'currentColor', strokeWidth: sw, fill: 'none' }),
    React.createElement('path', { d: 'M9 7 L12 10 L15 7', stroke: 'currentColor', strokeWidth: sw * 0.8, fill: 'none' }),
    React.createElement('line', { x1: 12, y1: 10, x2: 12, y2: 17, stroke: 'currentColor', strokeWidth: sw * 0.8 }),
    React.createElement('line', { x1: 9, y1: 14, x2: 15, y2: 14, stroke: 'currentColor', strokeWidth: sw * 0.8 })
  ),

  // --- System UI ---
  eye: (sw) => React.createElement(React.Fragment, null,
    React.createElement('path', { d: 'M2 12 C5 7, 19 7, 22 12 C19 17, 5 17, 2 12Z', stroke: 'currentColor', strokeWidth: sw, fill: 'none' }),
    React.createElement('circle', { cx: 12, cy: 12, r: 3, stroke: 'currentColor', strokeWidth: sw, fill: 'none' }),
    React.createElement('circle', { cx: 12, cy: 12, r: 1, fill: 'currentColor' })
  ),
  search: (sw) => React.createElement(React.Fragment, null,
    React.createElement('circle', { cx: 10, cy: 10, r: 6, stroke: 'currentColor', strokeWidth: sw, fill: 'none' }),
    React.createElement('line', { x1: 15, y1: 15, x2: 21, y2: 21, stroke: 'currentColor', strokeWidth: sw + 0.5 })
  ),
  config: (sw) => React.createElement(React.Fragment, null,
    React.createElement('rect', { x: 4, y: 4, width: 16, height: 16, stroke: 'currentColor', strokeWidth: sw, fill: 'none' }),
    React.createElement('line', { x1: 8, y1: 4, x2: 8, y2: 20, stroke: 'currentColor', strokeWidth: sw * 0.6, opacity: 0.4 }),
    React.createElement('line', { x1: 16, y1: 4, x2: 16, y2: 20, stroke: 'currentColor', strokeWidth: sw * 0.6, opacity: 0.4 }),
    React.createElement('line', { x1: 4, y1: 8, x2: 20, y2: 8, stroke: 'currentColor', strokeWidth: sw * 0.6, opacity: 0.4 }),
    React.createElement('line', { x1: 4, y1: 16, x2: 20, y2: 16, stroke: 'currentColor', strokeWidth: sw * 0.6, opacity: 0.4 }),
    React.createElement('rect', { x: 10, y: 10, width: 4, height: 4, fill: 'currentColor', opacity: 0.6 })
  ),
  add: (sw) => React.createElement(React.Fragment, null,
    React.createElement('line', { x1: 12, y1: 5, x2: 12, y2: 19, stroke: 'currentColor', strokeWidth: sw }),
    React.createElement('line', { x1: 5, y1: 12, x2: 19, y2: 12, stroke: 'currentColor', strokeWidth: sw })
  ),
  close: (sw) => React.createElement(React.Fragment, null,
    React.createElement('line', { x1: 6, y1: 6, x2: 18, y2: 18, stroke: 'currentColor', strokeWidth: sw }),
    React.createElement('line', { x1: 18, y1: 6, x2: 6, y2: 18, stroke: 'currentColor', strokeWidth: sw })
  ),
  check: (sw) => React.createElement('polyline', {
    points: '5,13 10,18 19,6',
    stroke: 'currentColor',
    strokeWidth: sw,
    fill: 'none',
    strokeLinejoin: 'miter'
  }),
  warning: (sw) => React.createElement(React.Fragment, null,
    React.createElement('path', { d: 'M12 3 L2 21 L22 21Z', stroke: 'currentColor', strokeWidth: sw, fill: 'none', strokeLinejoin: 'miter' }),
    React.createElement('line', { x1: 12, y1: 10, x2: 12, y2: 15, stroke: 'currentColor', strokeWidth: sw }),
    React.createElement('rect', { x: 11, y: 17, width: 2, height: 2, fill: 'currentColor' })
  ),
  info: (sw) => React.createElement(React.Fragment, null,
    React.createElement('rect', { x: 4, y: 4, width: 16, height: 16, stroke: 'currentColor', strokeWidth: sw, fill: 'none' }),
    React.createElement('rect', { x: 11, y: 6, width: 2, height: 2, fill: 'currentColor' }),
    React.createElement('line', { x1: 12, y1: 10, x2: 12, y2: 18, stroke: 'currentColor', strokeWidth: sw })
  ),
  chevronRight: (sw) => React.createElement('polyline', {
    points: '9,4 17,12 9,20',
    stroke: 'currentColor',
    strokeWidth: sw,
    fill: 'none',
    strokeLinejoin: 'miter'
  }),
  chevronDown: (sw) => React.createElement('polyline', {
    points: '4,9 12,17 20,9',
    stroke: 'currentColor',
    strokeWidth: sw,
    fill: 'none',
    strokeLinejoin: 'miter'
  }),
  menu: (sw) => React.createElement(React.Fragment, null,
    React.createElement('line', { x1: 4, y1: 7, x2: 20, y2: 7, stroke: 'currentColor', strokeWidth: sw }),
    React.createElement('line', { x1: 4, y1: 12, x2: 20, y2: 12, stroke: 'currentColor', strokeWidth: sw }),
    React.createElement('line', { x1: 4, y1: 17, x2: 20, y2: 17, stroke: 'currentColor', strokeWidth: sw })
  ),
  spawn: (sw) => React.createElement(React.Fragment, null,
    React.createElement('circle', { cx: 12, cy: 12, r: 8, stroke: 'currentColor', strokeWidth: sw, fill: 'none' }),
    React.createElement('circle', { cx: 12, cy: 12, r: 3, stroke: 'currentColor', strokeWidth: sw * 0.7, fill: 'none' }),
    React.createElement('line', { x1: 12, y1: 4, x2: 12, y2: 7, stroke: 'currentColor', strokeWidth: sw * 0.7 }),
    React.createElement('line', { x1: 12, y1: 17, x2: 12, y2: 20, stroke: 'currentColor', strokeWidth: sw * 0.7 }),
    React.createElement('line', { x1: 4, y1: 12, x2: 7, y2: 12, stroke: 'currentColor', strokeWidth: sw * 0.7 }),
    React.createElement('line', { x1: 17, y1: 12, x2: 20, y2: 12, stroke: 'currentColor', strokeWidth: sw * 0.7 })
  ),
  frag: (sw) => React.createElement(React.Fragment, null,
    React.createElement('line', { x1: 12, y1: 4, x2: 12, y2: 20, stroke: 'currentColor', strokeWidth: sw * 0.7 }),
    React.createElement('line', { x1: 4, y1: 12, x2: 20, y2: 12, stroke: 'currentColor', strokeWidth: sw * 0.7 }),
    React.createElement('line', { x1: 6, y1: 6, x2: 18, y2: 18, stroke: 'currentColor', strokeWidth: sw * 0.5, opacity: 0.5 }),
    React.createElement('line', { x1: 18, y1: 6, x2: 6, y2: 18, stroke: 'currentColor', strokeWidth: sw * 0.5, opacity: 0.5 }),
    React.createElement('circle', { cx: 12, cy: 12, r: 1.5, fill: 'currentColor' })
  ),
  quad: (sw) => React.createElement(React.Fragment, null,
    React.createElement('rect', { x: 4, y: 4, width: 16, height: 16, stroke: 'currentColor', strokeWidth: sw, fill: 'none', transform: 'rotate(45 12 12)' }),
    React.createElement('rect', { x: 8, y: 8, width: 8, height: 8, stroke: 'currentColor', strokeWidth: sw * 0.6, fill: 'none', transform: 'rotate(45 12 12)' }),
    React.createElement('circle', { cx: 12, cy: 12, r: 1.5, fill: 'currentColor' })
  ),
};

// =============================================================
//  QIcon - Quake-themed SVG icon component
//  Usage: <QIcon name="slipgate" size={24} color="#d4a030" glow />
// =============================================================
/**
 * QIcon component - renders Quake-themed SVG icons
 * @param {Object} props
 * @param {string} props.name - Icon name from ICON_PATHS
 * @param {number} props.size - Icon size in pixels, defaults to 24 (md)
 * @param {string} props.color - Icon color, defaults to 'currentColor'
 * @param {number} props.strokeWidth - Stroke width, defaults to 2 (normal)
 * @param {boolean} props.glow - Whether to apply glow filter effect
 */
export function QIcon({ name, size = ICON_CONFIG.size.md, color = 'currentColor', strokeWidth, glow }) {
  const sw = strokeWidth || ICON_CONFIG.stroke.normal;
  const pathFn = ICON_PATHS[name];

  if (!pathFn) return null;

  const glowId = glow ? `icon-glow-${name}-${Math.random().toString(36).slice(2, 6)}` : null;

  // Build children array
  const children = [];

  // Add glow filter defs if glow is enabled
  if (glow) {
    children.push(
      React.createElement('defs', { key: 'defs' },
        React.createElement('filter', { id: glowId },
          React.createElement('feGaussianBlur', { stdDeviation: '1.5', result: 'b' }),
          React.createElement('feMerge', null,
            React.createElement('feMergeNode', { in: 'b' }),
            React.createElement('feMergeNode', { in: 'SourceGraphic' })
          )
        )
      )
    );
  }

  // Add icon paths wrapped in group
  children.push(
    React.createElement('g', {
      key: 'g',
      filter: glow ? `url(#${glowId})` : undefined
    }, pathFn(sw))
  );

  return React.createElement('svg', {
    width: size,
    height: size,
    viewBox: ICON_CONFIG.viewBox,
    fill: 'none',
    style: {
      color,
      display: 'inline-block',
      verticalAlign: 'middle',
      flexShrink: 0
    }
  }, children);
}

export default QIcon;
