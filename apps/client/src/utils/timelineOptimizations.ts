/**
 * Timeline Performance Optimizations
 * 
 * Advanced performance utilities specifically designed for the agent timeline visualization.
 * Provides viewport culling, virtual scrolling, debouncing, and GPU acceleration strategies
 * to achieve 60 FPS rendering with 500+ agents.
 */

import type { AgentPath, TimelineMessage, ViewportState, TimelineConfig, Point2D } from '../types/timeline';

// ============================================================================
// Viewport Culling & Virtual Scrolling
// ============================================================================

export interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface VirtualizedResult<T> {
  visibleItems: T[];
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  offsetY: number;
}

export class ViewportCuller {
  private lastViewport: ViewportBounds | null = null;
  private cachedResults = new Map<string, any>();

  /**
   * Cull agents outside the visible viewport with overscan buffer
   */
  cullAgents(
    agents: AgentPath[], 
    viewport: ViewportState, 
    config: TimelineConfig,
    overscanBuffer: number = 100
  ): AgentPath[] {
    const bounds = this.calculateViewportBounds(viewport, config, overscanBuffer);
    
    return agents.filter(agent => {
      const agentBounds = this.calculateAgentBounds(agent, config);
      return this.boundsIntersect(agentBounds, bounds);
    });
  }

  /**
   * Cull messages outside viewport with time-based filtering
   */
  cullMessages(
    messages: TimelineMessage[], 
    viewport: ViewportState, 
    config: TimelineConfig,
    timeBuffer: number = 30000 // 30 seconds buffer
  ): TimelineMessage[] {
    const { timeRange } = viewport;
    const startTime = timeRange.start - timeBuffer;
    const endTime = timeRange.end + timeBuffer;

    const bounds = this.calculateViewportBounds(viewport, config, 50);
    
    return messages.filter(message => {
      // Time-based culling first (faster)
      if (message.timestamp < startTime || message.timestamp > endTime) {
        return false;
      }
      
      // Spatial culling
      const messageBounds = this.calculateMessageBounds(message, config);
      return this.boundsIntersect(messageBounds, bounds);
    });
  }

  /**
   * Virtual scrolling for agent list with fixed row height
   */
  virtualizeAgents(
    agents: AgentPath[],
    scrollTop: number,
    viewportHeight: number,
    itemHeight: number = 40,
    overscan: number = 5
  ): VirtualizedResult<AgentPath> {
    const totalItems = agents.length;
    const totalHeight = totalItems * itemHeight;
    
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      totalItems - 1,
      Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan
    );
    
    const visibleItems = agents.slice(startIndex, endIndex + 1);
    const offsetY = startIndex * itemHeight;
    
    return {
      visibleItems,
      startIndex,
      endIndex,
      totalHeight,
      offsetY
    };
  }

  private calculateViewportBounds(
    viewport: ViewportState, 
    config: TimelineConfig, 
    buffer: number
  ): ViewportBounds {
    const { panX, panY, zoom, width, height } = viewport;
    
    return {
      left: (-panX / zoom) - buffer,
      top: (-panY / zoom) - buffer,
      right: (width - panX) / zoom + buffer,
      bottom: (height - panY) / zoom + buffer,
      width: width / zoom + 2 * buffer,
      height: height / zoom + 2 * buffer
    };
  }

  private calculateAgentBounds(agent: AgentPath, config: TimelineConfig): ViewportBounds {
    const { margins } = config;
    const startX = margins.left;
    const endX = config.width - margins.right;
    const laneY = config.orchestratorY - (agent.laneIndex + 1) * config.agentLaneHeight;
    
    return {
      left: startX,
      top: laneY - 20,
      right: endX,
      bottom: laneY + 20,
      width: endX - startX,
      height: 40
    };
  }

  private calculateMessageBounds(message: TimelineMessage, config: TimelineConfig): ViewportBounds {
    const { x, y } = message.position;
    const size = 6; // Message dot radius + buffer
    
    return {
      left: x - size,
      top: y - size,
      right: x + size,
      bottom: y + size,
      width: size * 2,
      height: size * 2
    };
  }

  private boundsIntersect(a: ViewportBounds, b: ViewportBounds): boolean {
    return !(
      a.right < b.left ||
      a.left > b.right ||
      a.bottom < b.top ||
      a.top > b.bottom
    );
  }
}

// ============================================================================
// Level-of-Detail Rendering
// ============================================================================

export interface LevelOfDetail {
  showLabels: boolean;
  showMessages: boolean;
  showDetails: boolean;
  simplifyPaths: boolean;
  maxAgents: number;
  maxMessages: number;
  pathSimplificationTolerance: number;
}

