// Timeline Components - Phase 05 Timeline Order Enhancement
// WP2: Visual Polish Components for Timeline Chronological Clarity

export { default as TimelineDirectionHeader } from './TimelineDirectionHeader.vue';
export { default as TemporalContextBadge } from './TemporalContextBadge.vue';
export { default as TimelineFlowMarkers } from './TimelineFlowMarkers.vue';
export { default as EnhancedEventRow } from './EnhancedEventRow.vue';

// Composable exports
export { 
  useTimelineOrdering, 
  timelineUtils,
  type EnhancedEvent,
  type OrderingContext 
} from '../../composables/useTimelineOrdering';

// Type definitions for timeline components
export interface TimelineOrderState {
  currentOrder: 'newest-first' | 'oldest-first';
  eventCount: number;
  timeRange?: string;
}

export interface TimelineVisualState {
  useGpuAcceleration: boolean;
  showPositionMarkers: boolean;
  enableAnimations: boolean;
  highContrastMode: boolean;
}

export interface TimelineAccessibilityConfig {
  announceOrderChanges: boolean;
  providePositionContext: boolean;
  enableKeyboardNavigation: boolean;
  respectReducedMotion: boolean;
}

// Component integration utilities
export const timelineComponentUtils = {
  /**
   * Calculate stagger delay for list animations
   */
  getStaggerDelay: (index: number, maxDelay = 500): string => {
    return `${Math.min(index * 50, maxDelay)}ms`;
  },
  
  /**
   * Get CSS custom property for animation direction
   */
  getAnimationDirection: (order: 'newest-first' | 'oldest-first') => ({
    '--enter-direction': order === 'newest-first' ? '-20px' : '20px',
    '--leave-direction': order === 'newest-first' ? '20px' : '-20px'
  }),
  
  /**
   * Generate aria-label for timeline order context
   */
  getOrderAriaLabel: (
    order: 'newest-first' | 'oldest-first', 
    eventCount: number
  ): string => {
    const orderText = order === 'newest-first' ? 'newest to oldest' : 'oldest to newest';
    const eventText = eventCount === 1 ? 'event' : 'events';
    return `Timeline showing ${eventCount} ${eventText}, ordered from ${orderText}`;
  },
  
  /**
   * Check if animations should be enabled based on user preferences
   */
  shouldEnableAnimations: (): boolean => {
    if (typeof window === 'undefined') return true;
    
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Check for low-end device indicators
    const isLowEndDevice = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
    
    return !prefersReducedMotion && !isLowEndDevice;
  },
  
  /**
   * Get performance-optimized transition configuration
   */
  getOptimizedTransitions: (enableAnimations: boolean) => ({
    duration: enableAnimations ? '300ms' : '150ms',
    easing: enableAnimations ? 'cubic-bezier(0.4, 0, 0.2, 1)' : 'ease',
    willChange: enableAnimations ? 'transform, opacity' : 'opacity'
  })
};

// Design token mappings for timeline components
export const timelineDesignTokens = {
  colors: {
    orchestrator: '#00d4ff',
    latest: '#3b82f6',
    recent: '#60a5fa',
    older: '#9ca3af',
    oldest: '#6b7280',
    neutral: '#8b5cf6'
  },
  
  shadows: {
    latest: '0 0 12px rgba(59, 130, 246, 0.4)',
    recent: '0 0 8px rgba(96, 165, 250, 0.3)',
    older: '0 0 4px rgba(156, 163, 175, 0.2)',
    oldest: '0 0 4px rgba(107, 114, 128, 0.2)'
  },
  
  gradients: {
    newestFirstFlow: 'linear-gradient(to bottom, #3b82f6 0%, rgba(59, 130, 246, 0.8) 25%, rgba(59, 130, 246, 0.4) 75%, rgba(59, 130, 246, 0.1) 100%)',
    oldestFirstFlow: 'linear-gradient(to bottom, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.4) 25%, rgba(59, 130, 246, 0.8) 75%, #3b82f6 100%)'
  },
  
  timing: {
    standard: '300ms',
    fast: '200ms',
    slow: '400ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },
  
  spacing: {
    markerWidth: '16px',
    flowGradientWidth: '4px',
    badgePadding: '2px 6px',
    containerMargin: '16px'
  }
};

// Integration guide for existing components
export const integrationGuide = {
  eventTimeline: {
    description: 'Add TimelineDirectionHeader above scroll container',
    insertAt: 'Between lines 8-10 in EventTimeline.vue',
    implementation: `
<!-- After fixed header, before scrollable area -->
<TimelineDirectionHeader
  :current-order="currentOrder"
  :event-count="filteredEvents.length"
  :time-range="timeRange"
  @order-changed="handleOrderChange"
/>
    `
  },
  
  eventRow: {
    description: 'Replace EventRow with EnhancedEventRow in timeline list',
    replaceAt: 'Lines 21-30 in EventTimeline.vue',
    implementation: `
<EnhancedEventRow
  v-for="event in enhancedFilteredEvents"
  :key="\`\${event.id}-\${event.timestamp}\`"
  :enhanced-event="event"
  :gradient-class="getGradientForSession(event.session_id)"
  :color-class="getColorForSession(event.session_id)"
  :app-gradient-class="getGradientForApp(event.source_app)"
  :app-color-class="getColorForApp(event.source_app)"
  :app-hex-color="getHexColorForApp(event.source_app)"
  :current-order="currentOrder"
  :total-events="enhancedFilteredEvents.length"
/>
    `
  },
  
  styling: {
    description: 'Import timeline-transitions.css for animations',
    location: 'In main.ts or EventTimeline.vue',
    implementation: `import '../styles/timeline-transitions.css';`
  }
};

// Performance monitoring utilities
export const timelinePerformance = {
  /**
   * Monitor animation frame rate
   */
  monitorFPS: (callback: (fps: number) => void) => {
    let lastTime = performance.now();
    let frameCount = 0;
    
    const measureFPS = (currentTime: number) => {
      frameCount++;
      
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        callback(fps);
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(measureFPS);
    };
    
    requestAnimationFrame(measureFPS);
  },
  
  /**
   * Measure component render time
   */
  measureRenderTime: (componentName: string, renderFn: () => void) => {
    const start = performance.now();
    renderFn();
    const end = performance.now();
    
    console.log(`${componentName} render time: ${(end - start).toFixed(2)}ms`);
    
    return end - start;
  }
};