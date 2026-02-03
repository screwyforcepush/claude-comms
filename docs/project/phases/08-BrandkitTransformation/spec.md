# Phase 08: Workflow Engine UI - Claude Comms III Brandkit Transformation

## North Star
WORKFLOW ENGINE UI TRANSFORMATION - CLAUDE COMMS III BRANDKIT

Transform the workflow engine UI from its generic gray Tailwind aesthetic into the full Quake-inspired 'Claude Comms III - Workflow Engine' brand identity.

---

## Purpose

The workflow engine UI currently uses a standard dark-gray Tailwind CSS aesthetic. This transformation applies the Claude Comms III brandkit—inspired by id Software's Quake (1996)—to create a distinctive, immersive control terminal experience. The goal is to make the UI feel like an id Software game control interface with copper rivets, torchlit indicators, void-dark backgrounds, runic typography, and the distinctive NIN/American McGee palette.

**Business Value:**
- Creates a cohesive, memorable brand identity
- Differentiates the product visually
- Enhances user engagement through immersive design

---

## Overview

This is a **visual transformation only**. All existing functionality, business logic, responsive breakpoints, drawer behaviors, and data contracts remain unchanged. The transformation skins every UI surface with the brandkit aesthetic while preserving 100% feature parity.

### Brandkit Source
`docs/project/guides/styleguide/brandkit.jsx` contains the complete design system:
- **Q palette**: void, stone, copper, torch, lava, slime, teleport, bone, iron
- **T tokens**: spacing, typography, borders, animations, effects
- **FONT stack**: Silkscreen (display), IBM Plex Mono (console), Chakra Petch (body)
- **Component patterns**: CopperTexture, RivetedPanel, StatusRune, QButton, AgentHUD, etc.

### Scope
- **IN**: `workflow-engine/ui/**` (all JS components, styles.css, index.html)
- **OUT**: Backend/Convex, business logic, data contracts, all other directories

---

## Architecture Design

### CSS Architecture Strategy

**Decision: CSS Custom Properties + BEM-lite Organization**

Rationale:
1. **Pure CSS approach** aligns with current vanilla CSS architecture (no CSS-in-JS)
2. **CSS custom properties** enable centralized token management and easy theming
3. **BEM-lite naming** maintains current class naming patterns while adding structure
4. **Single stylesheet** keeps the architecture simple and maintainable

#### Tailwind Migration Strategy

**Decision: Hybrid Approach — Keep Tailwind for Layout, Migrate Colors to Q Palette**

The current UI loads Tailwind CSS from CDN. Rather than removing Tailwind entirely (high effort, risk of layout regressions), we will:
1. **KEEP** Tailwind for spacing, flex, grid, positioning utilities
2. **MIGRATE** all color classes (`bg-gray-*`, `text-gray-*`, `border-gray-*`) to Q palette CSS vars
3. **ADD** Q palette custom properties alongside Tailwind
4. **REMOVE** gray color classes during WP-8 integration sweep

This hybrid approach minimizes scope creep while achieving the visual transformation.

#### Token Structure

**CRITICAL: CSS Alpha Syntax**

CSS custom properties cannot have alpha values appended directly (e.g., `var(--q-stone0)40` is invalid).

For colors requiring alpha, use one of these patterns:
1. **Pre-computed alpha variants**: `--q-stone0-40: #16120d66;`
2. **RGB tokens with rgba()**: `--q-stone0-rgb: 22, 18, 13;` → `rgba(var(--q-stone0-rgb), 0.4)`

The implementation will use pre-computed alpha variants for common use cases.

