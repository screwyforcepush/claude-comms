# Agent Timeline Visualization - Design Specifications

## Overview
A comprehensive design specification for the interactive agent timeline visualization component that displays multi-agent spawning, messaging, and batch execution patterns with real-time updates.

## 1. Color System & Agent Type Differentiation

### Primary Agent Type Palette
Based on the existing useEventColors system but extended for agent lifecycle visualization:

```css
:root {
  /* Agent Type Colors - High contrast for dark theme */
  --agent-orchestrator: #00d4ff;     /* Cyan - Primary orchestrator */
  --agent-coder: #ff6b6b;           /* Red coral - Coders */
  --agent-architect: #4ecdc4;       /* Teal - Architects */
  --agent-reviewer: #95e77e;        /* Green - Code reviewers */
  --agent-tester: #ffd93d;          /* Yellow - Testers */
  --agent-verifier: #a78bfa;        /* Purple - Green verifiers */
  --agent-planner: #f97316;         /* Orange - Planners */
  --agent-analyst: #ec4899;         /* Pink - Business analysts */
  --agent-researcher: #06b6d4;      /* Cyan - Deep researchers */
  --agent-designer: #8b5cf6;        /* Violet - Designers */
  --agent-deployer: #22c55e;        /* Green - Cloud/CICD */
  
  /* Secondary encodings for accessibility */
  --agent-stroke-width-default: 2px;
  --agent-stroke-width-hover: 3px;
  --agent-stroke-width-selected: 4px;
  
  /* Glow effects */
  --agent-glow-opacity: 0.6;
  --agent-glow-blur: 8px;
}
```

### Agent Status Color Modifiers
```css
:root {
  /* Status overlays - applied as opacity modifiers */
  --status-pending: rgba(128, 128, 128, 0.7);     /* Gray overlay */
  --status-in-progress: rgba(59, 130, 246, 0.8);  /* Blue overlay */
  --status-completed: rgba(34, 197, 94, 0.9);     /* Green overlay */
  --status-error: rgba(239, 68, 68, 0.9);         /* Red overlay */
  
  /* Status indicators */
  --indicator-pending: #6b7280;
  --indicator-active: #3b82f6;
  --indicator-completed: #22c55e;
  --indicator-error: #ef4444;
}
```

### Color Accessibility Features
- Minimum 4.5:1 contrast ratio on dark backgrounds
- Secondary shape encoding for colorblind users
- Option to toggle high-contrast mode
- Descriptive ARIA labels for all colored elements

## 2. Animation Specifications

### Real-time Update Animations
```css
/* Agent spawning animation */
@keyframes agent-spawn {
  0% {
    opacity: 0;
    stroke-width: 0;
    filter: drop-shadow(0 0 0px currentColor);
  }
  50% {
    opacity: 0.7;
    stroke-width: 4px;
    filter: drop-shadow(0 0 12px currentColor);
  }
  100% {
    opacity: 1;
    stroke-width: var(--agent-stroke-width-default);
    filter: drop-shadow(0 0 var(--agent-glow-blur) currentColor);
  }
}

/* Message pulse animation */
@keyframes message-pulse {
  0%, 100% {
    r: 3;
    opacity: 0.8;
    filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.8));
  }
  50% {
    r: 5;
    opacity: 1;
    filter: drop-shadow(0 0 8px rgba(255, 255, 255, 1));
  }
}

/* Batch grouping highlight */
@keyframes batch-highlight {
  0% {
    stroke-opacity: 0.3;
    stroke-width: 1;
  }
  100% {
    stroke-opacity: 0.8;
    stroke-width: 2;
  }
}

/* Agent completion celebration */
@keyframes agent-complete {
  0% { transform: scale(1); }
  25% { transform: scale(1.1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

/* Performance optimizations */
.timeline-animation {
  /* Promote to GPU layer */
  will-change: transform, opacity;
  /* Limit animation duration */
  animation-duration: 300ms;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  animation-fill-mode: forwards;
}
```

### Animation Control System
```css
/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .timeline-animation {
    animation-duration: 0ms !important;
    transition-duration: 0ms !important;
  }
  
  .message-pulse {
    animation: none;
  }
}

/* Manual animation toggle */
.timeline-container.animations-disabled * {
  animation: none !important;
  transition: none !important;
}
```

