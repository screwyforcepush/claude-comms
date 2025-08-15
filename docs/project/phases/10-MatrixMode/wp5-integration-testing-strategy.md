# WP5: Matrix WebSocket Integration Testing Strategy

## Testing Framework Alignment

### Discovered Testing Architecture
- **Primary Framework**: Vitest + Testing Library (Vue 3 compatible)
- **Existing Patterns**: Canvas mock utilities already in codebase
- **Performance Testing**: Integration with existing benchmarking tools
- **Visual Regression**: Planned Playwright screenshot testing

### Team Coordination Points
- **NancyTest**: Creating Canvas mock utilities and performance measurement tools
- **MarkCanvas**: TDD approach with Canvas renderer testing
- **JohnState**: State management testing with object pooling validation
- **DaveTransform**: Event transformation accuracy testing

## Unit Testing Strategy

### WebSocket Integration Tests

```typescript
// Test file: composables/__tests__/useMatrixWebSocket.test.ts

describe('useMatrixWebSocket', () => {
  let mockWebSocket: MockWebSocket;
  let mockStateManager: MockMatrixState;
  
  beforeEach(() => {
    mockWebSocket = new MockWebSocket();
    mockStateManager = new MockMatrixState();
  });

  describe('Event Subscription', () => {
    test('should enable Matrix mode without disrupting normal timeline', () => {
      const { enableMatrixMode, matrixEvents } = useMatrixWebSocket(
        mockWebSocket, 
        ref(false)
      );
      
      // Normal timeline should still receive events
      mockWebSocket.sendMessage({ 
        type: 'event', 
        data: mockHookEvent() 
      });
      
      expect(mockWebSocket.normalHandlerCalled).toBe(true);
      expect(matrixEvents.value).toHaveLength(0);
      
      // Enable Matrix mode
      enableMatrixMode(true);
      
      mockWebSocket.sendMessage({ 
        type: 'event', 
        data: mockHookEvent() 
      });
      
      expect(mockWebSocket.normalHandlerCalled).toBe(true);
      expect(matrixEvents.value).toHaveLength(1);
    });

    test('should filter events based on subscription settings', () => {
      const subscription: MatrixEventSubscription = {
        isActive: true,
        eventTypes: new Set(['user_prompt', 'agent_spawn']),
        sessionFilter: 'test-session',
        maxEventHistory: 100,
        transformOptions: mockTransformOptions()
      };
      
      const { updateSubscription, matrixEvents } = useMatrixWebSocket(
        mockWebSocket, 
        ref(true)
      );
      
      updateSubscription(subscription);
      
      // Should process matching event
      mockWebSocket.sendMessage({
        type: 'event',
        data: mockHookEvent({ 
          hook_event_type: 'user_prompt',
          session_id: 'test-session'
        })
      });
      
      expect(matrixEvents.value).toHaveLength(1);
      
      // Should filter out non-matching event
      mockWebSocket.sendMessage({
        type: 'event',
        data: mockHookEvent({ 
          hook_event_type: 'status_update',
          session_id: 'test-session'
        })
      });
      
      expect(matrixEvents.value).toHaveLength(1);
    });
  });

  describe('Performance and Memory Management', () => {
    test('should enforce event buffer limits', () => {
      const { matrixEvents } = useMatrixWebSocket(
        mockWebSocket, 
        ref(true),
        { eventHistory: 10 }
      );
      
      // Add 15 events
      for (let i = 0; i < 15; i++) {
        mockWebSocket.sendMessage({
          type: 'event',
          data: mockHookEvent({ id: i })
        });
      }
      
      // Should only keep latest 10
      expect(matrixEvents.value).toHaveLength(10);
      expect(matrixEvents.value[0].metadata.originalEvent.id).toBe(5);
    });

    test('should cleanup old events based on age', () => {
      const { forceCleanup, matrixEvents } = useMatrixWebSocket(
        mockWebSocket, 
        ref(true)
      );
      
      // Add events with different ages
      const oldEvent = mockHookEvent({ timestamp: Date.now() - 120000 }); // 2 minutes old
      const newEvent = mockHookEvent({ timestamp: Date.now() }); // Current
      
      mockWebSocket.sendMessage({ type: 'event', data: oldEvent });
      mockWebSocket.sendMessage({ type: 'event', data: newEvent });
      
      expect(matrixEvents.value).toHaveLength(2);
      
      forceCleanup();
      
      // Old event should be removed (assuming 60s max age)
      expect(matrixEvents.value).toHaveLength(1);
      expect(matrixEvents.value[0].sessionId).toBe(newEvent.session_id);
    });
  });

  describe('Dual Mode Operation', () => {
    test('should handle normal and Matrix mode concurrently', async () => {
      const normalHandler = vi.fn();
      const matrixHandler = vi.fn();
      
      const integration = new MatrixWebSocketIntegration(
        { handleWebSocketMessage: normalHandler },
        { processWebSocketMessage: matrixHandler },
        ref(true)
      );
      
      const message = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'event',
          data: mockHookEvent()
        })
      });
      
      integration.handleMessage(message);
      
      expect(normalHandler).toHaveBeenCalledWith(message);
      expect(matrixHandler).toHaveBeenCalledWith(expect.any(Object));
    });
  });
});
```

