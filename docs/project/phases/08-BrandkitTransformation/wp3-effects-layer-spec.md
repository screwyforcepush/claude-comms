# WP-3: Effects Layer Specification

## North Star
WORKFLOW ENGINE UI TRANSFORMATION - CLAUDE COMMS III BRANDKIT

---

## Purpose

The Effects Layer creates ambient immersion that transforms the UI from a standard application into an id Software-style control terminal. These effects (grain overlay, scanline sweep, torch flicker, fullbright pulse) are foundational visual treatments that other components will leverage for status indication and atmosphere.

**Why This Matters:**
- Grain and scanline create the "Quake dimension" atmosphere per mental model
- Torch flicker on header text reinforces the torchlit control terminal feeling
- Fullbright pulse enables status indicators across all downstream components (WP-4 through WP-7)
- Effects respect accessibility preferences, ensuring no motion sickness or performance issues

---

## Overview

WP-3 implements four distinct effect categories:
1. **Grain Overlay** - Canvas-based film grain texture with 0.7 opacity
2. **Scanline Sweep** - CSS-animated horizontal line with copper tint
3. **Torch Flicker** - Keyframe animation for header text organic light variation
4. **Fullbright Pulse** - Keyframe animation for status indicator glow cycling

All effects are CSS-first where possible, with a single React component for the canvas grain. All effects respect `prefers-reduced-motion` and disable on mobile for performance.

---

## Architecture Design

### Z-Index Layer Stack

```
┌─────────────────────────────────────────────────────┐
│ Z-INDEX LAYER STACK (Effects)                       │
├─────────────────────────────────────────────────────┤
│ z-9999: Grain overlay (canvas, pointer-events:none) │
│ z-9998: Scanline sweep (CSS animated div)           │
│ z-50+:  Modals, drawers (existing, unchanged)       │
│ z-30:   Mobile headers (existing, unchanged)        │
│ z-0:    Main content                                │
└─────────────────────────────────────────────────────┘
```

### Component Architecture

```
workflow-engine/ui/
├── styles.css           # WP-3: Animation keyframes, effect classes
├── js/
│   ├── main.js          # WP-3: GrainOverlay, ScanlineSweep components
│   └── components/
│       └── effects/     # NEW: Effects components module
│           └── index.js # GrainOverlay, ScanlineSweep exports
```

### Effect Integration Pattern

Effects are rendered at the root level of the application, wrapping all content:

```javascript
// In main.js App component
return React.createElement(ConvexProvider, { url: config.convexUrl },
  React.createElement(ErrorBoundary, null,
    React.createElement('div', { className: 'h-screen bg-gray-900 flex flex-col' },
      React.createElement(GrainOverlay),      // WP-3: Add grain overlay
      React.createElement(ScanlineSweep),     // WP-3: Add scanline sweep
      React.createElement(AppLayout)
    )
  )
);
```

---

## Dependency Map

```
WP-1: Foundation (CSS tokens, fonts) ✅ COMPLETE
  │
  └── WP-2: Surface Primitives (textures, rivets, glows) ✅ COMPLETE
        │
        └── WP-3: Effects Layer (grain, scanline, flicker, pulse) ← YOU ARE HERE
              │
              ├── Provides: @keyframes torch-flicker
              ├── Provides: @keyframes fullbright-pulse
              ├── Provides: .grain-overlay CSS
              ├── Provides: .scanline-sweep CSS
              │
              └── Required by: WP-4+ (status indicators use fullbright-pulse)
```

**Parallelization Note:** WP-3 can run in parallel with WP-4 (Shared Components) since WP-4's button/input styles don't depend on effects, only the StatusRune pattern needs fullbright-pulse which is CSS-only.

---

## Detailed Specifications

### 1. Grain Overlay

**Reference:** `brandkit.jsx` lines 222-241

**Approach Decision: Canvas-based with SVG fallback consideration**

After research, canvas-based grain is preferred for this implementation because:
- Brandkit reference uses canvas explicitly
- Provides precise control over grain intensity (25) and alpha (35)
- Can render warm-tinted grain (v * 0.9 green, v * 0.7 blue for copper warmth)
- Static generation (one-time render) has negligible performance impact

**Token Values:**
- `T.fx.grain.opacity`: 0.7 (CSS var: `--t-fx-grain-opacity`)
- `T.fx.grain.blend`: overlay
- `T.fx.grain.intensity`: 25
- `T.fx.grain.alpha`: 35

**React Component Implementation:**

