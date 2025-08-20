/**
 * Timeline Performance Utilities
 * 
 * Performance monitoring, optimization, and debugging utilities for the timeline renderer.
 * Provides frame rate monitoring, memory tracking, and render optimization strategies.
 */

import type { TimelineData, TimelineDebugInfo, CanvasRenderState } from '../types/timeline';

// ============================================================================
// Performance Monitoring
// ============================================================================

export class TimelinePerformanceMonitor {
  private frameCount = 0;
  private lastFrameTime = 0;
  private frameRates: number[] = [];
  private renderTimes: number[] = [];
  private memoryUsage: number[] = [];
  private maxSamples = 60; // Keep last 60 samples (1 second at 60fps)

  /**
   * Start monitoring a render operation
   */
  startRender(): () => number {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      this.recordRenderTime(renderTime);
      this.updateFrameRate();
      this.trackMemoryUsage();
      
      return renderTime;
    };
  }

  private recordRenderTime(time: number): void {
    this.renderTimes.push(time);
    if (this.renderTimes.length > this.maxSamples) {
      this.renderTimes.shift();
    }
  }

  private updateFrameRate(): void {
    const now = performance.now();
    if (this.lastFrameTime > 0) {
      const frameTime = now - this.lastFrameTime;
      const fps = 1000 / frameTime;
      this.frameRates.push(fps);
      
      if (this.frameRates.length > this.maxSamples) {
        this.frameRates.shift();
      }
    }
    this.lastFrameTime = now;
    this.frameCount++;
  }

  private trackMemoryUsage(): void {
    // @ts-ignore - performance.memory is not in types but exists in Chrome
    if (performance.memory) {
      // @ts-ignore
      const memoryMB = performance.memory.usedJSHeapSize / 1024 / 1024;
      this.memoryUsage.push(memoryMB);
      
      if (this.memoryUsage.length > this.maxSamples) {
        this.memoryUsage.shift();
      }
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): {
    averageFPS: number;
    averageRenderTime: number;
    currentMemoryMB: number;
    frameCount: number;
    isPerformant: boolean;
  } {
    const avgFPS = this.frameRates.length > 0 
      ? this.frameRates.reduce((a, b) => a + b, 0) / this.frameRates.length 
      : 0;
      
    const avgRenderTime = this.renderTimes.length > 0
      ? this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length
      : 0;
      
    const currentMemory = this.memoryUsage.length > 0 
      ? this.memoryUsage[this.memoryUsage.length - 1] 
      : 0;

    return {
      averageFPS: avgFPS,
      averageRenderTime: avgRenderTime,
      currentMemoryMB: currentMemory,
      frameCount: this.frameCount,
      isPerformant: avgFPS >= 30 && avgRenderTime < 16.67 // Target 60fps (16.67ms per frame)
    };
  }

  /**
   * Reset all performance counters
   */
  reset(): void {
    this.frameCount = 0;
    this.lastFrameTime = 0;
    this.frameRates = [];
    this.renderTimes = [];
    this.memoryUsage = [];
  }

  /**
   * Generate performance report
   */
  getReport(): TimelineDebugInfo {
    const metrics = this.getMetrics();
    
    return {
      renderTime: metrics.averageRenderTime,
      frameRate: metrics.averageFPS,
      memoryUsage: metrics.currentMemoryMB,
      elementCount: {
        agents: 0, // Will be updated by caller
        messages: 0,
        prompts: 0,
        batches: 0
      }
    };
  }
}

// ============================================================================
// Viewport Culling & Level-of-Detail
// ============================================================================

export class ViewportOptimizer {
  /**
   * Cull elements outside the visible viewport
   */
  cullElements<T extends { bounds?: DOMRect }>(
    elements: T[], 
    viewportBounds: DOMRect
  ): T[] {
    return elements.filter(element => {
      if (!element.bounds) return true;
      
      return !(
        element.bounds.right < viewportBounds.left ||
        element.bounds.left > viewportBounds.right ||
        element.bounds.bottom < viewportBounds.top ||
        element.bounds.top > viewportBounds.bottom
      );
    });
  }

  /**
   * Apply level-of-detail based on zoom level
   */
  applyLevelOfDetail(data: TimelineData, zoomLevel: number): {
    showMessages: boolean;
    showLabels: boolean;
    showDetails: boolean;
    simplifyPaths: boolean;
  } {
    return {
      showMessages: zoomLevel >= 1.5,
      showLabels: zoomLevel >= 0.8,
      showDetails: zoomLevel >= 2.0,
      simplifyPaths: zoomLevel < 0.5
    };
  }

  /**
   * Calculate optimal render strategy based on element count
   */
  getRenderStrategy(elementCount: {
    agents: number;
    messages: number;
    prompts: number;
    batches: number;
  }): {
    useVirtualization: boolean;
    useCanvasForMessages: boolean;
    useBatching: boolean;
    maxElementsPerFrame: number;
  } {
    const totalElements = Object.values(elementCount).reduce((a, b) => a + b, 0);
    
    return {
      useVirtualization: totalElements > 100,
      useCanvasForMessages: elementCount.messages > 1000,
      useBatching: totalElements > 50,
      maxElementsPerFrame: Math.min(20, Math.max(5, Math.floor(1000 / totalElements)))
    };
  }
}

// ============================================================================
// Canvas Optimization
// ============================================================================

export class CanvasLayerManager {
  private layers = new Map<string, CanvasRenderingContext2D>();
  private isDirty = new Set<string>();

  /**
   * Create a new canvas layer
   */
  createLayer(
    name: string, 
    width: number, 
    height: number, 
    parent: HTMLElement
  ): CanvasRenderingContext2D {
    const canvas = document.createElement('canvas');
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    
    const ctx = canvas.getContext('2d')!;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    parent.appendChild(canvas);
    this.layers.set(name, ctx);
    this.markDirty(name);
    
    return ctx;
  }