```
:root {
  /* Q Palette - Color System */
  --q-void0: #060504;
  --q-void1: #0c0a07;
  --q-stone0: #16120d;
  /* ... all Q colors ... */

  /* Q Palette - Alpha Variants (pre-computed for common uses) */
  --q-stone0-40: #16120d66;   /* 40% opacity - grid lines */
  --q-stone0-30: #16120d4d;   /* 30% opacity - horizontal grid */
  --q-copper1-06: #7a4e280f;  /* 6% opacity - scanline tint */
  --q-iron1-33: #504c4054;    /* 33% opacity - rivet highlight */
  --q-iron1-44: #504c4070;    /* 44% opacity - top border tint */
  /* ... other alpha variants as needed ... */

  /* T Tokens - Design Primitives */
  --t-border-radius: 0;
  --t-border-width-standard: 1px;
  --t-space-unit: 4px;
  /* ... all T tokens ... */

  /* FONT Stack */
  --font-display: 'Silkscreen', monospace;
  --font-console: 'IBM Plex Mono', monospace;
  --font-body: 'Chakra Petch', sans-serif;

  /* Semantic Mappings */
  --color-success: var(--q-slime1);
  --color-danger: var(--q-lava1);
  --color-warning: var(--q-torch);
  /* ... */
}
```

### Component Transformation Strategy

**Flavor Adoption, Not 1:1 Porting**

The brandkit.jsx is a reference implementation, not a component library. Each UI component adopts the aesthetic DNA:
- Apply Q palette colors via CSS custom properties
- Use T tokens for spacing, typography, borders
- Add surface treatments (gradients, rivets) where appropriate
- Implement status indicators as fullbright glows

### Effects Architecture

```
┌─────────────────────────────────────────────────────┐
│ Z-INDEX LAYER STACK                                  │
├─────────────────────────────────────────────────────┤
│ z-9999: Grain overlay (canvas, pointer-events:none) │
│ z-9998: Scanline sweep (CSS animated div)           │
│ z-50+:  Modals, drawers (existing)                  │
│ z-30:   Mobile headers (existing)                   │
│ z-0:    Main content                                │
└─────────────────────────────────────────────────────┘
```

---

## Dependency Map

```
WP-1: Foundation (CSS tokens, fonts, base styles)
  │
  ├── WP-2: Surface Primitives (depends on WP-1)
  │     │
  │     ├── WP-3: Effects Layer (depends on WP-2)
  │     │
  │     └── WP-4: Shared Components (depends on WP-2)
  │           │
  │           ├── WP-5: Namespace Components (depends on WP-4)
  │           │
  │           ├── WP-6: Chat Components (depends on WP-4)
  │           │
  │           └── WP-7: Job Components (depends on WP-4)
  │
  └── WP-8: Integration & Polish (depends on WP-3, WP-5, WP-6, WP-7)
```

**Parallelization Opportunities:**
- WP-5, WP-6, WP-7 can run in parallel after WP-4 completes
- WP-3 can run in parallel with WP-4

---

## Work Package Breakdown

### WP-1: Foundation - CSS Tokens & Font Integration
**Scope:** `index.html`, `styles.css` (token section)

#### Deliverables
1. Add Google Fonts link for Silkscreen, IBM Plex Mono, Chakra Petch
2. Define all CSS custom properties from Q palette
3. Define all CSS custom properties from T tokens
4. Update base body/html styles with Q.void0 background
5. Update scrollbar styling with Q palette

#### File Changes
| File | Changes |
|------|---------|
| `index.html` | Add Google Fonts preconnect and stylesheet links |
| `styles.css` | Add `:root` token definitions, update base styles |