export class LevelOfDetailManager {
  /**
   * Calculate appropriate level of detail based on zoom and element count
   */
  calculateLOD(
    zoom: number, 
    agentCount: number, 
    messageCount: number,
    performanceMode: 'quality' | 'performance' | 'auto' = 'auto'
  ): LevelOfDetail {
    const basePerformance = this.calculateBasePerformance(agentCount, messageCount);
    
    // Adjust thresholds based on performance mode
    const zoomThresholds = this.getZoomThresholds(performanceMode);
    const elementThresholds = this.getElementThresholds(performanceMode);
    
    return {
      showLabels: zoom >= zoomThresholds.labels && agentCount <= elementThresholds.maxLabeled,
      showMessages: zoom >= zoomThresholds.messages && messageCount <= elementThresholds.maxMessages,
      showDetails: zoom >= zoomThresholds.details && agentCount <= elementThresholds.maxDetailed,
      simplifyPaths: zoom < zoomThresholds.pathSimplification || agentCount > elementThresholds.maxComplexPaths,
      maxAgents: Math.min(elementThresholds.maxAgents, Math.floor(1000 / Math.max(1, zoom))),
      maxMessages: Math.min(elementThresholds.maxMessages, Math.floor(2000 / Math.max(1, zoom))),
      pathSimplificationTolerance: Math.max(1, 5 / zoom) // More aggressive simplification at lower zoom
    };
  }

  private calculateBasePerformance(agentCount: number, messageCount: number): number {
    // Simple heuristic: performance degrades with element count
    const agentWeight = agentCount * 2; // Agents are more expensive to render
    const messageWeight = messageCount * 1;
    const totalWeight = agentWeight + messageWeight;
    
    // Return performance score from 0 (poor) to 1 (excellent)
    return Math.max(0, Math.min(1, 1 - (totalWeight / 5000)));
  }

  private getZoomThresholds(mode: 'quality' | 'performance' | 'auto') {
    const base = {
      labels: 0.8,
      messages: 1.2,
      details: 2.0,
      pathSimplification: 0.5
    };

    switch (mode) {
      case 'quality':
        return {
          labels: base.labels * 0.7,
          messages: base.messages * 0.8,
          details: base.details * 0.8,
          pathSimplification: base.pathSimplification * 1.2
        };
      case 'performance':
        return {
          labels: base.labels * 1.5,
          messages: base.messages * 1.8,
          details: base.details * 2.0,
          pathSimplification: base.pathSimplification * 0.8
        };
      default:
        return base;
    }
  }

  private getElementThresholds(mode: 'quality' | 'performance' | 'auto') {
    const base = {
      maxAgents: 500,
      maxMessages: 1000,
      maxLabeled: 100,
      maxDetailed: 50,
      maxComplexPaths: 200
    };

    switch (mode) {
      case 'quality':
        return {
          maxAgents: base.maxAgents * 1.2,
          maxMessages: base.maxMessages * 1.2,
          maxLabeled: base.maxLabeled * 1.5,
          maxDetailed: base.maxDetailed * 1.5,
          maxComplexPaths: base.maxComplexPaths * 1.2
        };
      case 'performance':
        return {
          maxAgents: base.maxAgents * 0.6,
          maxMessages: base.maxMessages * 0.6,
          maxLabeled: base.maxLabeled * 0.5,
          maxDetailed: base.maxDetailed * 0.3,
          maxComplexPaths: base.maxComplexPaths * 0.5
        };
      default:
        return base;
    }
  }
}

// ============================================================================
// Request Animation Frame Scheduling
// ============================================================================

export class RenderScheduler {
  private pendingOperations = new Map<string, () => void>();
  private isScheduled = false;
  private lastFrameTime = 0;
  private frameRate = 60;
  private frameTimeMS = 1000 / 60;

  /**
   * Schedule render operation to run on next available frame
   */
  schedule(operationId: string, operation: () => void, priority: 'high' | 'normal' | 'low' = 'normal'): void {
    // Cancel existing operation with same ID
    if (this.pendingOperations.has(operationId)) {
      this.pendingOperations.delete(operationId);
    }

    // Store operation with priority prefix for sorting
    const priorityPrefix = priority === 'high' ? '0_' : priority === 'normal' ? '1_' : '2_';
    this.pendingOperations.set(priorityPrefix + operationId, operation);

    if (!this.isScheduled) {
      this.scheduleFrame();
    }
  }

  /**
   * Cancel scheduled operation
   */
  cancel(operationId: string): void {
    // Check all priority prefixes
    for (const prefix of ['0_', '1_', '2_']) {
      this.pendingOperations.delete(prefix + operationId);
    }
  }

