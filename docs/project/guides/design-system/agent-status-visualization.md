# Agent Status Visualization Design Specification

## Overview

This specification defines the visual design for agent completion status visualization in the SubagentComms component. The design provides clear, accessible status indicators with metadata representation through visual encodings.

## Current State Analysis

**Existing Component Structure:**
- Location: `apps/client/src/components/SubagentComms.vue`
- Current styling: Basic agent list with minimal visual hierarchy
- Theme: Dark (gray-800/gray-700 backgrounds)
- Framework: Vue 3 + Tailwind CSS

**Current Data Structure:**
```typescript
interface Subagent {
  id: number;
  name: string;
  subagent_type: string;
  created_at: number;
}
```

**Missing Metadata:**
- Completion status (pending/in-progress/completed)
- Duration information
- Tool usage count
- Token consumption

## Design System Components

### 1. Status Indicators

**Visual States:**
- **Pending**: Hollow circle, neutral color (violet-400), "Queued" label
- **In-Progress**: Animated spinner ring, cyan/blue (sky-400), "Running" label
- **Completed**: Solid circle with checkmark, green (emerald-400), "Done" label
- **Error**: Diamond shape, red (red-400), "Error" label
- **Paused**: Double bars, amber (amber-400), "Paused" label

**Accessibility Features:**
- Color + shape + text redundancy (never color alone)
- ARIA labels and roles
- Screen reader friendly state announcements

### 2. Duration Visualization

**Progress Indicators:**
- **Determinate**: Horizontal progress bar with elapsed time and ETA
- **Indeterminate**: Animated shimmer effect with elapsed time only
- **Timeline**: Small timestamps showing start/end times

### 3. Metadata Encoding

**Tool Count Representation:**
- Small badge next to agent name
- Size tiers: XS (1-9), S (10-99), M (100+)
- Exact count in tooltip

**Token Usage Visualization:**
- Color intensity gradient (blue scale)
- Subtle background glow or border intensity
- Numeric value in metadata panel

**Resource Usage:**
- Micro-bars for CPU/memory if available
- Single-hue perceptual scale
- Compact representation

## Design Tokens

### Color Palette (Dark Theme Optimized)
```css
:root {
  /* Surface Colors */
  --bg-surface: #1f2937;        /* gray-800 */
  --bg-elevated: #374151;       /* gray-700 */
  --bg-elevated-hover: #4b5563; /* gray-600 */
  --border-subtle: rgba(255,255,255,0.08);
  
  /* Text Colors */
  --text-primary: #e5e7eb;      /* gray-200 */
  --text-secondary: #9ca3af;    /* gray-400 */
  --text-muted: #6b7280;        /* gray-500 */
  
  /* Status Colors (CVD-friendly) */
  --status-pending: #a78bfa;     /* violet-400 */
  --status-running: #38bdf8;     /* sky-400 */
  --status-completed: #34d399;   /* emerald-400 */
  --status-error: #f87171;       /* red-400 */
  --status-paused: #fbbf24;      /* amber-400 */
  
  /* Token Usage Intensity Scale */
  --token-low: #0ea5e9;         /* sky-500 */
  --token-medium: #38bdf8;      /* sky-400 */
  --token-high: #7dd3fc;        /* sky-300 */
  --token-extreme: #bae6fd;     /* sky-200 */
}
```

### Spacing & Sizing
```css
:root {
  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  
  /* Spacing */
  --gap-xs: 4px;
  --gap-sm: 6px;
  --gap-md: 8px;
  --gap-lg: 12px;
  
  /* Status Icon Sizes */
  --icon-sm: 12px;
  --icon-md: 16px;
  --icon-lg: 20px;
  
  /* Badge Sizes */
  --badge-xs: 16px;
  --badge-sm: 20px;
  --badge-md: 24px;
}
```

### Animation Timing
```css
:root {
  /* Duration */
  --anim-fast: 150ms;
  --anim-medium: 300ms;
  --anim-slow: 500ms;
  
  /* Easing */
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

## Component Architecture

### Enhanced Agent Card Structure
```vue
<div class="agent-card">
  <!-- Header with status and metadata -->
  <div class="agent-header">
    <StatusIndicator :status="agent.status" />
    <div class="agent-info">
      <h4 class="agent-name">{{ agent.name }}</h4>
      <p class="agent-type">{{ agent.subagent_type }}</p>
    </div>
    <div class="agent-metadata">
      <ToolCountBadge :count="agent.toolCount" />
      <TokenUsageIndicator :usage="agent.tokenUsage" />
    </div>
  </div>
  
  <!-- Progress visualization -->
  <div class="agent-progress">
    <ProgressBar v-if="agent.status === 'running'" 
                 :progress="agent.progress" 
                 :duration="agent.duration" />
    <Timeline v-else :startTime="agent.startTime" 
                    :endTime="agent.endTime" />
  </div>
  
  <!-- Status details -->
  <div class="agent-details">
    <span class="timestamp">{{ formatTime(agent.lastUpdate) }}</span>
    <span v-if="agent.eta" class="eta">ETA: {{ agent.eta }}</span>
  </div>
