/**
 * Matrix Mode Testing Utilities
 * Provides comprehensive testing infrastructure for Matrix rain canvas rendering
 */

import { vi, type MockedFunction } from 'vitest';
import type { HookEvent } from '../../types';

// Canvas Mock Implementation
export interface MockCanvas2DContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  globalAlpha: number;
  shadowBlur: number;
  shadowColor: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  
  fillRect: MockedFunction<any>;
  fillText: MockedFunction<any>;
  clearRect: MockedFunction<any>;
  measureText: MockedFunction<any>;
  save: MockedFunction<any>;
  restore: MockedFunction<any>;
  translate: MockedFunction<any>;
  scale: MockedFunction<any>;
  rotate: MockedFunction<any>;
  
  // Call tracking for test validation
  _calls: {
    fillRect: Array<[number, number, number, number]>;
    fillText: Array<[string, number, number]>;
    clearRect: Array<[number, number, number, number]>;
  };
}

export function createMockCanvas2DContext(): MockCanvas2DContext {
  const context: MockCanvas2DContext = {
    fillStyle: '#000000',
    font: '16px monospace',
    globalAlpha: 1,
    shadowBlur: 0,
    shadowColor: 'transparent',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    
    fillRect: vi.fn(),
    fillText: vi.fn(),
    clearRect: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    
    _calls: {
      fillRect: [],
      fillText: [],
      clearRect: []
    }
  };

  // Track method calls for validation
  context.fillRect.mockImplementation((x: number, y: number, w: number, h: number) => {
    context._calls.fillRect.push([x, y, w, h]);
  });
  
  context.fillText.mockImplementation((text: string, x: number, y: number) => {
    context._calls.fillText.push([text, x, y]);
  });
  
  context.clearRect.mockImplementation((x: number, y: number, w: number, h: number) => {
    context._calls.clearRect.push([x, y, w, h]);
  });

  return context;
}

export interface MockHTMLCanvasElement {
  width: number;
  height: number;
  getContext: MockedFunction<any>;
  getBoundingClientRect: MockedFunction<any>;
  addEventListener: MockedFunction<any>;
  removeEventListener: MockedFunction<any>;
}

export function createMockCanvasElement(width = 800, height = 600): MockHTMLCanvasElement {
  const mockContext = createMockCanvas2DContext();
  
  return {
    width,
    height,
    getContext: vi.fn(() => mockContext),
    getBoundingClientRect: vi.fn(() => ({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0
    })),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };
}

// Performance Testing Utilities
export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  droppedFrames: number;
  memoryUsage: number;
  renderCalls: number;
}

export class MockPerformanceObserver {
  private metrics: PerformanceMetrics = {
    fps: 60,
    frameTime: 16.67,
    droppedFrames: 0,
    memoryUsage: 10 * 1024 * 1024, // 10MB in bytes
    renderCalls: 0
  };

  private frameCallbacks: Array<(timestamp: number) => void> = [];
  private isRunning = false;
  private lastFrameTime = 0;

  startFrameLoop(): void {
    this.isRunning = true;
    this.scheduleFrame();
  }

  stopFrameLoop(): void {
    this.isRunning = false;
  }