### Event Transformation Tests

```typescript
// Test file: utils/__tests__/matrixEventProcessor.test.ts

describe('MatrixEventProcessor', () => {
  let processor: MatrixEventProcessor;
  
  beforeEach(() => {
    processor = new MatrixEventProcessor({
      columnCount: 120,
      characterSets: DEFAULT_MATRIX_CHARACTER_SETS,
      speedMapping: DEFAULT_EVENT_SPEED_MAPPING,
      colorMapping: DEFAULT_EVENT_COLOR_MAPPING,
      trailLength: 12
    });
  });

  describe('Event Processing', () => {
    test('should transform HookEvent to MatrixDrop correctly', () => {
      const event: HookEvent = {
        id: 1,
        source_app: 'test-app',
        session_id: 'session-123',
        hook_event_type: 'user_prompt',
        payload: { agentName: 'TestAgent' },
        timestamp: Date.now()
      };
      
      const drop = processor.processNewEvent(event);
      
      expect(drop).toBeDefined();
      expect(drop?.character).toBe('ユ'); // User prompt character
      expect(drop?.color).toBe('user');
      expect(drop?.speed).toBeGreaterThan(0);
      expect(drop?.column).toBeGreaterThanOrEqual(0);
      expect(drop?.column).toBeLessThan(120);
      expect(drop?.sessionId).toBe('session-123');
    });

    test('should assign columns deterministically based on session', () => {
      const event1 = mockHookEvent({ session_id: 'session-a' });
      const event2 = mockHookEvent({ session_id: 'session-a' });
      const event3 = mockHookEvent({ session_id: 'session-b' });
      
      const drop1 = processor.processNewEvent(event1);
      const drop2 = processor.processNewEvent(event2);
      const drop3 = processor.processNewEvent(event3);
      
      // Same session should use same column
      expect(drop1?.column).toBe(drop2?.column);
      // Different session should use different column
      expect(drop1?.column).not.toBe(drop3?.column);
    });
  });

  describe('Character Mapping', () => {
    test('should map event types to correct characters', () => {
      const testCases = [
        { type: 'user_prompt', expected: 'ユ' },
        { type: 'subagent_registered', expected: 'エ' },
        { type: 'agent_status_update', expected: 'ス' },
        { type: 'subagent_message', expected: 'メ' },
        { type: 'error', expected: '❌' },
        { type: 'complete', expected: '✓' }
      ];
      
      testCases.forEach(({ type, expected }) => {
        const event = mockHookEvent({ hook_event_type: type });
        const drop = processor.processNewEvent(event);
        expect(drop?.character).toBe(expected);
      });
    });
  });
});
```

## Integration Testing Strategy

### WebSocket → Canvas Pipeline Test

