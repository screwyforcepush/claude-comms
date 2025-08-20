import { ref, computed, onMounted, onUnmounted } from 'vue'

/**
 * Performance Monitoring Composable
 * 
 * Provides comprehensive performance tracking for:
 * - Component render times
 * - API response times
 * - Memory usage patterns
 * - User interaction responsiveness
 * - Virtual scrolling efficiency
 */

// Global performance metrics store
const globalMetrics = ref({
  // Render performance
  componentRenderTimes: new Map<string, number[]>(),
  averageRenderTime: 0,
  slowRenderCount: 0,
  
  // API performance
  apiResponseTimes: new Map<string, number[]>(),
  cacheHitRate: 0,
  totalApiCalls: 0,
  
  // Memory metrics
  peakMemoryUsage: 0,
  currentMemoryUsage: 0,
  memoryLeakDetection: new Map<string, number>(),
  
  // User interaction
  interactionTimes: new Map<string, number[]>(),
  lagEvents: 0,
  smoothScrollEvents: 0,
  
  // Virtual scrolling
  virtualScrollMetrics: {
    totalItemsRendered: 0,
    itemsInViewport: 0,
    scrollPerformance: 0,
    renderEfficiency: 0
  }
})

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  RENDER_WARNING: 100, // ms
  RENDER_CRITICAL: 200, // ms
  API_WARNING: 150, // ms
  API_CRITICAL: 300, // ms
  INTERACTION_WARNING: 50, // ms
  MEMORY_WARNING: 50 * 1024 * 1024, // 50MB
  MEMORY_CRITICAL: 100 * 1024 * 1024 // 100MB
}