#### Success Criteria
- [ ] All three fonts load successfully (verify in DevTools Network tab)
- [ ] CSS custom properties accessible via `var(--q-*)` and `var(--t-*)`
- [ ] Base background is Q.void0 (#060504)
- [ ] Scrollbars styled with Q palette (track: void0, thumb: stone3)
- [ ] No FOUT (Flash of Unstyled Text) - fonts use display=swap
- [ ] `prefers-reduced-motion` media query prepared for effects

---

### WP-2: Surface Primitives - Copper Texture & Riveted Panel CSS
**Scope:** `styles.css` (new surface classes)

#### Deliverables
1. Create `.copper-texture` class with grid overlay gradient pattern
2. Create `.riveted-panel` class with corner dots and depth borders
3. Create variant modifiers (`.copper-texture--dark`, `--medium`, `--raised`)
4. Define glow utility classes for status-based panel glows

#### CSS Implementation

```css
/* Copper Texture Surface */
.copper-texture {
  background:
    repeating-linear-gradient(90deg, transparent 0px, transparent 63px,
      var(--q-stone0-40) 63px, var(--q-stone0-40) 64px),
    repeating-linear-gradient(0deg, transparent 0px, transparent 63px,
      var(--q-stone0-30) 63px, var(--q-stone0-30) 64px),
    linear-gradient(180deg, var(--copper-highlight, transparent), transparent 2px),
    linear-gradient(135deg, var(--copper-bg, var(--q-stone1)) 0%, var(--q-void1) 100%);
  border: var(--t-border-width-standard) solid var(--copper-border, var(--q-stone3));
  border-top-color: var(--q-iron1-44);
}

/* Riveted Panel Surface */
.riveted-panel {
  background:
    radial-gradient(circle at 8px 8px, var(--q-iron0) 2px, transparent 2px),
    radial-gradient(circle at calc(100% - 8px) 8px, var(--q-iron0) 2px, transparent 2px),
    radial-gradient(circle at 8px calc(100% - 8px), var(--q-iron0) 2px, transparent 2px),
    radial-gradient(circle at calc(100% - 8px) calc(100% - 8px), var(--q-iron0) 2px, transparent 2px),
    linear-gradient(180deg, var(--q-stone2) 0%, var(--q-stone1) 100%);
  border: var(--t-border-width-standard) solid var(--q-stone3);
  border-top-color: var(--q-iron1-33);
  border-bottom: 2px solid var(--q-void0);
}
```

#### Success Criteria
- [ ] `.copper-texture` renders 64px grid overlay pattern
- [ ] `.riveted-panel` renders 4 corner rivets (2px dots at 8px offset)
- [ ] All variants apply correct color variations
- [ ] No visual artifacts at any viewport size

---

### WP-3: Effects Layer - Grain Overlay & Scanline Sweep
**Scope:** `styles.css` (animations), `main.js` (grain canvas)

#### Deliverables
1. Implement grain overlay canvas component (React, renders to fixed overlay)
2. Implement scanline sweep CSS animation
3. Add torch flicker keyframe animation
4. Add fullbright pulse keyframe animation
5. Add cursor blink animation for console elements
6. Implement `prefers-reduced-motion` fallbacks

#### Grain Implementation (React Component in main.js)

**Note:** Canvas size increased to 512x512 to prevent visible tiling on large displays.

```javascript
// GrainOverlay - canvas-based film grain effect
function GrainOverlay() {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const ctx = canvas.getContext('2d');
    // Use 512x512 to prevent visible tiling on large displays
    canvas.width = 512;
    canvas.height = 512;

    const imageData = ctx.createImageData(512, 512);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = Math.random() * 25; // T.fx.grain.intensity
      imageData.data[i] = v;
      imageData.data[i + 1] = v * 0.9;
      imageData.data[i + 2] = v * 0.7;
      imageData.data[i + 3] = 35; // T.fx.grain.alpha
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

#### CSS Animations

```css
/* Grain overlay positioning */
.grain-overlay {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.7;
  mix-blend-mode: overlay;
}

/* Scanline sweep */
.scanline-sweep {
  position: fixed;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg,
    transparent 5%,
    var(--q-copper1-06) 30%,
    var(--q-copper1-06) 70%,
    transparent 95%);
  z-index: 9998;
  pointer-events: none;
  animation: scanline-move 5s linear infinite;
}

/* Mobile: Disable grain/scanline for performance */
@media (max-width: 767px) {
  .grain-overlay { display: none; }
  .scanline-sweep { display: none; }
}

@keyframes scanline-move {
  0% { top: 0; }
  100% { top: 100%; }
}

/* Torch flicker for header text */
@keyframes torch-flicker {
  0%, 90%, 100% { opacity: 1; }
  91%, 92% { opacity: 0.85; }
  93% { opacity: 1; }
  96% { opacity: 0.92; }
  97% { opacity: 1; }
}