```typescript
// Test file: integration/__tests__/matrix-pipeline.integration.test.ts

describe('Matrix Pipeline Integration', () => {
  let mockCanvas: MockCanvas2D;
  let mockWebSocket: MockWebSocket;
  let matrixSystem: MatrixSystem;
  
  beforeEach(() => {
    mockCanvas = new MockCanvas2D();
    mockWebSocket = new MockWebSocket();
    matrixSystem = new MatrixSystem({
      canvas: mockCanvas,
      webSocket: mockWebSocket
    });
  });

  test('should process WebSocket event through complete pipeline', async () => {
    const event: HookEvent = {
      id: 1,
      source_app: 'test-app',
      session_id: 'session-123',
      hook_event_type: 'user_prompt',
      payload: { content: 'Test prompt' },
      timestamp: Date.now()
    };
    
    // Enable Matrix mode
    matrixSystem.enableMatrixMode(true);
    
    // Send WebSocket message
    mockWebSocket.sendMessage({
      type: 'event',
      data: event
    });
    
    // Wait for processing
    await vi.waitFor(() => {
      expect(matrixSystem.getActiveDrops()).toHaveLength(1);
    });
    
    // Trigger render cycle
    await matrixSystem.renderFrame();
    
    // Verify Canvas operations
    expect(mockCanvas.drawText).toHaveBeenCalledWith(
      'ユ', // User prompt character
      expect.any(Number), // x position
      expect.any(Number), // y position
      expect.objectContaining({
        color: expect.stringContaining('#'), // Matrix color
        alpha: expect.any(Number)
      })
    );
  });

  test('should handle high-volume event processing', async () => {
    const eventCount = 100;
    const events = Array.from({ length: eventCount }, (_, i) => 
      mockHookEvent({ id: i, session_id: `session-${i % 10}` })
    );
    
    matrixSystem.enableMatrixMode(true);
    
    // Send events in rapid succession
    events.forEach(event => {
      mockWebSocket.sendMessage({ type: 'event', data: event });
    });
    
    // Wait for processing
    await vi.waitFor(() => {
      expect(matrixSystem.getActiveDrops().length).toBeGreaterThan(50);
    });
    
    // Verify performance metrics
    const metrics = matrixSystem.getPerformanceMetrics();
    expect(metrics.processingLatency).toBeLessThan(50); // < 50ms
    expect(metrics.memoryUsageMB).toBeLessThan(50); // < 50MB
  });
});
```

## Performance Testing Strategy

### Canvas Rendering Performance

```typescript
// Test file: performance/__tests__/matrix-canvas.performance.test.ts

describe('Matrix Canvas Performance', () => {
  let canvas: HTMLCanvasElement;
  let renderer: MatrixCanvasRenderer;
  
  beforeEach(() => {
    canvas = createMockCanvas(1920, 1080);
    renderer = new MatrixCanvasRenderer(canvas);
  });

  test('should maintain 60fps with 1000 active drops', async () => {
    const drops = Array.from({ length: 1000 }, (_, i) => 
      mockMatrixDrop({ id: `drop-${i}`, column: i % 120 })
    );
    
    renderer.setDrops(drops);
    
    const frameTimings: number[] = [];
    const startTime = performance.now();
    
    // Render 60 frames (1 second at 60fps)
    for (let frame = 0; frame < 60; frame++) {
      const frameStart = performance.now();
      await renderer.renderFrame();
      const frameEnd = performance.now();
      
      frameTimings.push(frameEnd - frameStart);
    }
    
    const totalTime = performance.now() - startTime;
    const avgFrameTime = frameTimings.reduce((a, b) => a + b) / frameTimings.length;
    const fps = 1000 / avgFrameTime;
    
    expect(fps).toBeGreaterThanOrEqual(55); // Allow 5fps tolerance
    expect(avgFrameTime).toBeLessThan(16.67); // 60fps = 16.67ms per frame
    expect(totalTime).toBeLessThan(1100); // Should complete within reasonable time
  });

  test('should handle memory efficiently with object pooling', () => {
    const initialMemory = getMemoryUsage();
    
    // Create and destroy many drops
    for (let cycle = 0; cycle < 10; cycle++) {
      const drops = Array.from({ length: 1000 }, (_, i) => 
        mockMatrixDrop({ id: `cycle-${cycle}-drop-${i}` })
      );
      
      renderer.setDrops(drops);
      renderer.renderFrame();
      renderer.clearDrops();
    }
    
    const finalMemory = getMemoryUsage();
    const memoryIncrease = finalMemory - initialMemory;
    
    // Memory increase should be minimal due to object pooling
    expect(memoryIncrease).toBeLessThan(10); // < 10MB increase
  });
});
```

## Visual Regression Testing

### Matrix Visual Elements