## 3. Hover & Click Interaction States

### Hover Interactions
```css
.agent-line {
  cursor: pointer;
  transition: all 150ms ease;
}

.agent-line:hover {
  stroke-width: var(--agent-stroke-width-hover);
  filter: drop-shadow(0 0 12px currentColor);
  opacity: 1;
}

.agent-line:hover + .agent-label {
  font-weight: 600;
  text-shadow: 0 0 4px currentColor;
}

/* Hover tooltip styles */
.agent-tooltip {
  position: absolute;
  background: rgba(17, 24, 39, 0.95);
  border: 1px solid rgba(59, 130, 246, 0.5);
  border-radius: 8px;
  padding: 12px;
  color: white;
  font-size: 14px;
  pointer-events: none;
  z-index: 1000;
  backdrop-filter: blur(8px);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  max-width: 300px;
}

.agent-tooltip::before {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 6px 6px 0 6px;
  border-color: rgba(59, 130, 246, 0.5) transparent transparent transparent;
}
```

### Click Selection States
```css
.agent-line.selected {
  stroke-width: var(--agent-stroke-width-selected);
  filter: drop-shadow(0 0 16px currentColor);
  outline: 2px solid rgba(255, 255, 255, 0.3);
  outline-offset: 2px;
}

.agent-line.multi-selected {
  stroke-dasharray: 8 4;
  animation: selection-pulse 2s infinite;
}

@keyframes selection-pulse {
  0%, 100% { stroke-dashoffset: 0; }
  50% { stroke-dashoffset: 12; }
}
```

### Keyboard Navigation
```css
.agent-line:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.agent-line:focus-visible {
  outline-color: #60a5fa;
}
```

## 4. Message Detail Pane Layout

### Side Panel Structure
```css
.message-detail-pane {
  position: fixed;
  top: 0;
  right: -400px;
  width: 400px;
  height: 100vh;
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  border-left: 2px solid rgba(59, 130, 246, 0.3);
  box-shadow: -10px 0 40px rgba(0, 0, 0, 0.5);
  transition: right 300ms cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  overflow-y: auto;
}

.message-detail-pane.open {
  right: 0;
}

.message-detail-pane.mobile {
  width: 100vw;
  right: -100vw;
}

.message-detail-pane.mobile.open {
  right: 0;
}
```

### Panel Content Layout
```css
.message-detail-header {
  padding: 20px;
  border-bottom: 1px solid rgba(59, 130, 246, 0.2);
  position: sticky;
  top: 0;
  background: rgba(31, 41, 55, 0.95);
  backdrop-filter: blur(8px);
}

.message-detail-content {
  padding: 20px;
  space-y: 16px;
}

.message-item {
  background: rgba(17, 24, 39, 0.6);
  border-radius: 8px;
  padding: 16px;
  border-left: 4px solid var(--agent-color);
  margin-bottom: 12px;
}

.message-timestamp {
  color: #9ca3af;
  font-size: 12px;
  font-family: monospace;
}

.message-content {
  color: #e5e7eb;
  white-space: pre-wrap;
  word-break: break-word;
}
```

## 5. Timeline Scaling & Scrolling Behavior

### Viewport Controls
```css
.timeline-controls {
  position: sticky;
  top: 0;
  background: rgba(17, 24, 39, 0.95);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(59, 130, 246, 0.2);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 100;
}

.timeline-scale-toggle {
  display: flex;
  background: rgba(55, 65, 81, 0.5);
  border-radius: 6px;
  overflow: hidden;
}

.scale-mode-button {
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  transition: all 150ms;
}

.scale-mode-button.active {
  background: #3b82f6;
  color: white;
}

.timeline-zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-button {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(59, 130, 246, 0.3);
  background: rgba(55, 65, 81, 0.5);
  color: #e5e7eb;
  border-radius: 4px;
  cursor: pointer;
  transition: all 150ms;
}

.zoom-button:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.5);
}
```