```javascript
// workflow-engine/ui/js/components/effects/index.js

/**
 * GrainOverlay - Canvas-based film grain effect
 * Renders once on mount, applies as fixed overlay
 * Respects prefers-reduced-motion
 */
export function GrainOverlay() {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      canvas.style.display = 'none';
      return;
    }

    const ctx = canvas.getContext('2d');
    // 512x512 prevents visible tiling on large displays
    const size = 512;
    canvas.width = size;
    canvas.height = size;

    const imageData = ctx.createImageData(size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = Math.random() * 25; // T.fx.grain.intensity
      imageData.data[i] = v;           // R
      imageData.data[i + 1] = v * 0.9; // G (warm tint)
      imageData.data[i + 2] = v * 0.7; // B (warm tint)
      imageData.data[i + 3] = 35;      // A (T.fx.grain.alpha)
    }
    ctx.putImageData(imageData, 0, 0);
  }, []);

  return React.createElement('canvas', {
    ref: canvasRef,
    className: 'grain-overlay',
    'aria-hidden': 'true'
  });
}
```

**CSS Classes:**

```css
/* Grain overlay positioning - fixed fullscreen */
.grain-overlay {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
  opacity: var(--t-fx-grain-opacity, 0.7);
  mix-blend-mode: overlay;
}

/* Mobile: Disable grain for performance */
@media (max-width: 767px) {
  .grain-overlay {
    display: none;
  }
}

/* Reduced motion: Hide grain */
@media (prefers-reduced-motion: reduce) {
  .grain-overlay {
    display: none;
  }
}
```

**Success Criteria:**
- [x] Grain renders at 0.7 opacity with warm copper tint
- [x] Canvas is 512x512 to prevent tiling artifacts
- [x] Fixed position covers full viewport
- [x] pointer-events: none allows interaction below
- [x] Hidden on mobile (<768px)
- [x] Hidden when prefers-reduced-motion

---

### 2. Scanline Sweep

**Reference:** `brandkit.jsx` lines 781-814 (main component render)

**Approach Decision: CSS transform animation**

Research confirms `transform: translateY()` is superior to `top` animation:
- GPU-accelerated compositing layer
- No layout recalculation (reflow)
- Maintains 60fps reliably