</div>
```

## Implementation Approach

### Phase 1: Status Indicators
1. Create `StatusIndicator.vue` component with all status states
2. Implement CSS-based icons for accessibility
3. Add ARIA labels and screen reader support

### Phase 2: Metadata Visualization  
1. Create `ToolCountBadge.vue` with size tiers
2. Implement `TokenUsageIndicator.vue` with color intensity
3. Add tooltips for detailed information

### Phase 3: Progress Components
1. Create `ProgressBar.vue` for determinate progress
2. Implement `Timeline.vue` for completed/failed tasks
3. Add smooth animations with performance considerations

### Phase 4: Integration
1. Update SubagentComms.vue to use new components
2. Extend Subagent interface with metadata fields
3. Update server endpoints to provide metadata

## CSS Implementation Samples

### Status Icon Styles
```css
.status-icon {
  width: var(--icon-md);
  height: var(--icon-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all var(--anim-fast) var(--ease-out);
}

.status-icon--pending {
  border: 2px solid var(--status-pending);
  background: transparent;
}

.status-icon--running {
  background: conic-gradient(
    from 0deg, 
    var(--status-running) 0 270deg, 
    transparent 270deg 360deg
  );
  animation: spin 1.2s linear infinite;
}

.status-icon--completed {
  background: var(--status-completed);
  position: relative;
}

.status-icon--completed::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 6px;
  height: 3px;
  border-left: 2px solid #000;
  border-bottom: 2px solid #000;
  transform: translate(-50%, -60%) rotate(-45deg);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### Tool Count Badge Styles
```css
.tool-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: var(--badge-xs);
  height: var(--badge-xs);
  padding: 0 var(--gap-xs);
}

.tool-badge--xs { /* 1-9 tools */
  width: var(--badge-xs);
}

.tool-badge--sm { /* 10-99 tools */
  width: var(--badge-sm);
}

.tool-badge--md { /* 100+ tools */
  width: var(--badge-md);
  font-weight: 700;
}
```

### Progress Bar Styles
```css
.progress-container {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-sm);
  overflow: hidden;
  position: relative;
}

.progress-bar {
  height: 100%;
  background: var(--status-running);
  transition: width var(--anim-medium) var(--ease-out);
  border-radius: var(--radius-sm);
}

.progress-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(56, 189, 248, 0.3) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
```

## Responsive Considerations

### Mobile Adaptations
- Stack metadata vertically on narrow screens
- Reduce badge sizes and spacing
- Simplify progress indicators
- Maintain touch target sizes (44px minimum)

### Tablet Adaptations
- Maintain horizontal layout
- Reduce spacing slightly
- Keep all metadata visible

## Performance Guidelines

1. **Animation Throttling**: Limit progress updates to 200-500ms intervals
2. **Efficient Rendering**: Use CSS transforms and opacity for animations
3. **Data Fetching**: Batch metadata updates to avoid excessive API calls
4. **Memory Management**: Cleanup animation intervals on component unmount

## Accessibility Compliance

### WCAG 2.1 AA Requirements
- Color contrast ratio ≥ 4.5:1 for all text
- Status information conveyed through multiple channels (color + shape + text)
- Keyboard navigation support
- Screen reader announcements for status changes

### Implementation Details
- Use `aria-live="polite"` for status updates
- Provide `aria-label` for all icons
- Include `role="progressbar"` for progress indicators
- Support `prefers-reduced-motion` for animations

## Future Enhancements

### Phase 2 Features
- Real-time sparkline charts for resource usage
- Expandable detail panels
- Agent performance comparisons
- Custom status filtering

### Advanced Visualizations
- Mini-timeline view for long-running agents
- Network graph of agent dependencies
- Performance heat maps
- Historical trend indicators

## Migration Strategy

1. **Backward Compatibility**: Maintain existing agent display while adding new features
2. **Progressive Enhancement**: New visualizations appear as metadata becomes available
3. **Feature Flags**: Allow toggling between old and new designs during transition
4. **Data Migration**: Extend existing data structures without breaking changes

This specification provides a comprehensive foundation for implementing effective agent status visualization while maintaining design system consistency and accessibility standards.