### Scrolling Behavior
```css
.timeline-viewport {
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.5) transparent;
}

.timeline-viewport::-webkit-scrollbar {
  height: 8px;
}

.timeline-viewport::-webkit-scrollbar-track {
  background: rgba(17, 24, 39, 0.5);
}

.timeline-viewport::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.5);
  border-radius: 4px;
}

.timeline-viewport::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.7);
}

/* Auto-scroll for live updates */
.timeline-viewport.auto-scroll {
  scroll-snap-type: x mandatory;
}

.timeline-viewport.auto-scroll .timeline-content {
  scroll-snap-align: end;
}
```

## 6. Responsive Design Specifications

### Breakpoint System
```css
/* Matching existing Tailwind config */
:root {
  --mobile-breakpoint: 699px;
  --tablet-breakpoint: 1024px;
  --desktop-breakpoint: 1280px;
}

/* Mobile optimizations (< 700px) */
@media (max-width: 699px) {
  .timeline-container {
    padding: 8px;
  }
  
  .agent-line {
    stroke-width: 3px; /* Thicker for touch targets */
  }
  
  .message-dot {
    r: 4; /* Larger touch targets */
  }
  
  .agent-label {
    font-size: 12px;
    /* Convert to icons on mobile */
  }
  
  .timeline-controls {
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .message-detail-pane {
    width: 100vw;
    height: 60vh;
    top: 40vh;
    border-radius: 16px 16px 0 0;
  }
}

/* Tablet optimizations */
@media (min-width: 700px) and (max-width: 1023px) {
  .timeline-container {
    padding: 16px;
  }
  
  .agent-label {
    font-size: 13px;
  }
}

/* Desktop optimizations */
@media (min-width: 1024px) {
  .timeline-container {
    padding: 24px;
  }
  
  .agent-label {
    font-size: 14px;
  }
  
  .timeline-controls {
    padding: 20px 24px;
  }
}
```

### Adaptive Density
```css
.timeline-dense .agent-line {
  stroke-width: 1px;
}

.timeline-dense .agent-label {
  font-size: 11px;
}

.timeline-dense .message-dot {
  r: 2;
}

.timeline-normal .agent-line {
  stroke-width: 2px;
}

.timeline-comfortable .agent-line {
  stroke-width: 3px;
}
```

## 7. Visual Status Indicators

### Agent Status Visualization
```css
.agent-status-indicator {
  position: relative;
}

.agent-status-indicator::before {
  content: '';
  position: absolute;
  top: -4px;
  right: -4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid rgba(17, 24, 39, 1);
}

.agent-status-pending::before {
  background: var(--indicator-pending);
}

.agent-status-active::before {
  background: var(--indicator-active);
  animation: status-pulse 2s infinite;
}

.agent-status-completed::before {
  background: var(--indicator-completed);
}

.agent-status-error::before {
  background: var(--indicator-error);
  animation: error-blink 1s infinite;
}

@keyframes status-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes error-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
```

### Progress Indicators
```css
.agent-progress-bar {
  position: absolute;
  bottom: -2px;
  left: 0;
  height: 2px;
  background: rgba(59, 130, 246, 0.3);
  overflow: hidden;
}

.agent-progress-bar::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, #3b82f6, transparent);
  animation: progress-sweep 2s infinite;
}

@keyframes progress-sweep {
  0% { left: -100%; }
  100% { left: 100%; }
}
```

## 8. Batch Grouping Visual Representation

### Batch Container Styling
```css
.batch-group {
  position: relative;
  padding: 8px;
  border: 1px dashed rgba(0, 212, 255, 0.3);
  border-radius: 8px;
  background: rgba(0, 212, 255, 0.05);
  margin: 4px 0;
}

.batch-group.active {
  border-color: rgba(0, 212, 255, 0.6);
  background: rgba(0, 212, 255, 0.1);
  animation: batch-highlight 300ms ease;
}

.batch-label {
  position: absolute;
  top: -8px;
  left: 12px;
  background: #1f2937;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #00d4ff;
  border: 1px solid rgba(0, 212, 255, 0.3);
}

.batch-stats {
  position: absolute;
  top: -8px;
  right: 12px;
  background: rgba(0, 212, 255, 0.1);
  color: #00d4ff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-family: monospace;
}
```