**Token Values:**
- `T.fx.scanline.height`: 1 (1px line)
- `T.fx.scanline.tint`: Q.copper1 (#7a4e28)
- `T.fx.scanline.alpha`: "06" (6% opacity hex)
- `T.anim.scanline.speed`: 0.4 (px per frame, translates to ~5s animation)

**React Component Implementation:**

```javascript
/**
 * ScanlineSweep - CSS-animated horizontal scanline
 * Sweeps vertically from top to bottom
 * Respects prefers-reduced-motion
 */
export function ScanlineSweep() {
  // Check reduced motion on mount
  const [shouldAnimate, setShouldAnimate] = React.useState(true);

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShouldAnimate(false);
    }
  }, []);

  if (!shouldAnimate) return null;

  return React.createElement('div', {
    className: 'scanline-sweep',
    'aria-hidden': 'true'
  });
}
```

**CSS Implementation:**

```css
/* Scanline sweep - animated horizontal line */
.scanline-sweep {
  position: fixed;
  left: 0;
  right: 0;
  height: 1px;
  top: 0;
  background: linear-gradient(90deg,
    transparent 5%,
    var(--q-copper1-06) 30%,
    var(--q-copper1-06) 70%,
    transparent 95%);
  z-index: 9998;
  pointer-events: none;
  animation: scanline-move 5s linear infinite;
  will-change: transform;
}

@keyframes scanline-move {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(100vh);
  }
}

/* Mobile: Disable scanline for performance */
@media (max-width: 767px) {
  .scanline-sweep {
    display: none;
  }
}

/* Reduced motion: Disable animation and hide */
@media (prefers-reduced-motion: reduce) {
  .scanline-sweep {
    animation: none;
    display: none;
  }
}
```

**Success Criteria:**
- [x] Scanline is 1px height with copper-tinted gradient
- [x] Uses transform: translateY for GPU acceleration
- [x] 5s animation duration (smooth speed)
- [x] will-change: transform hints browser optimization
- [x] Hidden on mobile (<768px)
- [x] Hidden when prefers-reduced-motion

---

### 3. Torch Flicker Animation

**Reference:** `brandkit.jsx` lines 801-804, T.anim.flicker

**Token Values:**
- `T.anim.flicker.duration`: "6s"
- `T.anim.flicker.keyframes`: "91%-92%: 0.85 → 93%: 1 → 96%: 0.92 → 97%: 1"

**Approach:** Pure CSS keyframe animation targeting opacity. Applied via utility class.

**CSS Implementation:**

```css
/* Torch flicker - organic flame-like opacity variation */
@keyframes torch-flicker {
  0%, 90%, 100% {
    opacity: 1;
  }
  91% {
    opacity: 1;
  }
  92% {
    opacity: 0.85;
  }
  93% {
    opacity: 1;
  }
  96% {
    opacity: 0.92;
  }
  97% {
    opacity: 1;
  }
}

/* Utility class for torch flicker effect */
.torch-flicker {
  animation: torch-flicker 6s infinite;
}

/* Reduced motion: Disable flicker */
@media (prefers-reduced-motion: reduce) {
  .torch-flicker {
    animation: none;
  }
}
```

**Usage Pattern:**
```html
<h1 class="torch-flicker">CLAUDE COMMS III</h1>
```

**Success Criteria:**
- [x] Keyframes match brandkit specification exactly
- [x] 6s duration creates subtle, non-distracting flicker
- [x] Flicker pattern is organic (not mechanical)
- [x] Disabled when prefers-reduced-motion

---

### 4. Fullbright Pulse Animation

**Reference:** `brandkit.jsx` lines 800, 208-216 (Fullbright component)

**Token Values:**
- `T.anim.pulse.duration`: "2.5s"
- `T.anim.pulse.easing`: "ease-in-out"

**Approach:** Pure CSS keyframe animation targeting opacity. Applied via utility class.

**CSS Implementation:**

```css
/* Fullbright pulse - status indicator glow cycling */
@keyframes fullbright-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

/* Utility class for fullbright pulse effect */
.fullbright-pulse {
  animation: fullbright-pulse 2.5s ease-in-out infinite;
}

/* Reduced motion: Disable pulse, maintain static visibility */
@media (prefers-reduced-motion: reduce) {
  .fullbright-pulse {
    animation: none;
    opacity: 1;
  }
}
```

**Usage Pattern:**
```html
<span class="fullbright-dot fullbright-pulse"></span>
```

**Success Criteria:**
- [x] 2.5s duration with ease-in-out easing
- [x] Opacity cycles 1 → 0.3 → 1
- [x] Disabled when prefers-reduced-motion (static at opacity 1)

---

### 5. Cursor Blink Animation

**Reference:** `brandkit.jsx` line 514, T.anim.cursor.duration

**Token Values:**
- `T.anim.cursor.duration`: "1s"

**Approach:** Pure CSS keyframe for console cursor elements.

**CSS Implementation:**

```css
/* Cursor blink - console cursor animation */
@keyframes cursor-blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

/* Utility class for cursor blink */
.cursor-blink {
  animation: cursor-blink 1s step-end infinite;
}

/* Reduced motion: Static cursor */
@media (prefers-reduced-motion: reduce) {
  .cursor-blink {
    animation: none;
    opacity: 1;
  }
}
```

**Success Criteria:**
- [x] 1s duration with step-end for hard blink
- [x] Disabled when prefers-reduced-motion

---

## File-Level Change Summary

| File | Changes |
|------|---------|
| `workflow-engine/ui/styles.css` | Add @keyframes (torch-flicker, fullbright-pulse, cursor-blink, scanline-move), add utility classes (.torch-flicker, .fullbright-pulse, .cursor-blink), add effect classes (.grain-overlay, .scanline-sweep) |
| `workflow-engine/ui/js/components/effects/index.js` | NEW: GrainOverlay, ScanlineSweep React components |
| `workflow-engine/ui/js/main.js` | Import and render GrainOverlay, ScanlineSweep in App component |

---

## Work Package Success Criteria

| Criterion | Verification Method |
|-----------|---------------------|
| Grain overlay renders at 0.7 opacity with proper noise pattern | Visual inspection, DevTools computed styles |
| Scanline sweep animates vertically with copper tint | Visual inspection, animation plays smoothly |
| Torch flicker keyframes available for status indicators | Apply .torch-flicker class, observe effect |
| Fullbright pulse keyframes available for urgent states | Apply .fullbright-pulse class, observe effect |
| All effects respect prefers-reduced-motion | Toggle system setting, verify effects disabled |
| No performance regressions (60fps maintained) | Chrome DevTools Performance tab, FPS meter |
| Effects don't block interaction | Click through grain/scanline, verify events fire |
| Mobile performance (effects disabled <768px) | Resize viewport, verify effects hidden |

---

## UAT Test Scenarios

| ID | Scenario | Expected Result | Priority |
|----|----------|-----------------|----------|
| E3-01 | View UI at desktop (>1440px) | Grain visible, scanline sweeping | High |
| E3-02 | View UI at mobile (<768px) | No grain, no scanline (performance) | High |
| E3-03 | System prefers-reduced-motion ON | All animations disabled | High |
| E3-04 | Apply .torch-flicker to header text | Text flickers subtly every 6s | High |
| E3-05 | Apply .fullbright-pulse to status dot | Dot pulses 1→0.3→1 over 2.5s | High |
| E3-06 | Click button through grain overlay | Button click registers normally | High |
| E3-07 | Scroll page with grain overlay | No scroll performance issues | Medium |
| E3-08 | Chrome DevTools FPS test | Maintains 60fps with effects | High |
| E3-09 | Grain tiling check on 4K display | No visible tile seams (512x512) | Medium |
| E3-10 | Scanline color matches copper1-06 | Copper tint visible in gradient | Medium |

---

## Implementation Notes

### CSS Variable Dependencies

WP-3 requires these CSS variables from WP-1 (already implemented):
- `--t-fx-grain-opacity: 0.7` (line 120)
- `--q-copper1-06: #7a4e280f` (line 40)

### Integration with Existing Reduced Motion

WP-1 already includes a global reduced motion rule (lines 162-170):
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

WP-3 adds specific overrides for effect hiding (display: none) in addition to animation disabling.

### Module Structure

Create new effects module to maintain separation of concerns:
```
workflow-engine/ui/js/components/effects/
└── index.js    # exports { GrainOverlay, ScanlineSweep }
```

---

## Review Checklist for Implementer

- [ ] CSS keyframes match brandkit timing exactly
- [ ] Effects use GPU-accelerated properties (transform, opacity)
- [ ] No layout-triggering properties animated (top, left, width, height)
- [ ] All effects have pointer-events: none
- [ ] Mobile media query disables effects at <768px
- [ ] prefers-reduced-motion respected for all animations
- [ ] Canvas grain uses warm copper tint (RGB multipliers)
- [ ] Scanline uses translateY not top property
- [ ] Effect components are aria-hidden="true"

---

## Open Questions / Decisions Needed

**None** - All architectural decisions have been made in the parent spec and research phase.

---

## Artifacts

- **Spec Document**: `docs/project/phases/08-BrandkitTransformation/wp3-effects-layer-spec.md` (this file)
- **Parent Spec**: `docs/project/phases/08-BrandkitTransformation/spec.md`
- **Brandkit Reference**: `docs/project/guides/styleguide/brandkit.jsx`

---

## Completion Record

**Status:** ✅ COMPLETE
**Approval:** D13 (Plan D11, Implementation D12)
**Date:** 2026-02-03

### Review Summary
- **Review A:** PASS - All criteria met, spec adherence verified
- **Review B:** PASS with minor concerns - 3 low-severity deferred issues identified
- **Review C:** PASS with concerns - torch-flicker behavior noted as intentional
- **UAT:** PASS - All 10 test scenarios validated

### Files Modified
| File | Description |
|------|-------------|
| `workflow-engine/ui/styles.css` | Lines 1766-1903: WP-3 keyframes and utility classes |
| `workflow-engine/ui/js/components/effects/index.js` | NEW: GrainOverlay, ScanlineSweep React components |
| `workflow-engine/ui/js/main.js` | Effects integration at root App level |

### Deferred Issues (Non-blocking)
These issues were identified during review but deemed non-blocking for WP-3 completion:

1. **Canvas null guard** (Low) - `canvas.getContext('2d')` could return null on unsupported contexts
2. **Mobile canvas generation** (Low) - Grain canvas still generates on mobile even though CSS hides it
3. **Loading screen effects** (Low) - Effects only render in main app path, not loading/error/config screens

### Design Decisions Documented
- **512x512 canvas** (vs 200x200 brandkit): Intentional to prevent tiling on 4K displays
- **CSS-only scanline**: Uses `transform: translateY` instead of requestAnimationFrame for GPU acceleration
- **torch-flicker stutter pattern**: Intentional per brandkit - creates organic flame variation

---

*WP-3 Effects Layer - Claude Comms III Brandkit Transformation*