  onFrame(callback: (timestamp: number) => void): void {
    this.frameCallbacks.push(callback);
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  simulatePerformanceDrop(targetFps: number): void {
    this.metrics.fps = targetFps;
    this.metrics.frameTime = 1000 / targetFps;
    this.metrics.droppedFrames += Math.floor((60 - targetFps) / 2);
  }

  simulateMemoryIncrease(additionalMB: number): void {
    this.metrics.memoryUsage += additionalMB * 1024 * 1024;
  }

  private scheduleFrame(): void {
    if (!this.isRunning) return;
    
    setTimeout(() => {
      const now = performance.now();
      if (this.lastFrameTime) {
        const delta = now - this.lastFrameTime;
        this.metrics.frameTime = delta;
        this.metrics.fps = Math.min(60, 1000 / delta);
      }
      this.lastFrameTime = now;
      this.metrics.renderCalls++;
      
      this.frameCallbacks.forEach(callback => callback(now));
      this.scheduleFrame();
    }, this.metrics.frameTime);
  }
}

// Mock Event Data Generators
export function createMockHookEvent(overrides: Partial<HookEvent> = {}): HookEvent {
  return {
    id: Math.floor(Math.random() * 10000),
    source_app: 'client',
    session_id: `session-${Math.random().toString(36).substr(2, 9)}`,
    hook_event_type: 'pre_response',
    payload: { 
      agentName: `Agent${Math.floor(Math.random() * 100)}`,
      ...overrides.payload 
    },
    timestamp: Date.now(),
    ...overrides
  };
}

export function createMockEventStream(count: number, options: {
  agentNames?: string[];
  eventTypes?: string[];
  sessionIds?: string[];
  timeSpread?: number; // milliseconds
} = {}): HookEvent[] {
  const {
    agentNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
    eventTypes = ['pre_response', 'post_response', 'tool_use', 'error'],
    sessionIds = ['session-1', 'session-2', 'session-3'],
    timeSpread = 60000 // 1 minute
  } = options;

  const baseTime = Date.now() - timeSpread;
  
  return Array.from({ length: count }, (_, index) => {
    return createMockHookEvent({
      id: index + 1,
      hook_event_type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      session_id: sessionIds[Math.floor(Math.random() * sessionIds.length)],
      payload: {
        agentName: agentNames[Math.floor(Math.random() * agentNames.length)]
      },
      timestamp: baseTime + (index * (timeSpread / count)) + Math.random() * 1000
    });
  });
}

// Visual Testing Utilities
export interface MatrixRenderState {
  characters: Array<{
    x: number;
    y: number;
    char: string;
    opacity: number;
    speed: number;
  }>;
  columnCount: number;
  rowCount: number;
  fontSize: number;
}

export function createExpectedRenderState(
  canvasWidth: number,
  canvasHeight: number,
  fontSize: number = 16
): MatrixRenderState {
  const columnCount = Math.floor(canvasWidth / fontSize);
  const rowCount = Math.floor(canvasHeight / fontSize);
  
  return {
    characters: [],
    columnCount,
    rowCount,
    fontSize
  };
}

export function validateCharacterPositions(
  renderCalls: Array<[string, number, number]>,
  expectedState: MatrixRenderState
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  for (const [char, x, y] of renderCalls) {
    // Validate character is within canvas bounds
    if (x < 0 || x >= expectedState.columnCount * expectedState.fontSize) {
      errors.push(`Character at x=${x} is outside canvas bounds`);
    }
    
    if (y < 0 || y >= expectedState.rowCount * expectedState.fontSize) {
      errors.push(`Character at y=${y} is outside canvas bounds`);
    }
    
    // Validate character is on grid
    const expectedX = Math.floor(x / expectedState.fontSize) * expectedState.fontSize;
    if (Math.abs(x - expectedX) > 1) {
      errors.push(`Character at x=${x} is not aligned to grid (expected ${expectedX})`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Animation Testing Utilities
export class MockRequestAnimationFrame {
  private callbacks: Array<(timestamp: number) => void> = [];
  private currentTime = 0;
  private frameId = 1;

  requestAnimationFrame(callback: (timestamp: number) => void): number {
    this.callbacks.push(callback);
    return this.frameId++;
  }

  cancelAnimationFrame(id: number): void {
    // Mock implementation - in real tests we'd track IDs
  }

  tick(deltaTime: number = 16.67): void {
    this.currentTime += deltaTime;
    const callbacks = [...this.callbacks];
    this.callbacks = [];
    
    callbacks.forEach(callback => callback(this.currentTime));
  }

  getCurrentTime(): number {
    return this.currentTime;
  }
}

// Character Set Testing
export const TEST_CHARACTER_SETS = {
  katakana: ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ'],
  numeric: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  symbols: ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
  latin: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
};

export function validateCharacterSets(characterSets: Record<string, string[]>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  Object.entries(characterSets).forEach(([name, chars]) => {
    if (!Array.isArray(chars)) {
      errors.push(`Character set '${name}' is not an array`);
      return;
    }
    
    if (chars.length === 0) {
      errors.push(`Character set '${name}' is empty`);
      return;
    }
    
    const uniqueChars = new Set(chars);
    if (uniqueChars.size !== chars.length) {
      errors.push(`Character set '${name}' contains duplicates`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Browser Environment Mocking
export function setupCanvasEnvironment(): void {
  // Mock HTMLCanvasElement constructor
  global.HTMLCanvasElement = class MockHTMLCanvasElement {
    width = 800;
    height = 600;
    
    getContext(contextType: string) {
      if (contextType === '2d') {
        return createMockCanvas2DContext();
      }
      return null;
    }
    
    getBoundingClientRect() {
      return {
        width: this.width,
        height: this.height,
        top: 0,
        left: 0,
        right: this.width,
        bottom: this.height,
        x: 0,
        y: 0
      };
    }
    
    addEventListener() {}
    removeEventListener() {}
  } as any;

  // Mock requestAnimationFrame
  const mockRAF = new MockRequestAnimationFrame();
  global.requestAnimationFrame = mockRAF.requestAnimationFrame.bind(mockRAF);
  global.cancelAnimationFrame = mockRAF.cancelAnimationFrame.bind(mockRAF);
  
  // Store reference for test control
  (global as any).__mockRAF = mockRAF;
}

export function cleanupCanvasEnvironment(): void {
  delete (global as any).HTMLCanvasElement;
  delete (global as any).requestAnimationFrame;
  delete (global as any).cancelAnimationFrame;
  delete (global as any).__mockRAF;
}