### Batch Connection Lines
```css
.batch-connector {
  stroke: rgba(0, 212, 255, 0.4);
  stroke-width: 1;
  stroke-dasharray: 4, 4;
  fill: none;
}

.batch-connector.active {
  stroke: rgba(0, 212, 255, 0.8);
  stroke-width: 2;
  animation: dash-flow 2s linear infinite;
}

@keyframes dash-flow {
  0% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: 8; }
}
```

## 9. Accessibility Specifications

### ARIA Labels and Roles
```html
<svg role="img" aria-labelledby="timeline-title" aria-describedby="timeline-desc">
  <title id="timeline-title">Agent Timeline Visualization</title>
  <desc id="timeline-desc">Interactive timeline showing agent spawning, messaging, and batch execution</desc>
  
  <g role="list" aria-label="Agent lifecycles">
    <path role="listitem" 
          aria-label="Coder agent from 10:30 to 10:45, sent 5 messages"
          tabindex="0">
    </path>
  </g>
  
  <g role="list" aria-label="Inter-agent messages">
    <circle role="listitem" 
            aria-label="Message from Coder to Tester at 10:32"
            tabindex="0">
    </circle>
  </g>
</svg>
```

### Keyboard Navigation
```css
.timeline-svg {
  outline: none;
}

.timeline-svg:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.focusable-element {
  outline: none;
}

.focusable-element:focus {
  stroke: #3b82f6;
  stroke-width: 3px;
  filter: drop-shadow(0 0 8px #3b82f6);
}
```

### Screen Reader Support
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.timeline-summary {
  background: rgba(17, 24, 39, 0.9);
  border: 1px solid rgba(59, 130, 246, 0.3);
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}
```

## 10. Performance Optimization Guidelines

### SVG Optimization
```css
.timeline-svg {
  /* Promote to GPU layer */
  will-change: transform;
  /* Optimize rendering */
  shape-rendering: geometricPrecision;
  text-rendering: optimizeLegibility;
}

.static-elements {
  /* Cache static layers */
  will-change: auto;
}

.dynamic-elements {
  /* Only animate dynamic content */
  will-change: transform, opacity;
}
```

### Animation Performance
```css
.timeline-animation {
  /* Use transform and opacity for smooth animations */
  transform: translateZ(0); /* Force GPU layer */
  backface-visibility: hidden;
  /* Limit repaints */
  contain: layout style paint;
}
```

### Memory Management
```css
.timeline-viewport {
  /* Virtualization support */
  contain: layout size style;
}

.offscreen-elements {
  display: none;
}
```

## 11. Integration with Existing System

### WebSocket Message Handling
```typescript
// Extend existing WebSocket events
interface TimelineAgentEvent {
  type: 'agent_spawn' | 'agent_message' | 'agent_complete' | 'batch_start' | 'batch_end';
  agent_id: string;
  agent_type: string;
  timestamp: number;
  session_id: string;
  batch_id?: string;
  message_content?: string;
  target_agent?: string;
}
```

### Color System Integration
```typescript
// Extend existing useEventColors
export function useAgentColors() {
  const agentTypeColors = {
    'orchestrator': '#00d4ff',
    'coder': '#ff6b6b',
    'architect': '#4ecdc4',
    'reviewer': '#95e77e',
    'tester': '#ffd93d',
    'verifier': '#a78bfa',
    'planner': '#f97316',
    'analyst': '#ec4899',
    'researcher': '#06b6d4',
    'designer': '#8b5cf6',
    'deployer': '#22c55e'
  };
  
  const getAgentTypeColor = (agentType: string): string => {
    return agentTypeColors[agentType] || '#3b82f6';
  };
  
  return { getAgentTypeColor, agentTypeColors };
}
```

## Implementation Priority

1. **Phase 1**: Basic SVG structure with agent lifecycles and color system
2. **Phase 2**: Real-time animations and WebSocket integration  
3. **Phase 3**: Interactive features (hover, click, selection)
4. **Phase 4**: Message detail pane and batch grouping
5. **Phase 5**: Responsive design and accessibility features
6. **Phase 6**: Performance optimization and advanced features

This specification provides a complete foundation for implementing the agent timeline visualization component while maintaining consistency with the existing dashboard design system.