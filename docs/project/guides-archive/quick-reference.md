# Timeline Design Quick Reference

## Overview
Transform timeline from basic horizontal lines to polished bezier curve branching system.

## Critical Issues Fixed
1. ✅ Agent paths never terminate (Date.now() fallback)
2. ✅ Disconnected branches (missing curve integration)  
3. ✅ Y-axis overlaps (insufficient 40px spacing)
4. ✅ Batch misordering (discovery-time vs chronological)
5. ✅ Static labels (don't follow curves)

## Key Files Created

### Design Specifications
- **`timeline-design-specs.md`** - Complete design system specifications
- **`timeline-tokens.json`** - Design tokens and color system  
- **`timeline-implementation-guide.md`** - Code examples and utilities
- **`integration-roadmap.md`** - 5-phase implementation plan

### Utility Classes (Ready to Use)
- **`TimelineCurveGenerator`** - Arc-length parameterized bezier curves
- **`SmartLaneAllocator`** - Interval scheduling Y-positioning
- **`CurveLabelPlacer`** - Collision-aware curved label placement
- **`CurveAnimator`** - Spawn/completion animations

## Phase 1 Quick Fixes (4 hours)

### Fix Agent Termination
```typescript
// InteractiveAgentTimeline.vue:651
const getAgentEndX = (agent: any): number => {
  const endTime = agent.completion_timestamp || agent.endTime || Date.now();
  return getTimeX(endTime);
};
```

### Fix Batch Ordering
```typescript  
// InteractiveAgentTimeline.vue:574
let batchNumber = 1;
const sortedAgents = visibleAgents.value.sort((a, b) => a.startTime - b.startTime);
// ...assign batchNumber++ sequentially
```

### Increase Lane Height
```scss
// timeline.css
:root { --timeline-lane-height: 60px; }
```

## Phase 2 Curve Integration (2 days)

### Import Utilities
```typescript
import { TimelineCurveGenerator } from '@/utils/bezierCurves';
import { SmartLaneAllocator } from '@/utils/laneAllocator';
```

### Replace Agent Rendering
```vue
<!-- Agent curves instead of straight lines -->
<path 
  :d="agent.curve?.pathData"
  :class="['timeline-agent-path', `agent-type-${agent.type}`]"
  :stroke="getAgentColor(agent.type)"
/>
```

## Design Tokens Usage

### CSS Custom Properties
```scss
.agent-curve {
  stroke: var(--colors-agents-engineer-primary);
  stroke-width: var(--layout-stroke-widths-normal);
  animation-duration: var(--animation-duration-spawn);
  filter: var(--effects-glows-medium);
}
```

### Agent Type Colors
- **Architect**: `#ec4899` (Pink)
- **Engineer**: `#22c55e` (Green)  
- **Tester**: `#eab308` (Yellow)
- **Reviewer**: `#a855f7` (Purple)
- **Designer**: `#f97316` (Orange)

### Animation Timings
- **Fast**: `200ms` (hover states)
- **Normal**: `300ms` (transitions)
- **Spawn**: `400ms` (path growth)
- **Completion**: `1500ms` (celebration)

## Key Algorithms

### Bezier Curve Generation
```typescript
// Arc-length parameterized for constant speed
curve = generateAgentCurve(spawnX, laneY, endX, orchestratorY, agentType);
// Returns: { pathData, arcLength, start, end, controlPoints }
```

### Smart Lane Assignment  
```typescript
// Interval scheduling with priority
assignments = laneAllocator.allocateLanes(agentIntervals);
// Minimizes overlaps, reuses Y positions across non-overlapping batches
```

### Label Placement
```typescript
// Curvature-aware with collision avoidance
placement = labelPlacer.placeLabelOnCurve(curve, labelText, fontSize);  
// Returns: { position, rotation, usesLeaderLine, leaderPath }
```

## Visual Hierarchy

### Element Priority (Z-Index)
1. **Tooltips**: 1000
2. **Labels**: 110  
3. **Orchestrator**: 100
4. **Messages**: 90
5. **Agent Paths**: 80
6. **Batch Backgrounds**: 30

### Status Visual Encoding
- **Pending**: Dashed stroke, subtle pulse
- **In Progress**: Animated dash flow, medium glow
- **Completed**: Solid stroke, subtle glow  
- **Error**: Thick stroke, bright pulse

## Performance Considerations

### Thresholds
- **Virtualization**: >200 agents
- **Level of Detail**: <0.5x zoom
- **Canvas Fallback**: >500 elements

### Optimizations
- Arc-length pre-computation and caching
- Viewport culling for large datasets
- Batch DOM updates via requestAnimationFrame
- Web Worker lane allocation for >100 agents

## Accessibility Features

### High Contrast Mode
```scss
@media (prefers-contrast: high) {
  .agent-curve { stroke-width: 4px; filter: none; }
}
```

### Reduced Motion
```scss
@media (prefers-reduced-motion: reduce) {
  * { animation: none; transition: none; }
}
```

### Keyboard Navigation
- Focus management with visible outlines
- Screen reader announcements for state changes
- Tab order through interactive elements

## Testing Checklist

### Phase 1 Validation
- [ ] Agent paths end at completion timestamp
- [ ] Batch numbers in chronological order  
- [ ] No label overlaps at 60px height
- [ ] Existing functionality preserved

### Phase 2 Validation
- [ ] Smooth curves from orchestrator trunk
- [ ] Smart Y-positioning prevents overlaps
- [ ] Performance maintains 60fps <50 agents
- [ ] Visual termination at completion points

### Browser Compatibility
- **Chrome/Edge**: Full support
- **Firefox**: Full support (minor gradient differences)
- **Safari**: Full support (requires `-webkit-` prefixes)
- **Mobile**: Touch-optimized interactions

## Common Issues & Solutions

### Issue: Curves appear straight
**Solution**: Verify curve control points have sufficient distance from start/end

### Issue: Labels overlap  
**Solution**: Increase collision buffer in `CurveLabelPlacer` configuration

### Issue: Performance degradation
**Solution**: Enable virtualization or reduce animation complexity

### Issue: Accessibility warnings
**Solution**: Ensure proper ARIA labels and focus management

## Support Resources

- **Design Specs**: Complete visual specifications and rationale
- **Implementation Guide**: Step-by-step code examples
- **Integration Roadmap**: Phased rollout plan with success criteria
- **Design Tokens**: JSON configuration for consistent styling

All specifications include exact pixel values, color codes, animation timings, and mathematical formulas for immediate implementation.