  /**
   * Set target frame rate (affects throttling)
   */
  setFrameRate(fps: number): void {
    this.frameRate = Math.max(1, Math.min(60, fps));
    this.frameTimeMS = 1000 / this.frameRate;
  }

  private scheduleFrame(): void {
    this.isScheduled = true;
    requestAnimationFrame((timestamp) => this.executeFrame(timestamp));
  }

  private executeFrame(timestamp: number): void {
    this.isScheduled = false;

    // Throttle to target frame rate
    if (timestamp - this.lastFrameTime < this.frameTimeMS) {
      if (this.pendingOperations.size > 0) {
        this.scheduleFrame();
      }
      return;
    }

    this.lastFrameTime = timestamp;

    // Execute operations in priority order
    const operations = Array.from(this.pendingOperations.entries())
      .sort(([a], [b]) => a.localeCompare(b));

    // Time budget: max 16ms per frame for 60 FPS
    const startTime = performance.now();
    const timeBudget = this.frameTimeMS;

    for (const [id, operation] of operations) {
      try {
        operation();
      } catch (error) {
        console.error(`Render operation ${id} failed:`, error);
      }

      this.pendingOperations.delete(id);

      // Check time budget
      if (performance.now() - startTime > timeBudget) {
        break;
      }
    }

    // Schedule next frame if operations remain
    if (this.pendingOperations.size > 0) {
      this.scheduleFrame();
    }
  }
}

// ============================================================================
// GPU-Accelerated Transforms
// ============================================================================

export interface Transform3D {
  translateX: number;
  translateY: number;
  translateZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
}

export class GPUTransformManager {
  private transformCache = new Map<string, string>();

  /**
   * Generate GPU-accelerated CSS transform string
   */
  createTransform(transform: Partial<Transform3D>): string {
    const {
      translateX = 0,
      translateY = 0,
      translateZ = 0,
      scaleX = 1,
      scaleY = 1,
      scaleZ = 1,
      rotateX = 0,
      rotateY = 0,
      rotateZ = 0
    } = transform;

    const cacheKey = `${translateX},${translateY},${translateZ},${scaleX},${scaleY},${scaleZ},${rotateX},${rotateY},${rotateZ}`;
    
    if (this.transformCache.has(cacheKey)) {
      return this.transformCache.get(cacheKey)!;
    }

    const transformString = `translate3d(${translateX}px, ${translateY}px, ${translateZ}px) ` +
      `scale3d(${scaleX}, ${scaleY}, ${scaleZ}) ` +
      `rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`;

    this.transformCache.set(cacheKey, transformString);
    return transformString;
  }

  /**
   * Apply GPU-accelerated styles to element
   */
  applyGPUStyles(element: HTMLElement | SVGElement, transform?: Partial<Transform3D>): void {
    const style = element.style;
    
    // Enable hardware acceleration
    style.willChange = 'transform';
    style.transform = transform ? this.createTransform(transform) : 'translateZ(0)';
    
    // Optimize for GPU rendering
    style.backfaceVisibility = 'hidden';
    style.perspective = '1000px';
  }

  /**
   * Batch apply transforms to multiple elements
   */
  batchApplyTransforms(elements: Array<{ element: HTMLElement | SVGElement; transform: Partial<Transform3D> }>): void {
    // Use single style update to trigger one reflow
    elements.forEach(({ element, transform }) => {
      element.style.transform = this.createTransform(transform);
    });
  }

  /**
   * Clear transform cache to prevent memory leaks
   */
  clearCache(): void {
    this.transformCache.clear();
  }
}

// ============================================================================
// Debounce and Throttle for Updates
// ============================================================================

/**
 * Smart debounce that adapts delay based on system performance
 */
export function adaptiveDebounce<T extends (...args: any[]) => void>(
  func: T,
  baseDelay: number = 250,
  performanceCallback?: () => number // Returns performance score 0-1
): (...args: Parameters<T>) => void {
  let timeout: number | undefined;
  let lastCallTime = 0;
  
  return function(this: any, ...args: Parameters<T>) {
    const now = performance.now();
    
    // Adapt delay based on performance
    let delay = baseDelay;
    if (performanceCallback) {
      const perfScore = performanceCallback();
      delay = baseDelay * (2 - perfScore); // Slower systems get longer delays
    }
    
    // Adaptive delay based on call frequency
    const timeSinceLastCall = now - lastCallTime;
    if (timeSinceLastCall < 100) {
      delay *= 1.5; // Increase delay for rapid calls
    }
    
    lastCallTime = now;
    
    clearTimeout(timeout);
    timeout = window.setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

/**
 * Request animation frame throttle for smooth animations
 */
export function rafThrottle<T extends (...args: any[]) => void>(func: T): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let latestArgs: Parameters<T>;
  
  return function(this: any, ...args: Parameters<T>) {
    latestArgs = args;
    
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(this, latestArgs);
        rafId = null;
      });
    }
  };
}

