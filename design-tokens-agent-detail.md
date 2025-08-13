# Design Tokens and Component Patterns for Agent Detail Feature

## Design System Integration

This document outlines the design tokens, patterns, and style guidelines for implementing the Agent Detail Panel feature consistently with the existing timeline visualization system.

## Color System

### Primary Color Palette (from timeline.css)
```css
:root {
  /* Timeline Foundation Colors */
  --timeline-bg-start: #0f0f23;
  --timeline-bg-end: #1a1a3e;
  --timeline-orchestrator-color: #00d4ff;
  --timeline-grid-color: rgba(255, 255, 255, 0.05);
  
  /* Agent Detail Panel Extensions */
  --agent-detail-bg: #1f2937;           /* bg-gray-800 */
  --agent-detail-border: #4b5563;       /* border-gray-600 */
  --agent-detail-header-start: #374151; /* from-gray-700 */
  --agent-detail-header-end: #4b5563;   /* to-gray-600 */
  
  /* Content Area Colors */
  --agent-detail-content-bg: #111827;   /* bg-gray-900 for code/content */
  --agent-detail-card-bg: #374151;      /* bg-gray-700 for metric cards */
  --agent-detail-card-hover: #4b5563;   /* hover:bg-gray-600 */
  
  /* Text Hierarchy */
  --text-primary: #ffffff;      /* Primary headings, values */
  --text-secondary: #d1d5db;    /* Secondary text, labels */
  --text-muted: #9ca3af;        /* Tertiary text, metadata */
  --text-accent: #60a5fa;       /* Links, interactive elements */
}
```

### Agent Type Color Mapping (Extended from timeline.css)
```css
:root {
  /* Existing Agent Colors */
  --agent-engineer: #22c55e;
  --agent-tester: #eab308;
  --agent-code-reviewer: #a855f7;
  --agent-architect: #ec4899;
  --agent-deep-researcher: #6366f1;
  --agent-designer: #f97316;
  --agent-business-analyst: #14b8a6;
  --agent-planner: #ef4444;
  --agent-cloud-cicd: #06b6d4;
  --agent-green-verifier: #10b981;
  --agent-general-purpose: #3b82f6;
  
  /* Agent Detail Panel Status Colors */
  --status-pending: #eab308;     /* yellow-500 */
  --status-in-progress: #3b82f6; /* blue-500 */
  --status-completed: #22c55e;   /* green-500 */
  --status-error: #ef4444;       /* red-500 */
}
```

### Performance Metric Colors
```css
:root {
  /* Metric Visualization Colors */
  --metric-excellent: #22c55e;   /* green-500 - top quartile performance */
  --metric-good: #3b82f6;        /* blue-500 - above average */
  --metric-average: #eab308;     /* yellow-500 - baseline */
  --metric-poor: #f97316;        /* orange-500 - below average */
  --metric-critical: #ef4444;    /* red-500 - bottom quartile */
  
  /* Efficiency Bar Gradients */
  --efficiency-high: linear-gradient(90deg, #10b981, #22c55e);
  --efficiency-medium: linear-gradient(90deg, #3b82f6, #60a5fa);
  --efficiency-low: linear-gradient(90deg, #f97316, #fb923c);
}
```

## Typography System

### Font Stacks
```css
:root {
  /* Font Families */
  --font-primary: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
  
  /* Font Sizes (using Tailwind scale) */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  
  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
  
  /* Line Heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
}
```

### Typography Classes for Agent Detail
```css
/* Section Titles */
.agent-section-title {
  font-family: var(--font-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  line-height: var(--leading-tight);
  margin-bottom: 0.75rem;
}

/* Metric Values */
.agent-metric-value {
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  line-height: var(--leading-tight);
}

/* Metric Labels */
.agent-metric-label {
  font-family: var(--font-primary);
  font-size: var(--text-xs);
  font-weight: var(--font-normal);
  color: var(--text-muted);
  line-height: var(--leading-normal);
  margin-bottom: 0.25rem;
}

/* Secondary Information */
.agent-secondary-text {
  font-family: var(--font-primary);
  font-size: var(--text-xs);
  font-weight: var(--font-normal);
  color: var(--text-muted);
  line-height: var(--leading-normal);
}
```

## Spacing and Layout System

### Spacing Scale (Tailwind-based)
```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
}
```

### Layout Patterns
```css
/* Agent Detail Panel Layout */
.agent-detail-layout {
  width: 24rem;                    /* 384px - consistent with MessageDetailPane */
  height: 100vh;
  padding: 0;
  display: flex;
  flex-direction: column;
}

/* Header Layout */
.agent-detail-header {
  padding: var(--space-3) var(--space-4); /* 12px 16px */
  flex-shrink: 0;
  border-bottom: 1px solid var(--agent-detail-border);
}

/* Content Layout */
.agent-detail-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);         /* 16px */
}

/* Section Spacing */
.agent-detail-section {
  margin-bottom: var(--space-6);   /* 24px */
}

.agent-detail-section:last-child {
  margin-bottom: 0;
}

/* Metric Grid */
.agent-metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);             /* 16px */
}

/* Card Spacing */
.agent-metric-card {
  padding: var(--space-3);         /* 12px */
  border-radius: 0.5rem;           /* 8px */
}
```

## Animation System

