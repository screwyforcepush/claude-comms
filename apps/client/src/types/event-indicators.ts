/**
 * Event Indicators Type Definitions
 * 
 * Type definitions for UserPromptSubmit and Notification event indicators
 * that display on the orchestrator timeline with clickable functionality.
 */

import type { Point2D } from './timeline';

// ============================================================================
// Core Event Indicator Types
// ============================================================================

export type EventIndicatorType = 'UserPromptSubmit' | 'Notification';

export interface EventIndicator {
  eventId: string;
  eventType: EventIndicatorType;
  timestamp: number;
  sessionId: string;
  content: string;
  position: Point2D;
  rawEvent: RawEventData;
  metadata?: EventIndicatorMetadata;
}

export interface EventIndicatorMetadata {
  severity?: 'info' | 'warning' | 'error';
  source?: string;
  category?: string;
  wordCount?: number;
  complexity?: 'simple' | 'moderate' | 'complex';
  responseTime?: number; // Time to first agent response (for UserPromptSubmit)
  agentCount?: number;   // Number of agents spawned after prompt
}

export interface RawEventData {
  id?: number;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: EventPayload;
  timestamp: number;
  chat?: any[];
  summary?: string;
}

// ============================================================================
// Event Payload Structures
// ============================================================================

export type EventPayload = UserPromptSubmitPayload | NotificationPayload;

export interface UserPromptSubmitPayload {
  session_id: string;
  hook_event_name: 'UserPromptSubmit';
  prompt: string;
}

export interface NotificationPayload {
  session_id: string;
  hook_event_name: 'Notification';
  message: string;
}

// ============================================================================
// Event Indicator Configuration
// ============================================================================

export interface EventIndicatorConfig {
  showUserPrompts: boolean;
  showNotifications: boolean;
  showOnOrchestratorLine: boolean;
  enableClickableIndicators: boolean;
  maxIndicatorsPerSession: number;
  clustering: {
    enabled: boolean;
    threshold: number; // Minimum pixels between indicators before clustering
    maxInCluster: number;
  };
  indicatorStyles: EventIndicatorStyles;
  animation: EventIndicatorAnimation;
}

export interface EventIndicatorStyles {
  userPrompt: {
    color: string;
    hoverColor: string;
    size: number;
    icon: string; // '💬'
    strokeWidth: number;
    opacity: number;
  };
  notification: {
    color: string;
    hoverColor: string;
    size: number;
    icon: string; // '🔔'
    strokeWidth: number;
    opacity: number;
  };
  cluster: {
    color: string;
    size: number;
    strokeColor: string;
    strokeWidth: number;
    labelColor: string;
    labelFont: string;
  };
}

export interface EventIndicatorAnimation {
  enabled: boolean;
  fadeInDuration: number;
  hoverTransitionDuration: number;
  clickRippleDuration: number;
  pulseDuration: number; // For notification indicators
}

// ============================================================================
// Event Indicator Interaction Types
// ============================================================================

export interface EventIndicatorInteraction {
  onIndicatorClick: (indicator: EventIndicator, event: MouseEvent) => void;
  onIndicatorHover: (indicator: EventIndicator | null, event: MouseEvent) => void;
  onIndicatorDoubleClick?: (indicator: EventIndicator, event: MouseEvent) => void;
  onClusterClick?: (cluster: EventIndicatorCluster, event: MouseEvent) => void;
}

export interface EventIndicatorCluster {
  clusterId: string;
  indicators: EventIndicator[];
  position: Point2D;
  timeRange: { start: number; end: number };
  size: number;
  primaryType: EventIndicatorType; // Most common type in cluster
}

// ============================================================================
// Event Indicator Data Management
// ============================================================================

export interface EventIndicatorData {
  indicators: EventIndicator[];
  clusters: EventIndicatorCluster[];
  filteredBy: EventIndicatorFilter;
  totalCount: number;
  visibleCount: number;
  timeRange: { start: number; end: number };
}

export interface EventIndicatorFilter {
  eventTypes: EventIndicatorType[];
  sessionIds: string[];
  timeRange?: { start: number; end: number };
  searchText?: string;
  severity?: ('info' | 'warning' | 'error')[];
}

// ============================================================================
// Rendering and Display Types
// ============================================================================

export interface EventIndicatorRenderState {
  visible: EventIndicator[];
  clustered: EventIndicatorCluster[];
  hovered?: EventIndicator;
  selected?: EventIndicator[];
  renderBounds: {
    startTime: number;
    endTime: number;
    startX: number;
    endX: number;
  };
}

export interface EventIndicatorTooltipData {
  indicator: EventIndicator;
  position: Point2D;
  visible: boolean;
  content: {
    title: string;
    subtitle: string;
    details: Array<{ label: string; value: string }>;
    timestamp: string;
  };
}