export function usePerformanceMonitoring(componentName?: string) {
  const componentMetrics = ref({
    renderCount: 0,
    totalRenderTime: 0,
    averageRenderTime: 0,
    lastRenderTime: 0,
    slowRenders: 0
  })

  let performanceObserver: PerformanceObserver | null = null
  let memoryMonitorInterval: NodeJS.Timeout | null = null

  /**
   * Track component render performance
   */
  const trackRender = (renderFn: () => void, context = 'render') => {
    const startTime = performance.now()
    
    try {
      renderFn()
    } finally {
      const renderTime = performance.now() - startTime
      
      // Update component metrics
      componentMetrics.value.renderCount++
      componentMetrics.value.totalRenderTime += renderTime
      componentMetrics.value.lastRenderTime = renderTime
      componentMetrics.value.averageRenderTime = 
        componentMetrics.value.totalRenderTime / componentMetrics.value.renderCount
      
      if (renderTime > PERFORMANCE_THRESHOLDS.RENDER_WARNING) {
        componentMetrics.value.slowRenders++
        console.warn(`Slow render detected: ${context} took ${renderTime.toFixed(2)}ms`)
      }
      
      // Update global metrics
      if (componentName) {
        const componentTimes = globalMetrics.value.componentRenderTimes.get(componentName) || []
        componentTimes.push(renderTime)
        
        // Keep only last 100 measurements
        if (componentTimes.length > 100) {
          componentTimes.shift()
        }
        
        globalMetrics.value.componentRenderTimes.set(componentName, componentTimes)
        
        // Update global averages
        const allTimes = Array.from(globalMetrics.value.componentRenderTimes.values()).flat()
        globalMetrics.value.averageRenderTime = 
          allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length
        
        if (renderTime > PERFORMANCE_THRESHOLDS.RENDER_WARNING) {
          globalMetrics.value.slowRenderCount++
        }
      }
    }
  }

  /**
   * Track API call performance
   */
  const trackApiCall = async <T>(
    apiCall: () => Promise<T>,
    endpoint: string
  ): Promise<T> => {
    const startTime = performance.now()
    
    try {
      globalMetrics.value.totalApiCalls++
      const result = await apiCall()
      
      const responseTime = performance.now() - startTime
      
      // Track response times
      const endpointTimes = globalMetrics.value.apiResponseTimes.get(endpoint) || []
      endpointTimes.push(responseTime)
      
      // Keep only last 50 measurements per endpoint
      if (endpointTimes.length > 50) {
        endpointTimes.shift()
      }
      
      globalMetrics.value.apiResponseTimes.set(endpoint, endpointTimes)
      
      // Log slow API calls
      if (responseTime > PERFORMANCE_THRESHOLDS.API_WARNING) {
        console.warn(`Slow API call: ${endpoint} took ${responseTime.toFixed(2)}ms`)
      }
      
      return result
    } catch (error) {
      const responseTime = performance.now() - startTime
      console.error(`Failed API call: ${endpoint} failed after ${responseTime.toFixed(2)}ms`, error)
      throw error
    }
  }

  /**
   * Track user interaction responsiveness
   */
  const trackInteraction = (interaction: () => void, interactionType = 'click') => {
    const startTime = performance.now()
    
    try {
      interaction()
    } finally {
      const interactionTime = performance.now() - startTime
      
      // Track interaction times
      const interactions = globalMetrics.value.interactionTimes.get(interactionType) || []
      interactions.push(interactionTime)
      
      // Keep only last 100 interactions per type
      if (interactions.length > 100) {
        interactions.shift()
      }
      
      globalMetrics.value.interactionTimes.set(interactionType, interactions)
      
      // Track lag events
      if (interactionTime > PERFORMANCE_THRESHOLDS.INTERACTION_WARNING) {
        globalMetrics.value.lagEvents++
        console.warn(`Laggy interaction: ${interactionType} took ${interactionTime.toFixed(2)}ms`)
      } else {
        globalMetrics.value.smoothScrollEvents++
      }
    }
  }

  /**
   * Monitor memory usage
   */
  const trackMemoryUsage = () => {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory
      const usedMemory = memInfo.usedJSHeapSize
      
      globalMetrics.value.currentMemoryUsage = usedMemory
      globalMetrics.value.peakMemoryUsage = Math.max(
        globalMetrics.value.peakMemoryUsage,
        usedMemory
      )
      
      // Memory leak detection
      if (componentName) {
        const previousUsage = globalMetrics.value.memoryLeakDetection.get(componentName) || 0
        const memoryIncrease = usedMemory - previousUsage
        
        if (memoryIncrease > PERFORMANCE_THRESHOLDS.MEMORY_WARNING) {
          console.warn(`Potential memory leak in ${componentName}: +${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
        }
        
        globalMetrics.value.memoryLeakDetection.set(componentName, usedMemory)
      }
      
      // Critical memory warning
      if (usedMemory > PERFORMANCE_THRESHOLDS.MEMORY_CRITICAL) {
        console.error(`Critical memory usage: ${(usedMemory / 1024 / 1024).toFixed(2)}MB`)
      }
    }
  }

  /**
   * Track virtual scrolling performance
   */
  const trackVirtualScrolling = (metrics: {
    totalItems: number
    visibleItems: number
    scrollTime?: number
    renderTime?: number
  }) => {
    globalMetrics.value.virtualScrollMetrics.totalItemsRendered = metrics.totalItems
    globalMetrics.value.virtualScrollMetrics.itemsInViewport = metrics.visibleItems
    
    if (metrics.scrollTime !== undefined) {
      globalMetrics.value.virtualScrollMetrics.scrollPerformance = metrics.scrollTime
    }
    
    if (metrics.renderTime !== undefined) {
      globalMetrics.value.virtualScrollMetrics.renderEfficiency = metrics.renderTime
    }
    
    // Calculate efficiency ratio
    const efficiency = metrics.visibleItems / Math.max(metrics.totalItems, 1)
    if (efficiency < 0.1 && metrics.totalItems > 100) {
      console.info(`Virtual scrolling efficiency: ${(efficiency * 100).toFixed(1)}% (${metrics.visibleItems}/${metrics.totalItems})`)
    }
  }

  /**
   * Get performance summary
   */
  const getPerformanceSummary = computed(() => {
    const apiTimes = Array.from(globalMetrics.value.apiResponseTimes.values()).flat()
    const renderTimes = Array.from(globalMetrics.value.componentRenderTimes.values()).flat()
    const interactionTimes = Array.from(globalMetrics.value.interactionTimes.values()).flat()
    
    return {
      // Render performance
      render: {
        averageTime: globalMetrics.value.averageRenderTime,
        slowRenders: globalMetrics.value.slowRenderCount,
        totalRenders: renderTimes.length,
        p95: calculatePercentile(renderTimes, 95),
        p99: calculatePercentile(renderTimes, 99)
      },
      
      // API performance
      api: {
        totalCalls: globalMetrics.value.totalApiCalls,
        averageResponseTime: apiTimes.length > 0 
          ? apiTimes.reduce((sum, time) => sum + time, 0) / apiTimes.length 
          : 0,
        p95: calculatePercentile(apiTimes, 95),
        p99: calculatePercentile(apiTimes, 99),
        cacheHitRate: globalMetrics.value.cacheHitRate
      },
      
      // Memory usage
      memory: {
        current: globalMetrics.value.currentMemoryUsage,
        peak: globalMetrics.value.peakMemoryUsage,
        currentMB: (globalMetrics.value.currentMemoryUsage / 1024 / 1024).toFixed(2),
        peakMB: (globalMetrics.value.peakMemoryUsage / 1024 / 1024).toFixed(2)
      },
      
      // Interaction responsiveness
      interactions: {
        averageTime: interactionTimes.length > 0 
          ? interactionTimes.reduce((sum, time) => sum + time, 0) / interactionTimes.length 
          : 0,
        lagEvents: globalMetrics.value.lagEvents,
        smoothEvents: globalMetrics.value.smoothScrollEvents,
        responsiveness: globalMetrics.value.smoothScrollEvents / 
          Math.max(globalMetrics.value.lagEvents + globalMetrics.value.smoothScrollEvents, 1)
      },
      
      // Virtual scrolling
      virtualScrolling: globalMetrics.value.virtualScrollMetrics
    }
  })

  /**
   * Calculate percentile
   */
  const calculatePercentile = (values: number[], percentile: number): number => {
    if (values.length === 0) return 0
    
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
  }

  /**
   * Reset metrics
   */
  const resetMetrics = () => {
    componentMetrics.value = {
      renderCount: 0,
      totalRenderTime: 0,
      averageRenderTime: 0,
      lastRenderTime: 0,
      slowRenders: 0
    }
  }

  /**
   * Start performance monitoring
   */
  const startMonitoring = () => {
    // Setup performance observer for user timing marks
    if ('PerformanceObserver' in window) {
      performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            console.debug(`Performance measure: ${entry.name} took ${entry.duration.toFixed(2)}ms`)
          }
        }
      })
      
      try {
        performanceObserver.observe({ entryTypes: ['measure', 'navigation', 'paint'] })
      } catch (error) {
        console.warn('Performance observer not fully supported:', error)
      }
    }

    // Start memory monitoring
    if ('memory' in performance) {
      memoryMonitorInterval = setInterval(trackMemoryUsage, 5000) // Every 5 seconds
    }
  }

  /**
   * Stop performance monitoring
   */
  const stopMonitoring = () => {
    if (performanceObserver) {
      performanceObserver.disconnect()
      performanceObserver = null
    }
    
    if (memoryMonitorInterval) {
      clearInterval(memoryMonitorInterval)
      memoryMonitorInterval = null
    }
  }

  // Lifecycle hooks
  onMounted(() => {
    startMonitoring()
  })

  onUnmounted(() => {
    stopMonitoring()
  })

  return {
    // Metrics
    componentMetrics: computed(() => componentMetrics.value),
    globalMetrics: computed(() => globalMetrics.value),
    performanceSummary: getPerformanceSummary,
    
    // Tracking functions
    trackRender,
    trackApiCall,
    trackInteraction,
    trackMemoryUsage,
    trackVirtualScrolling,
    
    // Control functions
    startMonitoring,
    stopMonitoring,
    resetMetrics,
    
    // Utility functions
    isPerformant: computed(() => {
      const summary = getPerformanceSummary.value
      return summary.render.averageTime < PERFORMANCE_THRESHOLDS.RENDER_WARNING &&
             summary.api.averageResponseTime < PERFORMANCE_THRESHOLDS.API_WARNING &&
             summary.interactions.averageTime < PERFORMANCE_THRESHOLDS.INTERACTION_WARNING
    })
  }
}