  /**
   * Get a canvas layer context
   */
  getLayer(name: string): CanvasRenderingContext2D | undefined {
    return this.layers.get(name);
  }

  /**
   * Mark a layer as needing redraw
   */
  markDirty(layerName: string): void {
    this.isDirty.add(layerName);
  }

  /**
   * Check if layer needs redraw
   */
  isDirtyLayer(layerName: string): boolean {
    return this.isDirty.has(layerName);
  }

  /**
   * Clear dirty flag after rendering
   */
  markClean(layerName: string): void {
    this.isDirty.delete(layerName);
  }

  /**
   * Clear all layers
   */
  clearAll(): void {
    for (const ctx of this.layers.values()) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    this.isDirty.clear();
  }

  /**
   * Destroy all layers and clean up
   */
  destroy(): void {
    for (const ctx of this.layers.values()) {
      const canvas = ctx.canvas;
      canvas.parentElement?.removeChild(canvas);
    }
    this.layers.clear();
    this.isDirty.clear();
  }
}

// ============================================================================
// Animation Frame Management
// ============================================================================

export class AnimationFrameScheduler {
  private callbacks = new Map<string, FrameRequestCallback>();
  private activeFrames = new Set<number>();
  private frameRate = 60;
  private lastFrameTime = 0;

  /**
   * Schedule a callback for the next animation frame
   */
  schedule(id: string, callback: FrameRequestCallback): void {
    // Cancel existing callback if it exists
    this.cancel(id);
    
    const wrappedCallback = (time: number) => {
      // Throttle to target frame rate
      if (time - this.lastFrameTime >= 1000 / this.frameRate) {
        callback(time);
        this.lastFrameTime = time;
      }
      
      this.activeFrames.delete(this.activeFrames.values().next().value || 0);
      this.callbacks.delete(id);
    };
    
    this.callbacks.set(id, wrappedCallback);
    const frameId = requestAnimationFrame(wrappedCallback);
    this.activeFrames.add(frameId);
  }

  /**
   * Cancel a scheduled callback
   */
  cancel(id: string): void {
    const callback = this.callbacks.get(id);
    if (callback) {
      // Find and cancel the frame request
      for (const frameId of this.activeFrames) {
        cancelAnimationFrame(frameId);
      }
      
      this.callbacks.delete(id);
    }
  }

  /**
   * Cancel all scheduled callbacks
   */
  cancelAll(): void {
    for (const frameId of this.activeFrames) {
      cancelAnimationFrame(frameId);
    }
    
    this.callbacks.clear();
    this.activeFrames.clear();
  }

  /**
   * Set target frame rate
   */
  setFrameRate(fps: number): void {
    this.frameRate = Math.max(1, Math.min(60, fps));
  }
}

// ============================================================================
// Memory Management
// ============================================================================

export class TimelineMemoryManager {
  private objectPools = new Map<string, any[]>();
  private maxPoolSize = 100;

  /**
   * Get an object from the pool or create a new one
   */
  acquire<T>(type: string, factory: () => T): T {
    const pool = this.objectPools.get(type) || [];
    
    if (pool.length > 0) {
      return pool.pop()!;
    }
    
    return factory();
  }

  /**
   * Return an object to the pool for reuse
   */
  release<T>(type: string, object: T): void {
    const pool = this.objectPools.get(type) || [];
    
    if (pool.length < this.maxPoolSize) {
      // Reset object properties if it has a reset method
      if (object && typeof (object as any).reset === 'function') {
        (object as any).reset();
      }
      
      pool.push(object);
      this.objectPools.set(type, pool);
    }
  }

  /**
   * Clear all object pools
   */
  clearPools(): void {
    this.objectPools.clear();
  }

  /**
   * Get memory usage statistics
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const [type, pool] of this.objectPools.entries()) {
      stats[type] = pool.length;
    }
    
    return stats;
  }
}

// ============================================================================
// Debounce and Throttle Utilities
// ============================================================================

/**
 * Debounce function calls to prevent excessive execution
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: number | undefined;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = undefined;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait) as any;
    
    if (callNow) func(...args);
  };
}

/**
 * Throttle function calls to limit execution frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Batch multiple operations together
 */
export class BatchProcessor<T> {
  private batch: T[] = [];
  private batchSize: number;
  private timeout: number | undefined;
  private processor: (items: T[]) => void;

  constructor(processor: (items: T[]) => void, batchSize = 10, timeoutMs = 100) {
    this.processor = processor;
    this.batchSize = batchSize;
  }

  /**
   * Add an item to the batch
   */
  add(item: T): void {
    this.batch.push(item);
    
    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else {
      // Set timeout to process remaining items
      if (this.timeout) clearTimeout(this.timeout);
      this.timeout = setTimeout(() => this.flush(), 100) as any;
    }
  }

  /**
   * Process all items in the batch immediately
   */
  flush(): void {
    if (this.batch.length > 0) {
      const items = [...this.batch];
      this.batch = [];
      
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = undefined;
      }
      
      this.processor(items);
    }
  }

  /**
   * Get current batch size
   */
  size(): number {
    return this.batch.length;
  }
}

// ============================================================================
// Export Performance Suite
// ============================================================================

export const TimelinePerformance = {
  Monitor: TimelinePerformanceMonitor,
  ViewportOptimizer: ViewportOptimizer,
  CanvasManager: CanvasLayerManager,
  FrameScheduler: AnimationFrameScheduler,
  MemoryManager: TimelineMemoryManager,
  BatchProcessor,
  debounce,
  throttle
};