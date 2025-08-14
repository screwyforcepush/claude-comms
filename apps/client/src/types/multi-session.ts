/**
 * Multi-Session Timeline Types
 * 
 * Type definitions specifically for multi-session timeline visualization.
 * Extends the base timeline types for session swim lane functionality.
 */

import type { Ref, ComputedRef } from 'vue';
import type { 
  TimelineData, 
  TimeRange, 
  AgentPath, 
  TimelineMessage, 
  AgentBatch, 
  UserPrompt, 
  OrchestratorEvent,
  AgentStatus 
} from './timeline';

// ============================================================================
// Multi-Session Data Models
// ============================================================================

export interface MultiSessionTimelineData {
  sessions: SessionTimelineData[];
  timeRange: TimeRange;
  sessionLayout: SessionLayoutType;
  crossSessionMessages?: CrossSessionMessage[];
  lastUpdated: number;
  totalSessions: number;
  totalAgents: number;
}

export interface SessionTimelineData {
  sessionId: string;
  displayName: string;
  startTime: number;
  endTime?: number;
  status: SessionStatus;
  orchestratorEvents: OrchestratorEvent[];
  userPrompts: UserPrompt[];
  agentBatches: AgentBatch[];
  agentPaths: AgentPath[];
  messages: TimelineMessage[];
  sessionLaneOffset: number; // Y-position offset for this session's lane
  sessionLaneHeight: number; // Allocated height for this session (60-200px)
  metrics?: SessionMetrics;
  color?: string; // Optional session color theme
}

export type SessionStatus = 'active' | 'completed' | 'failed' | 'pending';

export type SessionLayoutType = 'swim_lanes' | 'interleaved' | 'hierarchical' | 'stacked';

export interface SessionMetrics {
  totalDuration: number;
  agentCount: number;
  messageCount: number;
  batchCount: number;
  averageAgentDuration: number;
  completionRate: number; // 0-1
  errorRate: number; // 0-1
}

export interface CrossSessionMessage extends TimelineMessage {
  sourceSessionId: string;
  targetSessionIds: string[];
  messageType: 'session_spawn' | 'session_sync' | 'session_result' | 'broadcast';
}

export interface SessionGroup {
  groupId: string;
  displayName: string;
  sessions: SessionTimelineData[];
  groupType: 'related' | 'sequential' | 'parallel' | 'hierarchical';
  color: string;
  collapsed?: boolean;
}

// ============================================================================
// Multi-Session Configuration & Options
// ============================================================================

export interface MultiSessionTransformOptions {
  viewport_width: number;
  viewport_height: number;
  session_layout: SessionLayoutType;
  time_window_ms: number; // Time window duration in milliseconds
  max_sessions: number; // Maximum sessions to display
  session_lane_height: number; // Fixed height per session lane (60-200px)
  show_messages: boolean;
  show_user_prompts: boolean;
  show_cross_session_messages: boolean;
  session_grouping?: 'none' | 'by_time' | 'by_type' | 'by_parent';
  virtual_scrolling_threshold: number; // Session count to enable virtualization (20+)
  auto_fit: boolean;
  compact_mode: boolean;
}

export interface SessionTimeWindow {
  start: number;
  end: number;
  duration: number;
  label: string; // e.g., "Last 1 hour", "Last 6 hours"
}

export interface SessionFilter {
  sessionIds?: string[];
  status?: SessionStatus[];
  timeRange?: { start: number; end: number };
  agentCountRange?: { min: number; max: number };
  searchQuery?: string;
}

// ============================================================================
// Multi-Session Composable Returns
// ============================================================================

export interface UseMultiSessionTimelineReturn {
  multiSessionData: ComputedRef<MultiSessionTimelineData>;
  visibleSessions: ComputedRef<SessionTimelineData[]>;
  timeWindow: Ref<SessionTimeWindow>;
  sessionLayout: Ref<SessionLayoutType>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  
  // Session management
  setTimeWindow: (window: SessionTimeWindow) => void;
  setSessionLayout: (layout: SessionLayoutType) => void;
  filterSessions: (filter: SessionFilter) => void;
  addSession: (session: SessionTimelineData) => void;
  removeSession: (sessionId: string) => void;
  
  // Data fetching
  refreshSessions: () => Promise<void>;
  fetchSessionsInWindow: (timeWindow: SessionTimeWindow) => Promise<SessionTimelineData[]>;
}

// ============================================================================
// Multi-Session Event Handlers
// ============================================================================

export interface MultiSessionEventHandlers {
  onSessionClick?: (session: SessionTimelineData, event: MouseEvent) => void;
  onSessionAgentClick?: (agent: AgentPath, session: SessionTimelineData, event: MouseEvent) => void;
  onSessionMessageClick?: (message: TimelineMessage, session: SessionTimelineData, event: MouseEvent) => void;
  onCrossSessionMessageClick?: (message: CrossSessionMessage, event: MouseEvent) => void;
  onTimeWindowChange?: (window: SessionTimeWindow) => void;
  onSessionLayoutChange?: (layout: SessionLayoutType) => void;
  onSessionGroupToggle?: (group: SessionGroup, collapsed: boolean) => void;
  onZoomChange?: (zoom: number) => void;
  onSelectionChange?: (selection: MultiSessionSelection) => void;
}