### Timing Functions (from timeline.css)
```css
:root {
  --timeline-transition-duration: 0.3s;
  --timeline-ease-function: cubic-bezier(0.4, 0.0, 0.2, 1);
  
  /* Agent Detail Specific Animations */
  --agent-detail-slide-duration: 300ms;
  --agent-detail-slide-easing: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --agent-detail-fade-duration: 200ms;
  --agent-detail-fade-easing: ease-out;
}
```

### Animation Classes
```css
/* Slide-in Animation */
.agent-detail-slide-in {
  transform: translateX(0%);
  transition: transform var(--agent-detail-slide-duration) var(--agent-detail-slide-easing);
}

.agent-detail-slide-out {
  transform: translateX(100%);
  transition: transform var(--agent-detail-slide-duration) var(--agent-detail-slide-easing);
}

/* Fade Animations for Content */
.agent-detail-fade-in {
  opacity: 1;
  transition: opacity var(--agent-detail-fade-duration) var(--agent-detail-fade-easing);
}

.agent-detail-fade-out {
  opacity: 0;
  transition: opacity var(--agent-detail-fade-duration) var(--agent-detail-fade-easing);
}

/* Metric Value Changes */
.agent-metric-value-change {
  transition: color 300ms ease-out, transform 200ms ease-out;
}

.agent-metric-value-change.updated {
  color: var(--status-in-progress);
  transform: scale(1.05);
}

/* Efficiency Bar Animation */
.agent-efficiency-bar {
  transition: width 500ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

## Component Patterns

### Status Indicator Pattern
```css
.agent-status-indicator {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-2);  /* 4px 8px */
  border-radius: 9999px;                   /* fully rounded */
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  line-height: 1;
}

.agent-status-indicator.pending {
  background-color: var(--status-pending);
  color: #000;
}

.agent-status-indicator.in-progress {
  background-color: var(--status-in-progress);
  color: #fff;
}

.agent-status-indicator.completed {
  background-color: var(--status-completed);
  color: #fff;
}

.agent-status-indicator.error {
  background-color: var(--status-error);
  color: #fff;
}
```

### Metric Card Pattern
```css
.agent-metric-card {
  background-color: var(--agent-detail-card-bg);
  border-radius: 0.5rem;
  padding: var(--space-3);
  transition: background-color var(--timeline-transition-duration) var(--timeline-ease-function);
}

.agent-metric-card:hover {
  background-color: var(--agent-detail-card-hover);
}

.agent-metric-card .metric-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.agent-metric-card .metric-body {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.agent-metric-card .metric-footer {
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
```

### Action Button Pattern
```css
.agent-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: 0.5rem;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--timeline-transition-duration) var(--timeline-ease-function);
  cursor: pointer;
  border: none;
}

.agent-action-btn.primary {
  background-color: #3b82f6;
  color: #ffffff;
}

.agent-action-btn.primary:hover {
  background-color: #2563eb;
}

.agent-action-btn.secondary {
  background-color: var(--agent-detail-card-bg);
  color: var(--text-primary);
}

.agent-action-btn.secondary:hover {
  background-color: var(--agent-detail-card-hover);
}
```

## Responsive Design Tokens

### Breakpoints
```css
:root {
  --breakpoint-mobile: 768px;
  --breakpoint-tablet: 1024px;
  --breakpoint-desktop: 1280px;
}
```

### Responsive Patterns
```css
/* Mobile Adjustments */
@media (max-width: 768px) {
  .agent-detail-layout {
    width: 100vw;
  }
  
  .agent-metrics-grid {
    grid-template-columns: 1fr;
  }
  
  .agent-detail-content {
    padding: var(--space-3);
  }
  
  .agent-action-grid {
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }
}
```

## Accessibility Design Tokens

### Focus States
```css
:root {
  --focus-ring-color: #3b82f6;
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;
}

.agent-focusable:focus {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}

.agent-focusable:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
```

### High Contrast Mode Support
```css
@media (prefers-contrast: high) {
  :root {
    --agent-detail-bg: #000000;
    --agent-detail-border: #ffffff;
    --text-primary: #ffffff;
    --text-secondary: #ffffff;
    --text-muted: #cccccc;
  }
}
```

### Reduced Motion Support
```css
@media (prefers-reduced-motion: reduce) {
  .agent-detail-slide-in,
  .agent-detail-slide-out,
  .agent-detail-fade-in,
  .agent-detail-fade-out,
  .agent-metric-value-change,
  .agent-efficiency-bar {
    transition: none;
    animation: none;
  }
}
```

## Usage Guidelines

### Do's
1. **Use consistent spacing** from the spacing scale
2. **Apply agent type colors** consistently with timeline component
3. **Follow typography hierarchy** for content organization
4. **Implement smooth animations** using defined timing functions
5. **Maintain color contrast ratios** above WCAG AA standards

### Don'ts
1. **Don't introduce new color values** without updating the token system
2. **Don't hardcode spacing values** - use the spacing scale
3. **Don't override font stacks** - use the defined system fonts
4. **Don't ignore responsive patterns** - test on mobile devices
5. **Don't skip accessibility tokens** - implement focus states and high contrast support

## Component Integration Checklist

When implementing the AgentDetailPane component:

- [ ] Import and use defined color tokens
- [ ] Apply typography classes consistently
- [ ] Implement spacing using the scale system
- [ ] Use animation classes for transitions
- [ ] Follow responsive design patterns
- [ ] Include accessibility features
- [ ] Test with high contrast mode
- [ ] Verify reduced motion compliance
- [ ] Maintain consistency with MessageDetailPane patterns

This token system ensures visual consistency, maintainability, and accessibility across the agent detail feature implementation.