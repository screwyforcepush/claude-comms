# Matrix Canvas Renderer Test Plan

## Testing Strategy Overview

This document outlines the comprehensive test-first development strategy for WP2: Canvas 2D Renderer implementation. All tests will be written BEFORE implementation to ensure behavior-driven development.

## Test Architecture

### Test Pyramid Structure
- **Unit Tests (70%)**: Core rendering logic, character mapping, performance utilities
- **Integration Tests (20%)**: Component lifecycle, Canvas API integration, Vue integration
- **E2E Tests (10%)**: Visual validation, performance benchmarks, user interactions

### Testing Frameworks
- **Vitest**: Primary test runner (existing project pattern)
- **Vue Test Utils**: Component testing
- **Canvas Mock**: Canvas 2D API mocking for unit tests
- **jsdom**: DOM environment for Canvas testing
- **Playwright**: Visual regression and performance testing

## Core Test Categories

### 1. Canvas Renderer Core (`MatrixCanvasRenderer.test.ts`)

#### Canvas Setup & Lifecycle
```typescript
describe('Canvas Setup', () => {
  it('creates canvas element with correct dimensions')
  it('initializes 2D rendering context')
  it('handles canvas resize events')
  it('cleans up resources on unmount')
})
```

#### Column System
```typescript
describe('Column System', () => {
  it('calculates correct number of columns for viewport width')
  it('uses 20px column width consistently')
  it('distributes characters evenly across columns')
  it('handles viewport resize for column recalculation')
})
```

#### Character Rendering
```typescript
describe('Character Rendering', () => {
  it('renders characters with Courier New font')
  it('applies correct font size and weight')
  it('handles character spacing and positioning')
  it('renders different character sets (katakana, symbols, alphanumeric)')
})
```

#### Trail Effects
```typescript
describe('Trail Effects', () => {
  it('creates opacity gradients for character trails')
  it('maintains trail length between 8-15 characters')
  it('applies smooth opacity transitions')
  it('removes old trail segments efficiently')
})
```

### 2. Animation System (`MatrixAnimation.test.ts`)

#### RequestAnimationFrame Loop
```typescript
describe('Animation Loop', () => {
  it('starts RAF loop on mount')
  it('stops RAF loop on unmount')
  it('maintains target 60fps frame rate')
  it('handles frame dropping gracefully')
})
```

#### Batch Rendering
```typescript
describe('Batch Rendering', () => {
  it('batches multiple character updates in single frame')
  it('optimizes canvas draw calls')
  it('prevents unnecessary redraws')
  it('handles large numbers of drops efficiently (1000+)')
})
```

#### Performance Monitoring
```typescript
describe('Performance Monitoring', () => {
  it('tracks frame rate accurately')
  it('measures render time per frame')
  it('detects performance degradation')
  it('provides memory usage metrics')
})
```

### 3. Matrix Drop System (`MatrixDrop.test.ts`)

#### Drop Creation
```typescript
describe('Drop Creation', () => {
  it('creates drops with correct initial properties')
  it('assigns drops to appropriate columns')
  it('sets initial speed based on event age')
  it('applies correct character sequences')
})
```

#### Drop Animation
```typescript
describe('Drop Animation', () => {
  it('moves drops downward at correct speed')
  it('updates trail positions smoothly')
  it('handles screen boundary collision')
  it('removes drops that exit viewport')
})
```

#### Drop Pooling
```typescript
describe('Object Pooling', () => {
  it('reuses drop objects to prevent GC pressure')
  it('initializes pooled objects correctly')
  it('maintains pool size limits')
  it('handles pool exhaustion gracefully')
})
```

### 4. Vue Component Integration (`MatrixRainCanvas.vue.test.ts`)

#### Component Lifecycle
```typescript
describe('Vue Lifecycle', () => {
  it('initializes canvas on mount')
  it('starts animation loop after mount')
  it('stops animation on unmount')
  it('cleans up event listeners')
})
```

#### Props & Reactivity
```typescript
describe('Props & Reactivity', () => {
  it('responds to configuration changes')
  it('updates rendering when props change')
  it('handles prop validation correctly')
  it('emits performance events')
})
```

#### Event Handling
```typescript
describe('Event Handling', () => {
  it('handles window resize events')
  it('responds to visibility changes')
  it('manages focus/blur states')
  it('handles error conditions gracefully')
})
```

### 5. Performance Tests (`MatrixPerformance.test.ts`)