export interface MultiSessionSelection {
  selectedSession?: SessionTimelineData;
  selectedAgent?: { agent: AgentPath; session: SessionTimelineData };
  selectedMessage?: { message: TimelineMessage; session: SessionTimelineData };
  selectedBatch?: { batch: AgentBatch; session: SessionTimelineData };
}

// ============================================================================
// Session Lane Component Props
// ============================================================================

export interface SessionLaneProps {
  session: SessionTimelineData;
  timeRange: TimeRange;
  height: number; // Between 60-200px per architecture
  isSelected?: boolean;
  showMessages?: boolean;
  showUserPrompts?: boolean;
  compact?: boolean;
  zoomLevel?: number;
  panX?: number;
  panY?: number;
}

// ============================================================================
// Multi-Session Performance & Virtualization
// ============================================================================

export interface SessionVirtualizationConfig {
  enabled: boolean;
  threshold: number; // Number of sessions before virtualization kicks in (20+)
  overscan: number; // Number of extra sessions to render outside viewport
  itemHeight: number; // Fixed height per session lane
}

export interface SessionRenderingOptimization {
  enableProgressiveRendering: boolean;
  progressivePhases: ('structure' | 'orchestrators' | 'agents' | 'details')[];
  lodZoomThresholds: {
    hideLabels: number;
    hideMessages: number;
    simplifyPaths: number;
  };
  maxConcurrentSessions: number; // Target: 10 for 60fps, 20 for 30fps
}

// ============================================================================
// Type Guards
// ============================================================================

export function isSessionTimelineData(obj: any): obj is SessionTimelineData {
  return obj && typeof obj === 'object' &&
         typeof obj.sessionId === 'string' &&
         typeof obj.displayName === 'string' &&
         typeof obj.startTime === 'number' &&
         Array.isArray(obj.agentPaths);
}

export function isMultiSessionTimelineData(obj: any): obj is MultiSessionTimelineData {
  return obj && typeof obj === 'object' &&
         Array.isArray(obj.sessions) &&
         obj.sessions.every(isSessionTimelineData) &&
         typeof obj.timeRange === 'object';
}

export function isCrossSessionMessage(obj: any): obj is CrossSessionMessage {
  return obj && typeof obj === 'object' &&
         typeof obj.sourceSessionId === 'string' &&
         Array.isArray(obj.targetSessionIds) &&
         typeof obj.timestamp === 'number';
}

export function isSessionLayoutType(layout: string): layout is SessionLayoutType {
  return ['swim_lanes', 'interleaved', 'hierarchical', 'stacked'].includes(layout);
}

export function isSessionStatus(status: string): status is SessionStatus {
  return ['active', 'completed', 'failed', 'pending'].includes(status);
}

// ============================================================================
// Default Configuration Values
// ============================================================================

export const DEFAULT_MULTI_SESSION_CONFIG: MultiSessionTransformOptions = {
  viewport_width: 1200,
  viewport_height: 800,
  session_layout: 'swim_lanes',
  time_window_ms: 3600000, // 1 hour
  max_sessions: 50,
  session_lane_height: 120, // Between 60-200px architecture constraint
  show_messages: true,
  show_user_prompts: true,
  show_cross_session_messages: false, // Start simple
  session_grouping: 'none',
  virtual_scrolling_threshold: 20, // Per architecture guidance
  auto_fit: true,
  compact_mode: false
};

export const DEFAULT_SESSION_TIME_WINDOWS: SessionTimeWindow[] = [
  {
    start: Date.now() - 15 * 60 * 1000,
    end: Date.now(),
    duration: 15 * 60 * 1000,
    label: '15 minutes'
  },
  {
    start: Date.now() - 60 * 60 * 1000,
    end: Date.now(),
    duration: 60 * 60 * 1000,
    label: '1 hour'
  },
  {
    start: Date.now() - 6 * 60 * 60 * 1000,
    end: Date.now(),
    duration: 6 * 60 * 60 * 1000,
    label: '6 hours'
  },
  {
    start: Date.now() - 24 * 60 * 60 * 1000,
    end: Date.now(),
    duration: 24 * 60 * 60 * 1000,
    label: '24 hours'
  }
];

// ============================================================================
// Utility Types
// ============================================================================

export type SessionTimelineDataWithIndex = SessionTimelineData & { 
  sessionIndex: number;
  virtualOffset?: number;
};

export type MultiSessionUpdate = {
  type: 'session_added' | 'session_updated' | 'session_removed' | 'batch_update';
  sessionId: string;
  data?: Partial<SessionTimelineData>;
  timestamp: number;
};

export type SessionRenderPhase = 'structure' | 'orchestrators' | 'agents' | 'details';

export interface SessionRenderState {
  phase: SessionRenderPhase;
  completedSessions: Set<string>;
  renderingSession?: string;
  totalSessions: number;
  progressPercent: number;
}