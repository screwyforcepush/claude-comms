import { ref, reactive, onMounted, onUnmounted } from 'vue';

/**
 * Performance Optimization Composable
 * 
 * Provides progressive rendering, memory management, and performance monitoring
 * for the Interactive Sessions Timeline component.
 */

export interface PerformanceMetrics {
  frameRate: number;
  memoryUsage: number;
  renderTime: number;
  lastRenderPhase: string;
  sessionsRendered: number;
  agentsRendered: number;
}

export interface RenderPhase {
  name: string;
  priority: number;
  batchSize?: number;
  shouldRender: (metrics: PerformanceMetrics) => boolean;
}

export interface MemoryOptimizationConfig {
  maxCachedSessions: number;
  maxDetailLevel: number;
  gcThreshold: number; // Memory usage threshold for garbage collection
  weakMapEnabled: boolean;
}

/**
 * Performance Optimizer for Sessions Timeline
 */
export function usePerformanceOptimizer() {
  // ============================================================================
  // Reactive State
  // ============================================================================
  
  const isRendering = ref(false);
  const currentPhase = ref<string | null>(null);
  const renderQueue = ref<Array<() => Promise<void>>>([]);
  
  const performanceMetrics = reactive<PerformanceMetrics>({
    frameRate: 60,
    memoryUsage: 0,
    renderTime: 0,
    lastRenderPhase: 'none',
    sessionsRendered: 0,
    agentsRendered: 0
  });
  
  const memoryConfig = reactive<MemoryOptimizationConfig>({
    maxCachedSessions: 50,
    maxDetailLevel: 20,
    gcThreshold: 400, // 400MB
    weakMapEnabled: true
  });
  
  // ============================================================================
  // Progressive Rendering System
  // ============================================================================
  
  const renderPhases: RenderPhase[] = [
    {
      name: 'structure',
      priority: 1,
      shouldRender: () => true
    },
    {
      name: 'orchestrators', 
      priority: 2,
      shouldRender: (metrics) => metrics.frameRate > 45
    },
    {
      name: 'agents',
      priority: 3,
      batchSize: 5,
      shouldRender: (metrics) => metrics.frameRate > 30
    },
    {
      name: 'details',
      priority: 4,
      batchSize: 3,
      shouldRender: (metrics) => metrics.frameRate > 20 && metrics.memoryUsage < 400
    }
  ];
  
  /**
   * Progressive Rendering Implementation
   */
  const progressiveRenderer = {
    async renderSessions(sessions: any[], container: HTMLElement | SVGElement) {
      if (isRendering.value) return;
      
      isRendering.value = true;
      const startTime = performance.now();
      
      try {
        // Sort sessions by priority (active first, then by recency)
        const prioritizedSessions = this.prioritizeSessions(sessions);
        
        // Execute rendering phases
        for (const phase of renderPhases) {
          if (!phase.shouldRender(performanceMetrics)) {
            console.log(`⏭️  Skipping phase ${phase.name} due to performance constraints`);
            continue;
          }
          
          currentPhase.value = phase.name;
          await this.renderPhase(phase, prioritizedSessions, container);
          
          // Allow browser to breathe between phases
          await this.yieldToMain();
        }
        
        performanceMetrics.renderTime = performance.now() - startTime;
        performanceMetrics.lastRenderPhase = 'complete';
        
      } finally {
        isRendering.value = false;
        currentPhase.value = null;
      }
    },
    
    prioritizeSessions(sessions: any[]) {
      return [...sessions].sort((a, b) => {
        // Active sessions first
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (b.status === 'active' && a.status !== 'active') return 1;
        
        // Then by recent activity
        return b.startTime - a.startTime;
      });
    },
    
    async renderPhase(phase: RenderPhase, sessions: any[], container: HTMLElement | SVGElement) {
      const batchSize = phase.batchSize || sessions.length;
      
      for (let i = 0; i < sessions.length; i += batchSize) {
        const batch = sessions.slice(i, i + batchSize);
        
        await this.renderBatch(phase.name, batch, container);
        
        // Check performance and yield if needed
        if (this.shouldYield()) {
          await this.yieldToMain();
        }
      }
    },
    
    async renderBatch(phaseName: string, sessions: any[], container: HTMLElement | SVGElement) {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          try {
            switch (phaseName) {
              case 'structure':
                this.renderStructure(sessions, container);
                break;
              case 'orchestrators':
                this.renderOrchestrators(sessions, container);
                break;
              case 'agents':
                this.renderAgents(sessions, container);
                break;
              case 'details':
                this.renderDetails(sessions, container);
                break;
            }
            
            performanceMetrics.sessionsRendered += sessions.length;
            resolve();
          } catch (error) {
            console.error(`Failed to render phase ${phaseName}:`, error);
            resolve();
          }
        });
      });
    },
    
    renderStructure(sessions: any[], container: HTMLElement | SVGElement) {
      // Render basic structure: lanes, labels, backgrounds
      sessions.forEach((session, index) => {
        const laneElement = this.createSessionLane(session, index);
        if (laneElement && container) {
          // Use CSS transforms for GPU acceleration
          laneElement.style.transform = `translate3d(0, ${index * 84}px, 0)`;
          laneElement.style.willChange = 'transform';
        }
      });
    },
    
    renderOrchestrators(sessions: any[], container: HTMLElement | SVGElement) {
      // Render orchestrator lines with GPU acceleration
      sessions.forEach((session) => {
        const orchestratorLine = this.createOrchestratorLine(session);
        if (orchestratorLine) {
          orchestratorLine.style.transform = 'translate3d(0, 0, 0)';
        }
      });
    },
    
    renderAgents(sessions: any[], container: HTMLElement | SVGElement) {
      // Render agent paths in batches
      sessions.forEach((session) => {
        session.agents?.forEach((agent: any) => {
          const agentPath = this.createAgentPath(agent, session);
          if (agentPath) {
            // Use GPU acceleration for animations
            agentPath.style.transform = 'translate3d(0, 0, 0)';
            agentPath.style.willChange = 'transform, opacity';
          }
          performanceMetrics.agentsRendered++;
        });
      });
    },
    
    renderDetails(sessions: any[], container: HTMLElement | SVGElement) {
      // Render messages, tooltips, and other details only for visible sessions
      const visibleSessions = this.getVisibleSessions(sessions, container);
      
      visibleSessions.forEach((session) => {
        this.renderSessionDetails(session);
      });
    },
    
    createSessionLane(session: any, index: number): HTMLElement | null {
      // Placeholder for actual lane creation logic
      // In real implementation, this would create the DOM/SVG elements
      return null;
    },
    
    createOrchestratorLine(session: any): HTMLElement | null {
      // Placeholder for orchestrator line creation
      return null;
    },
    
    createAgentPath(agent: any, session: any): HTMLElement | null {
      // Placeholder for agent path creation
      return null;
    },
    
    getVisibleSessions(sessions: any[], container: HTMLElement | SVGElement): any[] {
      // Return only sessions currently visible in viewport
      return sessions.slice(0, 10); // Simplified for now
    },
    
    renderSessionDetails(session: any) {
      // Render additional details for visible sessions
    },
    
    shouldYield(): boolean {
      // Check if we should yield control back to the browser
      const now = performance.now();
      return (now % 100) < 16; // Yield every ~100ms for 16ms
    },
    
    async yieldToMain(): Promise<void> {
      return new Promise(resolve => {
        if ('scheduler' in window && 'postTask' in (window as any).scheduler) {
          // Use new Scheduler API if available
          (window as any).scheduler.postTask(() => resolve());
        } else {
          // Fallback to setTimeout
          setTimeout(resolve, 0);
        }
      });
    }
  };
  
  // ============================================================================
  // Memory Optimization System
  // ============================================================================
  
  const memoryOptimizer = {
    // Session metadata cache using WeakMap for automatic cleanup
    sessionMetadataCache: new WeakMap<object, any>(),
    
    // LRU cache for session details
    lruCache: new Map<string, { data: any; lastAccessed: number; size: number }>(),
    
    // Memory usage tracking
    memoryUsage: 0,
    
    /**
     * Add session to LRU cache with size tracking
     */
    cacheSession(sessionId: string, data: any, estimatedSize: number = 1024) {
      // Remove oldest entries if cache is full
      while (this.lruCache.size >= memoryConfig.maxCachedSessions) {
        const oldestKey = this.findOldestEntry();
        if (oldestKey) {
          const entry = this.lruCache.get(oldestKey);
          if (entry) {
            this.memoryUsage -= entry.size;
          }
          this.lruCache.delete(oldestKey);
        }
      }
      
      // Add new entry
      this.lruCache.set(sessionId, {
        data,
        lastAccessed: Date.now(),
        size: estimatedSize
      });
      
      this.memoryUsage += estimatedSize;
      performanceMetrics.memoryUsage = this.memoryUsage / (1024 * 1024); // Convert to MB
    },
    
    /**
     * Get session from cache and update access time
     */
    getCachedSession(sessionId: string): any | null {
      const entry = this.lruCache.get(sessionId);
      if (entry) {
        entry.lastAccessed = Date.now();
        return entry.data;
      }
      return null;
    },
    
    /**
     * Store session metadata in WeakMap for automatic cleanup
     */
    setSessionMetadata(sessionObject: object, metadata: any) {
      if (memoryConfig.weakMapEnabled) {
        this.sessionMetadataCache.set(sessionObject, metadata);
      }
    },
    
    /**
     * Get session metadata from WeakMap
     */
    getSessionMetadata(sessionObject: object): any {
      if (memoryConfig.weakMapEnabled) {
        return this.sessionMetadataCache.get(sessionObject);
      }
      return null;
    },
    
    /**
     * Reduce detail level for inactive sessions to save memory
     */
    optimizeDetailLevel() {
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 minutes
      
      for (const [sessionId, entry] of this.lruCache) {
        if (now - entry.lastAccessed > maxAge && entry.data.detailLevel === 'full') {
          // Reduce detail level for old sessions
          entry.data = this.createSummaryVersion(entry.data);
          entry.size = Math.floor(entry.size * 0.3); // Estimate 70% size reduction
        }
      }
    },
    
    /**
     * Create summary version of session data
     */
    createSummaryVersion(fullData: any): any {
      return {
        ...fullData,
        detailLevel: 'summary',
        // Remove heavy data
        agentDetails: undefined,
        messageDetails: undefined,
        // Keep essential data
        sessionId: fullData.sessionId,
        startTime: fullData.startTime,
        endTime: fullData.endTime,
        status: fullData.status,
        agentCount: fullData.agentCount
      };
    },
    
    /**
     * Find oldest cache entry for eviction
     */
    findOldestEntry(): string | null {
      let oldestKey: string | null = null;
      let oldestTime = Date.now();
      
      for (const [key, entry] of this.lruCache) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestKey = key;
        }
      }
      
      return oldestKey;
    },
    
    /**
     * Trigger garbage collection when memory threshold is exceeded
     */
    performGarbageCollection() {
      if (this.memoryUsage > memoryConfig.gcThreshold * 1024 * 1024) {
        console.log('🧹 Performing memory cleanup...');
        
        // Remove least recently used entries
        const targetSize = memoryConfig.maxCachedSessions * 0.7; // Reduce to 70%
        while (this.lruCache.size > targetSize) {
          const oldestKey = this.findOldestEntry();
          if (oldestKey) {
            const entry = this.lruCache.get(oldestKey);
            if (entry) {
              this.memoryUsage -= entry.size;
            }
            this.lruCache.delete(oldestKey);
          }
        }
        
        // Optimize detail levels
        this.optimizeDetailLevel();
        
        performanceMetrics.memoryUsage = this.memoryUsage / (1024 * 1024);
        console.log(`🧹 Memory cleanup complete. Usage: ${performanceMetrics.memoryUsage.toFixed(1)}MB`);
      }
    },
    
    /**
     * Clear all caches
     */
    clearAll() {
      this.lruCache.clear();
      this.memoryUsage = 0;
      performanceMetrics.memoryUsage = 0;
      console.log('🧹 All caches cleared');
    }
  };
  
  // ============================================================================
  // GPU Acceleration and DOM Optimization
  // ============================================================================
  
  const renderOptimizer = {
    // RAF-based update batching
    pendingUpdates: new Set<() => void>(),
    rafId: null as number | null,
    
    /**
     * Batch DOM updates using requestAnimationFrame
     */
    batchUpdate(updateFn: () => void) {
      this.pendingUpdates.add(updateFn);
      
      if (!this.rafId) {
        this.rafId = requestAnimationFrame(() => {
          // Execute all batched updates
          this.pendingUpdates.forEach(fn => {
            try {
              fn();
            } catch (error) {
              console.error('Batched update error:', error);
            }
          });
          
          this.pendingUpdates.clear();
          this.rafId = null;
        });
      }
    },
    
    /**
     * Apply GPU acceleration hints to elements
     */
    enableGpuAcceleration(element: HTMLElement | SVGElement) {
      if (element) {
        const style = element.style;
        style.transform = style.transform || 'translate3d(0, 0, 0)';
        style.willChange = 'transform, opacity';
        
        // Add CSS class for GPU acceleration
        if (element instanceof HTMLElement) {
          element.classList.add('gpu-accelerated');
        }
      }
    },
    
    /**
     * Remove GPU acceleration hints to save resources
     */
    disableGpuAcceleration(element: HTMLElement | SVGElement) {
      if (element) {
        const style = element.style;
        style.willChange = 'auto';
        
        if (element instanceof HTMLElement) {
          element.classList.remove('gpu-accelerated');
        }
      }
    },
    
    /**
     * Use requestIdleCallback for non-critical renders
     */
    scheduleIdleRender(callback: () => void, timeout: number = 5000) {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(callback, { timeout });
      } else {
        // Fallback to setTimeout with a delay
        setTimeout(callback, 16);
      }
    },
    
    /**
     * Optimize SVG rendering for timeline elements
     */
    optimizeSvgRendering(svgElement: SVGElement) {
      // Enable shape rendering optimization
      svgElement.setAttribute('shape-rendering', 'optimizeSpeed');
      
      // Disable text rendering optimization for better performance
      svgElement.setAttribute('text-rendering', 'optimizeSpeed');
      
      // Use GPU acceleration
      this.enableGpuAcceleration(svgElement);
    }
  };
  
  // ============================================================================
  // Performance Monitoring
  // ============================================================================
  
  const performanceMonitor = {
    frameCount: 0,
    lastFrameTime: 0,
    
    /**
     * Start monitoring performance metrics
     */
    start() {
      this.monitorFrameRate();
      this.monitorMemoryUsage();
    },
    
    /**
     * Monitor frame rate
     */
    monitorFrameRate() {
      const measureFrameRate = () => {
        const now = performance.now();
        if (this.lastFrameTime > 0) {
          const delta = now - this.lastFrameTime;
          const currentFps = 1000 / delta;
          
          // Smooth FPS calculation using exponential moving average
          performanceMetrics.frameRate = performanceMetrics.frameRate * 0.9 + currentFps * 0.1;
        }
        
        this.lastFrameTime = now;
        this.frameCount++;
        
        requestAnimationFrame(measureFrameRate);
      };
      
      requestAnimationFrame(measureFrameRate);
    },
    
    /**
     * Monitor memory usage (if available)
     */
    monitorMemoryUsage() {
      if ('memory' in performance) {
        const updateMemoryStats = () => {
          const memory = (performance as any).memory;
          if (memory) {
            performanceMetrics.memoryUsage = memory.usedJSHeapSize / (1024 * 1024);
            
            // Trigger cleanup if memory usage is high
            if (performanceMetrics.memoryUsage > memoryConfig.gcThreshold) {
              memoryOptimizer.performGarbageCollection();
            }
          }
          
          setTimeout(updateMemoryStats, 5000); // Update every 5 seconds
        };
        
        updateMemoryStats();
      }
    }
  };
  
  // ============================================================================
  // Public API
  // ============================================================================
  
  onMounted(() => {
    performanceMonitor.start();
    console.log('🚀 Performance optimizer initialized');
  });
  
  onUnmounted(() => {
    // Cleanup resources
    memoryOptimizer.clearAll();
    if (renderOptimizer.rafId) {
      cancelAnimationFrame(renderOptimizer.rafId);
    }
    console.log('🧹 Performance optimizer cleaned up');
  });
  
  return {
    // State
    isRendering: readonly(isRendering),
    currentPhase: readonly(currentPhase),
    performanceMetrics: readonly(performanceMetrics),
    memoryConfig,
    
    // Progressive Rendering
    renderSessions: progressiveRenderer.renderSessions.bind(progressiveRenderer),
    
    // Memory Management
    cacheSession: memoryOptimizer.cacheSession.bind(memoryOptimizer),
    getCachedSession: memoryOptimizer.getCachedSession.bind(memoryOptimizer),
    setSessionMetadata: memoryOptimizer.setSessionMetadata.bind(memoryOptimizer),
    getSessionMetadata: memoryOptimizer.getSessionMetadata.bind(memoryOptimizer),
    clearCache: memoryOptimizer.clearAll.bind(memoryOptimizer),
    
    // Rendering Optimization
    batchUpdate: renderOptimizer.batchUpdate.bind(renderOptimizer),
    enableGpuAcceleration: renderOptimizer.enableGpuAcceleration.bind(renderOptimizer),
    disableGpuAcceleration: renderOptimizer.disableGpuAcceleration.bind(renderOptimizer),
    scheduleIdleRender: renderOptimizer.scheduleIdleRender.bind(renderOptimizer),
    optimizeSvgRendering: renderOptimizer.optimizeSvgRendering.bind(renderOptimizer)
  };
}

/**
 * Helper function to check if device supports GPU acceleration
 */
export function supportsGpuAcceleration(): boolean {
  // Create a test element to check for 3D transform support
  const testEl = document.createElement('div');
  testEl.style.transform = 'translate3d(0, 0, 0)';
  
  return testEl.style.transform !== '';
}

/**
 * Helper function to estimate element memory footprint
 */
export function estimateElementSize(element: any): number {
  if (!element) return 0;
  
  // Rough estimation based on element properties
  let size = 100; // Base size
  
  if (element.agents) {
    size += element.agents.length * 50;
  }
  
  if (element.messages) {
    size += element.messages.length * 30;
  }
  
  if (element.events) {
    size += element.events.length * 20;
  }
  
  return size;
}