/* Fullbright pulse for status indicators */
@keyframes fullbright-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* Cursor blink for console */
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Reduced motion fallbacks */
@media (prefers-reduced-motion: reduce) {
  .grain-overlay { display: none; }
  .scanline-sweep { animation: none; display: none; }
  * { animation-duration: 0.01ms !important; }
}
```

#### Success Criteria
- [ ] Grain overlay renders without performance degradation (<1ms/frame)
- [ ] Scanline sweeps smoothly from top to bottom
- [ ] Torch flicker applies to header "CLAUDE COMMS III" text
- [ ] All animations respect `prefers-reduced-motion`
- [ ] Effects don't block user interaction (pointer-events: none)
- [ ] No accessibility issues (WCAG contrast ratios maintained)

---

### WP-4: Shared Components - StatusBadge, Buttons, Inputs
**Scope:** `components/shared/*.js`, `styles.css`

**Full Shared Components Coverage:**
- `StatusBadge.js` — Primary target, transform to StatusRune
- `LoadingSkeleton.js` — Update skeleton colors to Q palette
- `EmptyState.js` — Update text colors and icons to Q palette
- `ErrorBoundary.js` — Update error display to lava/danger palette
- `Timestamp.js` — Update text color to bone palette
- `JsonViewer.js` — Update syntax highlighting to Q palette

#### Deliverables
1. Transform StatusBadge to StatusRune pattern (fullbright dot + label)
2. Create `.q-btn` button styles with variants (primary, runic, lava, slime, teleport, ghost)
3. Transform input styles to RuneInput pattern (copper focus glow)
4. Update tooltip styles with Q palette
5. Update badge styles with Q palette
6. Update all shared components to use Q palette colors

#### StatusRune Transformation

Current StatusBadge uses Tailwind-style colored pills. Transform to brandkit StatusRune:
- Fullbright dot with glow
- Uppercase label with display font
- Status-specific colors from semantic tokens

```css
.status-rune {
  font-family: var(--font-display);
  font-size: var(--t-type-size-badge);
  letter-spacing: var(--t-type-tracking-normal);
  display: inline-flex;
  align-items: center;
  gap: calc(var(--t-space-xs) + 1px);
  padding: calc(var(--t-space-xs) - 1px) var(--t-space-sm);
  text-transform: uppercase;
}

.status-rune--active {
  color: var(--q-slime1);
  background: var(--q-slime1)12;
  border: 1px solid var(--q-slime1)33;
}
/* ... variants for idle, error, offline, warp ... */

.fullbright-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  box-shadow:
    0 0 7px currentColor,
    0 0 14px currentColor;
  /* Note: For alpha variants, use rgba with --color-rgb vars or opacity on parent */
}