// ============================================================================
// Side Panel Integration Types
// ============================================================================

export interface EventIndicatorSidePanelData {
  selectedIndicator?: EventIndicator;
  relatedEvents: EventIndicator[];
  sessionContext: {
    sessionId: string;
    totalEvents: number;
    timeRange: { start: number; end: number };
    agentCount: number;
  };
  navigationHistory: EventIndicator[];
}

export interface EventIndicatorDetailView {
  indicator: EventIndicator;
  fullContent: string;
  relatedAgents: string[];
  contextEvents: EventIndicator[];
  timeline: {
    beforeEvents: EventIndicator[];
    afterEvents: EventIndicator[];
  };
}

// ============================================================================
// Transformation and Adapter Types
// ============================================================================

export interface EventIndicatorTransformOptions {
  timeRange: { start: number; end: number };
  orchestratorY: number;
  pixelsPerMs: number;
  viewportBounds: { left: number; right: number };
  enableClustering: boolean;
  clusterThreshold: number;
}

export interface EventIndicatorTransformResult {
  indicators: EventIndicator[];
  clusters: EventIndicatorCluster[];
  totalProcessed: number;
  timeRange: { start: number; end: number };
}

// ============================================================================
// Performance and Optimization Types
// ============================================================================

export interface EventIndicatorPerformanceConfig {
  maxVisibleIndicators: number;
  virtualizationThreshold: number;
  renderThrottleMs: number;
  clusteringDebounceMs: number;
  tooltipDelayMs: number;
  animationFrameOptimization: boolean;
}

export interface EventIndicatorMetrics {
  totalIndicators: number;
  visibleIndicators: number;
  clusteredIndicators: number;
  renderTime: number;
  lastUpdateTime: number;
  memoryUsage?: {
    indicatorData: number;
    clusterData: number;
    renderCache: number;
  };
}

// ============================================================================
// Type Guards
// ============================================================================

export function isEventIndicator(obj: any): obj is EventIndicator {
  return obj && 
         typeof obj.eventId === 'string' &&
         typeof obj.eventType === 'string' &&
         typeof obj.timestamp === 'number' &&
         typeof obj.sessionId === 'string' &&
         typeof obj.content === 'string' &&
         typeof obj.position === 'object';
}

export function isUserPromptSubmitPayload(payload: any): payload is UserPromptSubmitPayload {
  return payload &&
         payload.hook_event_name === 'UserPromptSubmit' &&
         typeof payload.prompt === 'string' &&
         typeof payload.session_id === 'string';
}

export function isNotificationPayload(payload: any): payload is NotificationPayload {
  return payload &&
         payload.hook_event_name === 'Notification' &&
         typeof payload.message === 'string' &&
         typeof payload.session_id === 'string';
}

export function isEventIndicatorCluster(obj: any): obj is EventIndicatorCluster {
  return obj &&
         typeof obj.clusterId === 'string' &&
         Array.isArray(obj.indicators) &&
         obj.indicators.every(isEventIndicator) &&
         typeof obj.position === 'object';
}

// ============================================================================
// Default Configuration Values
// ============================================================================

export const DEFAULT_EVENT_INDICATOR_CONFIG: EventIndicatorConfig = {
  showUserPrompts: true,
  showNotifications: true,
  showOnOrchestratorLine: true,
  enableClickableIndicators: true,
  maxIndicatorsPerSession: 100,
  clustering: {
    enabled: true,
    threshold: 20, // 20 pixels minimum between indicators
    maxInCluster: 10
  },
  indicatorStyles: {
    userPrompt: {
      color: '#3b82f6',
      hoverColor: '#1d4ed8',
      size: 8,
      icon: '💬',
      strokeWidth: 2,
      opacity: 0.8
    },
    notification: {
      color: '#f59e0b',
      hoverColor: '#d97706',
      size: 8,
      icon: '🔔',
      strokeWidth: 2,
      opacity: 0.8
    },
    cluster: {
      color: '#6b7280',
      size: 12,
      strokeColor: '#374151',
      strokeWidth: 2,
      labelColor: '#f9fafb',
      labelFont: '10px Inter, sans-serif'
    }
  },
  animation: {
    enabled: true,
    fadeInDuration: 300,
    hoverTransitionDuration: 150,
    clickRippleDuration: 400,
    pulseDuration: 2000
  }
};

export const DEFAULT_EVENT_INDICATOR_PERFORMANCE: EventIndicatorPerformanceConfig = {
  maxVisibleIndicators: 200,
  virtualizationThreshold: 500,
  renderThrottleMs: 16, // 60fps
  clusteringDebounceMs: 100,
  tooltipDelayMs: 300,
  animationFrameOptimization: true
};