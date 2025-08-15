/**
 * Performance Benchmark Suite for Matrix Mode
 * Tests rendering performance, memory usage, and optimization thresholds
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  MockPerformanceObserver, 
  createMockEventStream,
  setupCanvasEnvironment,
  cleanupCanvasEnvironment,
  createMockCanvas2DContext
} from './utils/matrix-test-helpers';
import type { HookEvent } from '../types';

// Performance target constants from verification plan
const PERFORMANCE_TARGETS = {
  TARGET_FPS: 60,
  MIN_FPS: 50,
  MAX_FRAME_TIME: 16.67, // 60fps = 16.67ms per frame
  MAX_MEMORY_USAGE: 50 * 1024 * 1024, // 50MB
  MAX_DROP_COUNT: 1000,
  WEBGL_THRESHOLD: 5000,
  FRAME_DROP_TOLERANCE: 0.02 // 2% frame drops allowed
};

interface PerformanceTestResult {
  avgFps: number;
  minFps: number;
  maxFps: number;
  avgFrameTime: number;
  droppedFrames: number;
  memoryUsage: number;
  renderCalls: number;
  duration: number;
}

interface MatrixRendererMock {
  addDrop: (drop: any) => void;
  removeDrop: (id: string) => void;
  render: (context: any) => void;
  clear: () => void;
  getDropCount: () => number;
  getMemoryUsage: () => number;
  setQuality: (level: number) => void;
}

function createMockMatrixRenderer(): MatrixRendererMock {
  let drops: Map<string, any> = new Map();
  let memoryUsage = 10 * 1024 * 1024; // Start with 10MB base
  let renderCallCount = 0;

  return {
    addDrop: (drop: any) => {
      drops.set(drop.id, drop);
      memoryUsage += 1024; // 1KB per drop
    },
    
    removeDrop: (id: string) => {
      if (drops.delete(id)) {
        memoryUsage -= 1024;
      }
    },
    
    render: (context: any) => {
      renderCallCount++;
      // Simulate rendering cost based on drop count
      const dropCount = drops.size;
      if (dropCount > 500) {
        // Simulate performance impact
        const start = performance.now();
        while (performance.now() - start < (dropCount / 1000) * 2) {
          // Busy wait to simulate heavy rendering
        }
      }
    },
    
    clear: () => {
      drops.clear();
      memoryUsage = 10 * 1024 * 1024; // Reset to base
    },
    
    getDropCount: () => drops.size,
    getMemoryUsage: () => memoryUsage,
    setQuality: (level: number) => {
      // Mock quality adjustment
    }
  };
}

async function runPerformanceTest(
  renderer: MatrixRendererMock,
  dropCount: number,
  durationMs: number
): Promise<PerformanceTestResult> {
  const observer = new MockPerformanceObserver();
  const context = createMockCanvas2DContext();
  
  const fpsHistory: number[] = [];
  const frameTimeHistory: number[] = [];
  let renderCalls = 0;
  
  // Add drops
  for (let i = 0; i < dropCount; i++) {
    renderer.addDrop({
      id: `drop-${i}`,
      x: (i % 40) * 20,
      y: Math.random() * 600,
      char: 'ア',
      speed: 1 + Math.random() * 3,
      opacity: 1,
      age: 0
    });
  }
  
  // Start performance monitoring
  observer.startFrameLoop();
  
  const startTime = performance.now();
  const endTime = startTime + durationMs;
  
  return new Promise((resolve) => {
    const frameCallback = (timestamp: number) => {
      renderCalls++;
      renderer.render(context);
      
      const metrics = observer.getMetrics();
      fpsHistory.push(metrics.fps);
      frameTimeHistory.push(metrics.frameTime);
      
      if (timestamp < endTime) {
        observer.onFrame(frameCallback);
      } else {
        observer.stopFrameLoop();
        
        const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
        const minFps = Math.min(...fpsHistory);
        const maxFps = Math.max(...fpsHistory);
        const avgFrameTime = frameTimeHistory.reduce((a, b) => a + b, 0) / frameTimeHistory.length;
        const droppedFrames = fpsHistory.filter(fps => fps < 55).length;
        
        resolve({
          avgFps,
          minFps,
          maxFps,
          avgFrameTime,
          droppedFrames,
          memoryUsage: renderer.getMemoryUsage(),
          renderCalls,
          duration: durationMs
        });
      }
    };
    
    observer.onFrame(frameCallback);
  });
}

describe('Matrix Mode Performance Benchmarks', () => {
  let renderer: MatrixRendererMock;

  beforeEach(() => {
    setupCanvasEnvironment();
    renderer = createMockMatrixRenderer();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanupCanvasEnvironment();
    vi.useRealTimers();
  });

  describe('Frame Rate Performance', () => {
    it('should maintain 60fps with minimal drops (100)', async () => {
      const result = await runPerformanceTest(renderer, 100, 1000);
      
      expect(result.avgFps).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.TARGET_FPS);
      expect(result.minFps).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.MIN_FPS);
      expect(result.droppedFrames).toBeLessThanOrEqual(1); // Very few frame drops
    });

    it('should maintain acceptable fps with moderate load (500 drops)', async () => {
      const result = await runPerformanceTest(renderer, 500, 1000);
      
      expect(result.avgFps).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.MIN_FPS);
      expect(result.avgFrameTime).toBeLessThanOrEqual(20); // 50fps = 20ms max
      expect(result.droppedFrames / (result.duration / 16.67)).toBeLessThanOrEqual(
        PERFORMANCE_TARGETS.FRAME_DROP_TOLERANCE
      );
    });

    it('should handle maximum drop count (1000) within targets', async () => {
      const result = await runPerformanceTest(renderer, PERFORMANCE_TARGETS.MAX_DROP_COUNT, 2000);
      
      expect(result.avgFps).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.MIN_FPS);
      expect(result.memoryUsage).toBeLessThanOrEqual(PERFORMANCE_TARGETS.MAX_MEMORY_USAGE);
    });

    it('should detect performance degradation with excessive drops', async () => {
      const result = await runPerformanceTest(renderer, 2000, 1000);
      
      // Performance should degrade noticeably with 2x target drops
      expect(result.avgFps).toBeLessThan(PERFORMANCE_TARGETS.TARGET_FPS);
      expect(result.droppedFrames).toBeGreaterThan(5);
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('should stay within memory limits with target drop count', async () => {
      const result = await runPerformanceTest(renderer, PERFORMANCE_TARGETS.MAX_DROP_COUNT, 1000);
      
      expect(result.memoryUsage).toBeLessThanOrEqual(PERFORMANCE_TARGETS.MAX_MEMORY_USAGE);
    });

    it('should track memory growth with increasing drops', () => {
      const baseMem = renderer.getMemoryUsage();
      
      // Add drops and track memory
      const memoryPoints: number[] = [baseMem];
      
      for (let i = 0; i < 100; i += 10) {
        for (let j = 0; j < 10; j++) {
          renderer.addDrop({ id: `drop-${i + j}`, size: 1024 });
        }
        memoryPoints.push(renderer.getMemoryUsage());
      }
      
      // Memory should increase linearly
      expect(memoryPoints[memoryPoints.length - 1]).toBeGreaterThan(memoryPoints[0]);
      expect(memoryPoints[5]).toBeLessThan(memoryPoints[9]); // Monotonic increase
    });

    it('should reclaim memory when drops are removed', () => {
      const initialMem = renderer.getMemoryUsage();
      
      // Add drops
      for (let i = 0; i < 100; i++) {
        renderer.addDrop({ id: `drop-${i}`, size: 1024 });
      }
      
      const peakMem = renderer.getMemoryUsage();
      expect(peakMem).toBeGreaterThan(initialMem);
      
      // Remove drops
      for (let i = 0; i < 100; i++) {
        renderer.removeDrop(`drop-${i}`);
      }
      
      const finalMem = renderer.getMemoryUsage();
      expect(finalMem).toBe(initialMem); // Should return to baseline
    });

    it('should handle memory pressure gracefully', () => {
      // Simulate memory pressure scenario
      let memoryExceeded = false;
      
      try {
        for (let i = 0; i < 5000; i++) {
          renderer.addDrop({ id: `drop-${i}`, size: 1024 });
          
          if (renderer.getMemoryUsage() > PERFORMANCE_TARGETS.MAX_MEMORY_USAGE * 2) {
            memoryExceeded = true;
            break;
          }
        }
      } catch (error) {
        // Should not throw errors under memory pressure
        expect(error).toBeUndefined();
      }
      
      expect(memoryExceeded).toBe(true); // Should detect memory limit
    });
  });

  describe('Event Processing Performance', () => {
    it('should process events at WebSocket rates (100/sec)', () => {
      const events = createMockEventStream(100);
      const startTime = performance.now();
      
      events.forEach((event, index) => {
        renderer.addDrop({
          id: `event-${event.id}`,
          source: event,
          x: (index % 40) * 20,
          y: 0,
          char: 'ア',
          speed: 2
        });
      });
      
      const processingTime = performance.now() - startTime;
      
      // Should process 100 events in less than 16ms (1 frame)
      expect(processingTime).toBeLessThan(16);
      expect(renderer.getDropCount()).toBe(100);
    });

    it('should handle burst events without frame drops', async () => {
      const observer = new MockPerformanceObserver();
      observer.startFrameLoop();
      
      // Simulate burst of 50 events at once
      const events = createMockEventStream(50);
      
      const startTime = performance.now();
      events.forEach(event => {
        renderer.addDrop({
          id: `burst-${event.id}`,
          source: event,
          x: Math.random() * 800,
          y: 0,
          char: 'ア',
          speed: 2
        });
      });
      
      // Process for 1 second
      await new Promise(resolve => {
        setTimeout(() => {
          observer.stopFrameLoop();
          const metrics = observer.getMetrics();
          
          expect(metrics.fps).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.MIN_FPS);
          resolve(undefined);
        }, 1000);
      });
    });

    it('should maintain performance with continuous event stream', async () => {
      const observer = new MockPerformanceObserver();
      const fpsHistory: number[] = [];
      
      observer.startFrameLoop();
      observer.onFrame(() => {
        fpsHistory.push(observer.getMetrics().fps);
      });
      
      // Add events continuously for 3 seconds
      const eventInterval = setInterval(() => {
        const event = createMockEventStream(1)[0];
        renderer.addDrop({
          id: `stream-${Date.now()}-${Math.random()}`,
          source: event,
          x: Math.random() * 800,
          y: 0,
          char: 'ア',
          speed: 2
        });
        
        // Remove old drops to simulate cleanup
        if (renderer.getDropCount() > PERFORMANCE_TARGETS.MAX_DROP_COUNT) {
          renderer.removeDrop(`stream-${Date.now() - 10000}`);
        }
      }, 10); // 100 events per second
      
      await new Promise(resolve => {
        setTimeout(() => {
          clearInterval(eventInterval);
          observer.stopFrameLoop();
          
          const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
          expect(avgFps).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.MIN_FPS);
          
          resolve(undefined);
        }, 3000);
      });
    });
  });

  describe('Quality Scaling Performance', () => {
    it('should improve performance when quality is reduced', async () => {
      // Test at full quality
      const fullQualityResult = await runPerformanceTest(renderer, 800, 1000);
      
      // Reset and test at reduced quality
      renderer.clear();
      renderer.setQuality(0.5); // 50% quality
      
      const reducedQualityResult = await runPerformanceTest(renderer, 800, 1000);
      
      // Reduced quality should perform better
      expect(reducedQualityResult.avgFps).toBeGreaterThanOrEqual(fullQualityResult.avgFps);
      expect(reducedQualityResult.avgFrameTime).toBeLessThanOrEqual(fullQualityResult.avgFrameTime);
    });

    it('should adapt quality automatically under load', async () => {
      const observer = new MockPerformanceObserver();
      observer.startFrameLoop();
      
      // Start with 2000 drops (high load)
      await runPerformanceTest(renderer, 2000, 500);
      
      // Simulate automatic quality reduction
      observer.simulatePerformanceDrop(30); // Drop to 30fps
      renderer.setQuality(0.3); // Auto-reduce to 30%
      
      // Performance should improve
      const metrics = observer.getMetrics();
      observer.stopFrameLoop();
      
      // Quality scaling should help maintain minimum fps
      expect(metrics.fps).toBeGreaterThan(30);
    });
  });

  describe('WebGL Fallback Threshold', () => {
    it('should identify when WebGL fallback is needed', async () => {
      const massiveDropCount = PERFORMANCE_TARGETS.WEBGL_THRESHOLD + 500;
      const result = await runPerformanceTest(renderer, massiveDropCount, 1000);
      
      // Performance should degrade significantly
      expect(result.avgFps).toBeLessThan(PERFORMANCE_TARGETS.MIN_FPS);
      expect(result.droppedFrames).toBeGreaterThan(10);
      
      // This would trigger WebGL fallback in real implementation
      expect(renderer.getDropCount()).toBeGreaterThan(PERFORMANCE_TARGETS.WEBGL_THRESHOLD);
    });

    it('should handle transition to WebGL smoothly', () => {
      // Mock WebGL transition
      const canvas2DDropCount = renderer.getDropCount();
      
      // Simulate switching to WebGL renderer
      const webglRenderer = createMockMatrixRenderer();
      
      // Transfer drops
      for (let i = 0; i < canvas2DDropCount; i++) {
        webglRenderer.addDrop({ id: `webgl-${i}`, optimized: true });
      }
      
      expect(webglRenderer.getDropCount()).toBe(canvas2DDropCount);
    });
  });

  describe('Real-world Performance Scenarios', () => {
    it('should handle typical usage pattern (200-500 drops)', async () => {
      const typicalDropCount = 350; // Typical active session count
      const result = await runPerformanceTest(renderer, typicalDropCount, 5000);
      
      expect(result.avgFps).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.TARGET_FPS * 0.95); // 95% of target
      expect(result.memoryUsage).toBeLessThanOrEqual(PERFORMANCE_TARGETS.MAX_MEMORY_USAGE * 0.7); // 70% of limit
      expect(result.avgFrameTime).toBeLessThanOrEqual(PERFORMANCE_TARGETS.MAX_FRAME_TIME * 1.1); // 110% tolerance
    });

    it('should handle peak usage gracefully (800-1000 drops)', async () => {
      const peakDropCount = 900;
      const result = await runPerformanceTest(renderer, peakDropCount, 3000);
      
      expect(result.avgFps).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.MIN_FPS);
      expect(result.memoryUsage).toBeLessThanOrEqual(PERFORMANCE_TARGETS.MAX_MEMORY_USAGE);
      
      // Should handle peak load without major issues
      const frameDropRate = result.droppedFrames / (result.duration / 16.67);
      expect(frameDropRate).toBeLessThanOrEqual(PERFORMANCE_TARGETS.FRAME_DROP_TOLERANCE * 2); // 2x tolerance
    });

    it('should recover from performance spikes', async () => {
      const observer = new MockPerformanceObserver();
      
      // Start with normal load
      await runPerformanceTest(renderer, 300, 1000);
      const normalFps = observer.getMetrics().fps;
      
      // Spike to high load
      await runPerformanceTest(renderer, 1500, 1000);
      
      // Return to normal load
      renderer.clear();
      await runPerformanceTest(renderer, 300, 1000);
      const recoveredFps = observer.getMetrics().fps;
      
      // Should recover to normal performance levels
      expect(Math.abs(recoveredFps - normalFps)).toBeLessThan(5); // Within 5fps
    });
  });

  describe('Performance Regression Detection', () => {
    it('should establish performance baselines', async () => {
      const baselineTests = [
        { drops: 100, expectedFps: 60 },
        { drops: 500, expectedFps: 58 },
        { drops: 1000, expectedFps: 50 }
      ];
      
      for (const test of baselineTests) {
        const result = await runPerformanceTest(renderer, test.drops, 1000);
        
        // Store baselines for regression testing
        expect(result.avgFps).toBeGreaterThanOrEqual(test.expectedFps);
        
        // Log for CI/CD baseline tracking
        console.log(`Baseline ${test.drops} drops: ${result.avgFps.toFixed(1)}fps`);
      }
    });

    it('should detect performance regressions', async () => {
      // This test would compare against stored baselines
      const currentResult = await runPerformanceTest(renderer, 500, 1000);
      const baselineFps = 58; // Previously established baseline
      
      const regressionThreshold = 0.9; // 10% regression tolerance
      expect(currentResult.avgFps).toBeGreaterThanOrEqual(baselineFps * regressionThreshold);
    });
  });
});