.fullbright-dot--pulse {
  animation: fullbright-pulse 2.5s ease-in-out infinite;
}
```

#### QButton Styles

```css
.q-btn {
  font-family: var(--font-display);
  font-size: var(--t-button-fs-md);
  letter-spacing: var(--t-type-tracking-normal);
  text-transform: uppercase;
  padding: var(--t-button-py-md) var(--t-button-px-md);
  border-radius: 0;
  cursor: pointer;
  transition: all 0.1s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.q-btn--primary {
  background: linear-gradient(180deg, var(--q-copper1), var(--q-copper0));
  border: 1px solid var(--q-copper2);
  border-top-color: var(--q-copper2-88);  /* pre-computed alpha variant */
  border-bottom: 2px solid var(--q-void0);
  color: var(--q-void0);
  text-shadow: 0 1px 0 var(--q-copper3-44);  /* pre-computed alpha variant */
}

.q-btn--primary:hover {
  background: linear-gradient(180deg, var(--q-copper2), var(--q-copper1));
  box-shadow: 0 0 12px var(--q-torch-33);  /* pre-computed alpha variant */
}

.q-btn--primary:active {
  transform: translateY(1px);
}

.q-btn:disabled {
  background: var(--q-stone2);
  border-color: var(--q-stone3);
  color: var(--q-bone0);
  cursor: not-allowed;
  opacity: 0.4;
}
/* ... variants: runic, lava, slime, teleport, ghost ... */
```

#### Success Criteria
- [ ] StatusRune displays fullbright dot with appropriate glow
- [ ] Button hover states show copper glow
- [ ] Button press shows 1px translateY depression
- [ ] Input focus shows copper glow with inset shadow
- [ ] All variants render with correct Q palette colors
- [ ] Disabled states show appropriate opacity

---

### WP-5: Namespace Components - Sidebar Transformation
**Scope:** `components/namespace/*.js`, `styles.css`

#### Deliverables
1. Transform NamespaceList header to brandkit styling
2. Apply copper texture to sidebar background
3. Transform NamespaceCard to riveted panel style
4. Transform search input to RuneInput pattern
5. Transform collapse toggle to Q palette
6. Update connection status indicator to fullbright pattern

#### Component Mapping

| Current | Brandkit Treatment |
|---------|-------------------|
| `.sidebar` bg-gray-900 | `.copper-texture--dark` |
| `.sidebar-branding` | Torch-colored title with flicker, display font |
| `NamespaceCard` | `.riveted-panel` with status glow |
| Search input | RuneInput with copper focus |
| Connection status dot | Fullbright dot with pulse |
| Collapse toggle chevron | Copper-colored, hover glow |

#### Success Criteria
- [ ] Sidebar has subtle copper texture grid overlay
- [ ] "Workflow Engine" header uses Silkscreen font with torch color
- [ ] Namespace cards show riveted corners
- [ ] Active namespace has status-appropriate glow
- [ ] Search input has copper focus state
- [ ] Collapse toggle transitions smoothly
- [ ] All existing responsive behaviors preserved

---

### WP-6: Chat Components - Messages, Threads, Input
**Scope:** `components/chat/*.js`, `styles.css`

#### Deliverables
1. Transform ThreadItem to copper/riveted styling
2. Transform MessageBubble with Q palette colors
3. Transform ChatInput to console-style with RuneInput
4. Transform ModeToggle to runic tab pattern
5. Transform ChatHeader with brandkit typography
6. Update PM message styling with amber/torch accents

#### Component Mapping

| Current | Brandkit Treatment |
|---------|-------------------|
| Thread items hover | Copper texture hover state |
| Thread selected | Blue border → Torch accent border |
| User message bubble | Blue bg → Copper gradient |
| Assistant message bubble | Gray bg → Stone gradient with bone text |
| PM message | Amber accent → Torch/copper accent |
| Mode toggle buttons | Rounded pills → Runic tabs (square) |
| Chat input | Gray input → Console-style with copper border |

#### ModeToggle Transformation

```css
.mode-toggle {
  display: inline-flex;
  background: var(--q-void0);
  border-bottom: 2px solid var(--q-stone3);
  gap: 1px;
}

.mode-toggle__btn {
  font-family: var(--font-display);
  font-size: var(--t-type-size-label);
  letter-spacing: var(--t-type-tracking-normal);
  text-transform: uppercase;
  padding: 9px 18px;
  border: none;
  background: var(--q-void1);
  color: var(--q-bone0);
  cursor: pointer;
  transition: all 0.1s;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}

.mode-toggle__btn--active {
  background: linear-gradient(180deg, var(--q-stone2), var(--q-stone1));
  color: var(--q-torch);
  border-bottom-color: var(--q-torch);
  border-top: 1px solid var(--q-stone3);
}
```

#### Success Criteria
- [ ] Thread items show copper hover state
- [ ] Selected thread has torch-colored left border
- [ ] User messages use copper gradient background
- [ ] Assistant messages use stone background with bone text
- [ ] PM messages maintain amber accent (torch palette)
- [ ] Mode toggle looks like dimension tabs from brandkit
- [ ] Chat input has console styling with blinking cursor
- [ ] All thread collapse/expand behaviors work

---

### WP-7: Job Components - AgentHUD-Style Transformation
**Scope:** `components/job/*.js`, `styles.css`

#### Deliverables
1. Transform JobNode to AgentHUD card pattern (riveted panel, stats layout)
2. Transform status glow effects to Q palette
3. Transform JobCard to riveted panel with health-bar metrics
4. Transform JobDetail modal to copper texture background
5. Create health-bar style progress indicators for token/tool counts
6. Transform chain connectors to copper/iron colors

#### AgentHUD Job Node Design

```
┌─────────────────────────────────────┐
│ ◉◉                            ◉◉ │  ← Rivets
│   ┌─────────────────────────┐     │
│   │ ═══════════════════════ │     │  ← Status glow bar
│   │ [Logo]  PLAN      ALIVE │     │  ← Provider logo + type + rune
│   │                         │     │
│   │ HP ████████░░  92       │     │  ← Health-style metric
│   │ TK ██████░░░░  1.2k     │     │  ← Token meter
│   │ TC █████░░░░░  47       │     │  ← Tool call meter
│   │                         │     │
│   │ ⚡ ⚡ ⚡                  │     │  ← Subagent indicators
│   └─────────────────────────┘     │
│ ◉◉                            ◉◉ │
└─────────────────────────────────────┘
```

#### CSS Implementation

```css
.job-node-hud {
  /* Riveted panel base */
  background:
    radial-gradient(circle at 8px 8px, var(--q-iron0) 2px, transparent 2px),
    radial-gradient(circle at calc(100% - 8px) 8px, var(--q-iron0) 2px, transparent 2px),
    radial-gradient(circle at 8px calc(100% - 8px), var(--q-iron0) 2px, transparent 2px),
    radial-gradient(circle at calc(100% - 8px) calc(100% - 8px), var(--q-iron0) 2px, transparent 2px),
    linear-gradient(180deg, var(--q-stone2), var(--q-stone1));
  border: 1px solid var(--q-stone3);
  border-top-color: var(--q-iron1-33);  /* pre-computed alpha */
  border-bottom: 2px solid var(--q-void0);
  padding: 0;
  overflow: hidden;
  transition: all 0.2s;
}