```typescript
// Test file: visual/__tests__/matrix-visual.test.ts

describe('Matrix Visual Regression', () => {
  test('should render character trails consistently', async () => {
    const { page } = await setupPlaywright();
    
    await page.goto('/matrix-test');
    await page.click('[data-testid="enable-matrix-mode"]');
    
    // Add test events
    await page.evaluate(() => {
      window.addTestMatrixEvents([
        { type: 'user_prompt', count: 5 },
        { type: 'agent_spawn', count: 10 },
        { type: 'message', count: 20 }
      ]);
    });
    
    // Wait for animation to settle
    await page.waitForTimeout(2000);
    
    // Capture screenshot
    const screenshot = await page.screenshot({
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
    
    // Compare with baseline
    expect(screenshot).toMatchImageSnapshot({
      threshold: 0.05, // 5% tolerance for timing differences
      customDiffDir: './visual-diffs/matrix'
    });
  });

  test('should render different event types with correct colors', async () => {
    const { page } = await setupPlaywright();
    
    await page.goto('/matrix-test');
    await page.click('[data-testid="enable-matrix-mode"]');
    
    // Add specific event types
    const eventTypes = ['user_prompt', 'error', 'complete', 'agent_spawn'];
    
    for (const eventType of eventTypes) {
      await page.evaluate((type) => {
        window.addSingleMatrixEvent({ type, position: 'center' });
      }, eventType);
      
      await page.waitForTimeout(500);
      
      const screenshot = await page.screenshot({
        clip: { x: 950, y: 200, width: 20, height: 100 } // Center column
      });
      
      expect(screenshot).toMatchImageSnapshot({
        customSnapshotIdentifier: `matrix-${eventType}-color`
      });
    }
  });
});
```

## Mock Utilities for Team Integration

### Canvas Mock for Testing

```typescript
// Test utility: __tests__/utils/mockCanvas.ts

export class MockCanvas2D {
  public drawText = vi.fn();
  public fillRect = vi.fn();
  public clearRect = vi.fn();
  public save = vi.fn();
  public restore = vi.fn();
  
  private _globalAlpha = 1;
  private _fillStyle = '#000000';
  private _font = '12px monospace';
  
  get globalAlpha() { return this._globalAlpha; }
  set globalAlpha(value: number) { this._globalAlpha = value; }
  
  get fillStyle() { return this._fillStyle; }
  set fillStyle(value: string) { this._fillStyle = value; }
  
  get font() { return this._font; }
  set font(value: string) { this._font = value; }
  
  fillText(text: string, x: number, y: number) {
    this.drawText(text, x, y, {
      color: this._fillStyle,
      alpha: this._globalAlpha,
      font: this._font
    });
  }
  
  getOperationHistory() {
    return {
      drawText: this.drawText.mock.calls,
      fillRect: this.fillRect.mock.calls,
      clearRect: this.clearRect.mock.calls
    };
  }
}
```

### WebSocket Mock for Integration Tests

```typescript
// Test utility: __tests__/utils/mockWebSocket.ts

export class MockWebSocket {
  public normalHandlerCalled = false;
  public matrixHandlerCalled = false;
  
  private handlers: { [key: string]: Function[] } = {};
  
  addEventListener(event: string, handler: Function) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(handler);
  }
  
  removeEventListener(event: string, handler: Function) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
  }
  
  sendMessage(data: any) {
    const event = new MessageEvent('message', {
      data: JSON.stringify(data)
    });
    
    if (this.handlers.message) {
      this.handlers.message.forEach(handler => handler(event));
    }
  }
  
  triggerNormalHandler() {
    this.normalHandlerCalled = true;
  }
  
  triggerMatrixHandler() {
    this.matrixHandlerCalled = true;
  }
}
```

## Test Data Factories

```typescript
// Test utility: __tests__/utils/testDataFactory.ts

export function mockHookEvent(overrides: Partial<HookEvent> = {}): HookEvent {
  return {
    id: Math.floor(Math.random() * 1000),
    source_app: 'test-app',
    session_id: 'test-session',
    hook_event_type: 'status_update',
    payload: { agentName: 'TestAgent' },
    timestamp: Date.now(),
    ...overrides
  };
}

export function mockMatrixDrop(overrides: Partial<MatrixDrop> = {}): MatrixDrop {
  return {
    id: `drop-${Math.random()}`,
    column: Math.floor(Math.random() * 120),
    character: 'テ',
    speed: 2,
    brightness: 0.8,
    trail: ['テ', 'ス', 'ト'],
    color: 'primary',
    age: 1000,
    eventType: 'test_event',
    sessionId: 'test-session',
    metadata: {
      originalEvent: mockHookEvent(),
      spawnTime: Date.now() - 1000,
      lastUpdate: Date.now(),
      isNewEvent: false,
      isCompleting: false,
      hasError: false
    },
    ...overrides
  };
}
```

This comprehensive testing strategy ensures Matrix WebSocket integration is reliable, performant, and visually consistent while supporting parallel development with the team.