// ============================================================================
// Memory Pool for Frequent Objects
// ============================================================================

export class MemoryPool<T> {
  private available: T[] = [];
  private factory: () => T;
  private reset: (item: T) => void;
  private maxSize: number;

  constructor(
    factory: () => T, 
    reset: (item: T) => void = () => {},
    maxSize: number = 100
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
  }

  /**
   * Get an object from the pool or create new one
   */
  acquire(): T {
    if (this.available.length > 0) {
      return this.available.pop()!;
    }
    return this.factory();
  }

  /**
   * Return object to pool for reuse
   */
  release(item: T): void {
    if (this.available.length < this.maxSize) {
      this.reset(item);
      this.available.push(item);
    }
  }

  /**
   * Pre-warm the pool with objects
   */
  prewarm(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.available.length < this.maxSize) {
        this.available.push(this.factory());
      }
    }
  }

  /**
   * Clear the pool
   */
  clear(): void {
    this.available = [];
  }

  /**
   * Get pool statistics
   */
  getStats(): { available: number; maxSize: number } {
    return {
      available: this.available.length,
      maxSize: this.maxSize
    };
  }
}

// ============================================================================
// Performance Monitoring Integration
// ============================================================================

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryMB: number;
  renderCount: number;
  cullRatio: number; // Percentage of elements culled
  elementCount: {
    agents: number;
    messages: number;
    visible: number;
  };
}

export class TimelinePerformanceTracker {
  private metrics: PerformanceMetrics = {
    fps: 60,
    frameTime: 16.67,
    memoryMB: 0,
    renderCount: 0,
    cullRatio: 0,
    elementCount: { agents: 0, messages: 0, visible: 0 }
  };

  private frameHistory: number[] = [];
  private maxHistory = 60;

  /**
   * Update performance metrics
   */
  updateMetrics(
    frameTime: number, 
    elementCounts: { total: number; visible: number; agents: number; messages: number }
  ): void {
    // Update frame time and FPS
    this.frameHistory.push(frameTime);
    if (this.frameHistory.length > this.maxHistory) {
      this.frameHistory.shift();
    }

    const avgFrameTime = this.frameHistory.reduce((a, b) => a + b, 0) / this.frameHistory.length;
    this.metrics.frameTime = avgFrameTime;
    this.metrics.fps = Math.min(60, 1000 / avgFrameTime);

    // Update element counts and cull ratio
    this.metrics.cullRatio = elementCounts.total > 0 
      ? (1 - elementCounts.visible / elementCounts.total) * 100 
      : 0;
    
    this.metrics.elementCount = {
      agents: elementCounts.agents,
      messages: elementCounts.messages,
      visible: elementCounts.visible
    };

    this.metrics.renderCount++;

    // Update memory usage (if available)
    // @ts-ignore - performance.memory exists in Chrome
    if (performance.memory) {
      // @ts-ignore
      this.metrics.memoryMB = performance.memory.usedJSHeapSize / 1024 / 1024;
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if performance is acceptable
   */
  isPerformant(): boolean {
    return this.metrics.fps >= 30 && this.metrics.frameTime <= 33.33; // 30 FPS minimum
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.fps < 30) {
      recommendations.push("Low FPS detected. Consider enabling performance mode or reducing element count.");
    }

    if (this.metrics.frameTime > 50) {
      recommendations.push("High frame time detected. Enable more aggressive viewport culling.");
    }

    if (this.metrics.elementCount.visible > 1000) {
      recommendations.push("High element count. Consider increasing virtualization thresholds.");
    }

    if (this.metrics.cullRatio < 20) {
      recommendations.push("Low cull ratio. Viewport culling may need adjustment.");
    }

    if (this.metrics.memoryMB > 100) {
      recommendations.push("High memory usage detected. Clear object pools and caches.");
    }

    return recommendations;
  }
}

// ============================================================================
// Export Main Optimization Suite
// ============================================================================

export const TimelineOptimizations = {
  ViewportCuller,
  LevelOfDetailManager,
  RenderScheduler,
  GPUTransformManager,
  MemoryPool,
  TimelinePerformanceTracker,
  adaptiveDebounce,
  rafThrottle
};

export default TimelineOptimizations;