/* Status glow bar at top - uses dedicated glow-bar alpha vars */
.job-node-hud__glow-bar {
  height: 3px;
  background: linear-gradient(90deg,
    transparent,
    var(--job-glow-color-44, var(--q-copper1-44)),
    transparent);
}

/* Running state */
.job-node-hud--running {
  --job-glow-color: var(--q-slime1);
  --job-glow-color-44: var(--q-slime1-44);
  box-shadow:
    inset 0 0 30px var(--q-slime0-08),
    0 0 20px var(--q-slime0-10);
}

/* Complete state */
.job-node-hud--complete {
  --job-glow-color: var(--q-slime1);
  --job-glow-color-44: var(--q-slime1-44);
}

/* Failed state */
.job-node-hud--failed {
  --job-glow-color: var(--q-lava1);
  --job-glow-color-44: var(--q-lava1-44);
  box-shadow:
    inset 0 0 30px var(--q-lava0-08),
    0 0 20px var(--q-lava0-10);
}

/* Health bar meter */
.hud-meter {
  height: 6px;
  background: var(--q-void1);
  border: 1px solid var(--q-stone3);
  position: relative;
  overflow: hidden;
}

.hud-meter__fill {
  height: 100%;
  transition: width 0.5s ease;
  box-shadow: 0 0 6px currentColor;
}

.hud-meter--health .hud-meter__fill {
  background: linear-gradient(90deg, var(--q-slime1-88), var(--q-slime1));
}