#### Frame Rate Validation
```typescript
describe('Frame Rate Performance', () => {
  it('maintains 60fps with 100 drops')
  it('maintains 60fps with 500 drops')
  it('maintains 60fps with 1000 drops')
  it('gracefully degrades with 2000+ drops')
})
```

#### Memory Management
```typescript
describe('Memory Management', () => {
  it('memory usage stays under 50MB baseline')
  it('no memory leaks after extended operation')
  it('efficient garbage collection patterns')
  it('object pool prevents excessive allocation')
})
```

#### Rendering Optimization
```typescript
describe('Rendering Optimization', () => {
  it('minimizes canvas draw calls')
  it('uses efficient clipping regions')
  it('batches similar operations')
  it('avoids unnecessary context state changes')
})
```

### 6. WebGL Fallback Tests (`MatrixWebGLRenderer.test.ts`)

#### WebGL Detection
```typescript
describe('WebGL Fallback', () => {
  it('detects WebGL availability')
  it('falls back to Canvas 2D when WebGL unavailable')
  it('switches to WebGL when performance threshold exceeded')
  it('maintains same visual output across renderers')
})
```

## Visual Regression Tests

### Playwright Visual Tests
```typescript
// Visual validation of Matrix effects
test('Matrix rain renders correctly', async ({ page }) => {
  // Screenshot comparison for visual regression
})

test('Character trails fade properly', async ({ page }) => {
  // Validate opacity gradients
})

test('New event spawn effects work', async ({ page }) => {
  // Test pulse and glow effects
})
```

## Performance Benchmarks

### Automated Performance Tests
```typescript
describe('Performance Benchmarks', () => {
  it('renders 1000 drops in under 16ms per frame')
  it('startup time under 100ms')
  it('memory usage stable over 5 minutes')
  it('no dropped frames during 30-second test')
})
```

## Test Data & Mocks

### Canvas Mock Setup
```typescript
// Mock Canvas 2D context for unit tests
const mockCanvas2D = {
  fillRect: vi.fn(),
  fillText: vi.fn(),
  clearRect: vi.fn(),
  // ... other Canvas methods
}
```

### Matrix Drop Test Data
```typescript
const testDrops = [
  {
    column: 0,
    y: 0,
    speed: 100,
    characters: ['ア', 'イ', 'ウ'],
    brightness: [1.0, 0.8, 0.6],
    age: 0
  }
  // ... more test cases
]
```

## Coverage Requirements

### Minimum Coverage Targets
- **Overall Coverage**: 80%
- **Canvas Renderer Core**: 90%
- **Animation System**: 85%
- **Vue Component**: 80%
- **Performance Utils**: 75%

### Critical Path Coverage
- Canvas initialization: 100%
- Animation loop: 100%
- Character rendering: 95%
- Memory management: 90%
- Error handling: 85%

## Test Execution Strategy

### Development Workflow
1. **Red Phase**: Write failing tests first
2. **Green Phase**: Implement minimal code to pass tests
3. **Refactor Phase**: Optimize while keeping tests green

### Continuous Integration
- All tests run on every commit
- Performance benchmarks run on PR
- Visual regression tests run weekly
- Memory leak tests run nightly

## Performance Test Acceptance Criteria

### Frame Rate Requirements
- 60fps sustained with 1000 active drops
- Frame time variance < 2ms
- No dropped frames during normal operation
- Graceful degradation above performance limits

### Memory Requirements
- Baseline memory < 50MB for Matrix mode
- No memory leaks over 5-minute test
- Object pool prevents excessive GC pressure
- Memory growth < 1MB/minute during normal operation

### Startup Performance
- Canvas initialization < 100ms
- First frame render < 50ms
- Animation loop start < 16ms
- Full component ready < 200ms

## Test Implementation Schedule

### Phase 1: Core Tests (Day 1)
- Canvas setup and lifecycle tests
- Basic character rendering tests
- Animation loop foundation tests

### Phase 2: Integration Tests (Day 2)
- Vue component integration tests
- Props and reactivity tests
- Event handling tests

### Phase 3: Performance Tests (Day 3)
- Frame rate validation tests
- Memory management tests
- Rendering optimization tests

### Phase 4: Visual & E2E Tests (Day 4)
- Playwright visual regression tests
- Performance benchmark automation
- Full integration validation

This comprehensive test plan ensures that the Matrix Canvas Renderer will be thoroughly validated before and during implementation, following true test-driven development principles.