.hud-meter--tokens .hud-meter__fill {
  background: linear-gradient(90deg, var(--q-copper1-88), var(--q-copper3));
}
```

#### Success Criteria
- [ ] Job nodes render as AgentHUD-style riveted cards
- [ ] Running jobs show animated pulse glow (slime green)
- [ ] Complete jobs show static success glow (slime)
- [ ] Failed jobs show danger glow (lava red)
- [ ] Pending jobs appear muted/dimmed
- [ ] Provider logos remain visible with glow behind
- [ ] Token/tool counts display as health-bar meters
- [ ] Subagent indicators show as mini provider logos
- [ ] Chain connectors use iron/stone colors
- [ ] JobDetail modal has copper texture background
- [ ] All existing click/expand behaviors work

---

### WP-8: Integration & Polish
**Scope:** All files, integration testing

#### Deliverables
1. Remove all remaining Tailwind gray-* color references
2. Verify all component interactions work correctly
3. Test all responsive breakpoints (mobile, tablet, laptop, desktop)
4. Test all drawer/collapse behaviors
5. Performance audit (effects overhead <5% CPU)
6. Accessibility audit (contrast, motion, screen readers)
7. Cross-browser testing (Chrome, Firefox, Safari, Edge)

#### Responsive Verification Checklist

| Breakpoint | Width | Key Behaviors |
|------------|-------|---------------|
| Mobile | <768px | Drawers work, mobile header visible, stacked layout |
| Tablet | 768-1024px | Sidebar auto-collapsed, compact widths |
| Laptop | 1024-1440px | Default comfortable layout |
| Desktop | >1440px | Full spacious layout |

#### Success Criteria
- [ ] No remaining `bg-gray-*`, `text-gray-*`, `border-gray-*` in components
- [ ] All clamp() responsive widths still function
- [ ] Mobile drawer open/close works smoothly
- [ ] Tablet auto-collapse works
- [ ] Keyboard navigation works (focus visible)
- [ ] Effects don't cause jank (60fps maintained)
- [ ] Lighthouse accessibility score ≥90
- [ ] No console errors

---

## File-Level Change Summary

| File | WP | Changes |
|------|-----|---------|
| `index.html` | WP-1 | Google Fonts links |
| `styles.css` | WP-1,2,3,4,5,6,7 | Tokens, surfaces, effects, components |
| `main.js` | WP-3 | GrainOverlay, ScanlineSweep components |
| `components/shared/StatusBadge.js` | WP-4 | StatusRune pattern |
| `components/shared/*.js` | WP-4 | Q palette colors |
| `components/namespace/*.js` | WP-5 | Sidebar styling |
| `components/chat/*.js` | WP-6 | Thread, message, input styling |
| `components/job/*.js` | WP-7 | AgentHUD cards, meters |

---

## Assignment-Level Success Criteria

1. **Visual Transformation Complete**
   - Every UI surface reflects Quake-inspired aesthetic
   - Q palette colors used throughout (no gray-* remnants)
   - T tokens applied for consistent spacing/typography
   - Three-font stack consistently applied

2. **Effects Suite Active**
   - Grain overlay creates ambient immersion
   - Scanline sweep animates smoothly
   - Torch flicker on header text
   - Fullbright status glows with pulse

3. **Component Patterns Applied**
   - Job nodes are AgentHUD-style riveted cards
   - Status indicators use StatusRune pattern
   - Buttons use QButton variants
   - Surfaces use copper texture / riveted panel

4. **Zero Functionality Regression**
   - All responsive breakpoints work identically
   - All drawer/collapse behaviors preserved
   - All click handlers functional
   - All data display correct

5. **Accessibility Maintained**
   - WCAG AA contrast ratios (4.5:1 minimum)
   - `prefers-reduced-motion` respected
   - Keyboard navigation functional
   - Screen reader compatible

---

## Open Questions / Decisions Needed — RESOLVED

1. **Provider Logo Treatment**: Should provider logos get a subtle Q palette tint/filter, or remain as original brand colors?
   - **DECISION**: Keep original brand colors for recognizability. Add Q-palette status glow around logos based on job state.

2. **Grain Intensity**: The brandkit uses 0.7 opacity grain. Should this be adjustable or fixed?
   - **DECISION**: Fixed at brandkit value (0.7 opacity). Disabled via `prefers-reduced-motion` media query.

3. **Mobile Effects**: Should grain/scanline effects be disabled on mobile for performance?
   - **DECISION**: Yes, disable via CSS media query `@media (max-width: 767px)`. Viewport-based detection is more reliable than `navigator.hardwareConcurrency`.

---

## Recommended Job Sequence

1. **WP-1: Foundation** (First - unlocks all others)
2. **WP-2: Surface Primitives** (Depends on WP-1)
3. **WP-3: Effects Layer** (Can parallel with WP-4)
4. **WP-4: Shared Components** (Depends on WP-2)
5. **WP-5, WP-6, WP-7: Domain Components** (Parallel after WP-4)
6. **WP-8: Integration & Polish** (Last - verification)

**Estimated Parallelization:** WP-5/6/7 can run concurrently after WP-4, reducing total sequential time.

---

## Artifacts

- **Spec Document**: `docs/project/phases/08-BrandkitTransformation/spec.md`
- **Brandkit Reference**: `docs/project/guides/styleguide/brandkit.jsx`

---

*Phase 08 - Claude Comms III Brandkit Transformation*
