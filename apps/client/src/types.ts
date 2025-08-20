export interface HookEvent {
  id?: number;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: Record<string, any>;
  chat?: any[];
  summary?: string;
  timestamp?: number;
  priority?: number;
  priority_metadata?: {
    classified_at: number;
    classification_reason: string;
    retention_policy: string;
  };
}

export interface FilterOptions {
  source_apps: string[];
  session_ids: string[];
  hook_event_types: string[];
}

export interface WebSocketMessage {
  type: 'initial' | 'event';
  data: HookEvent | HookEvent[];
}

// Priority WebSocket Protocol Types
export interface PriorityWebSocketMessage {
  type: 'initial' | 'event' | 'priority_event' | 'session_event' | 'priority_session_event';
  data: HookEvent | HookEvent[];
  sessionId?: string; // For multi-session support
  priority_info?: {
    total_events: number;
    priority_events: number;
    regular_events: number;
    retention_window: {
      priority_hours: number;
      regular_hours: number;
    };
    protocol_version?: string;
  };
}

export interface PriorityBucketConfig {
  maxPriorityEvents: number;
  maxRegularEvents: number;
  totalDisplayLimit: number;
  priorityOverflowStrategy: 'remove_oldest_regular' | 'remove_oldest_priority' | 'strict_limits';
  enablePriorityIndicators: boolean;
}

export type TimeRange = '1m' | '3m' | '5m';

export interface ChartDataPoint {
  timestamp: number;
  count: number;
  eventTypes: Record<string, number>; // event type -> count
  sessions: Record<string, number>; // session id -> count
}

export interface ChartConfig {
  maxDataPoints: number;
  animationDuration: number;
  barWidth: number;
  barGap: number;
  colors: {
    primary: string;
    glow: string;
    axis: string;
    text: string;
  };
}

export interface Session {
  session_id: string;
  created_at: string;
  agent_count: number;
}

export interface AgentStatus {
  id: number;
  name: string;
  subagent_type: string;
  created_at: number;
  session_id: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'error' | 'terminated';
  duration?: number;
  token_count?: number;
  tool_count?: number;
  completion_timestamp?: number; // Preferred field name
  completed_at?: number; // Fallback for backward compatibility
  // Extended performance metrics from database
  total_duration_ms?: number;
  total_tokens?: number;
  total_tool_use_count?: number;
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  // Prompt and response fields
  initial_prompt?: string;
  final_response?: string;
}

export interface SubagentMessage {
  id?: string;
  sender: string;
  message: any;
  created_at: number;
  notified?: string[];
}

// Session Introspection Types
export interface SessionIntrospectionData {
  session_id: string;
  events: IntrospectionEvent[];
  message_history: TimelineMessage[];
  session_metadata: {
    created_at: string;
    total_events: number;
    event_types: string[];
    agents_involved: string[];
  };
}

export interface IntrospectionEvent {
  id: number;
  session_id: string;
  event_type: string;
  timestamp: number;
  payload: Record<string, any>;
  source_app: string;
}

export interface TimelineMessage {
  sender: string;
  recipient: string;
  content: string;
  metadata: {
    timestamp: number;
    task_description?: string;
    duration_minutes?: number;
    cost?: number;
    effort?: number;
    [key: string]: any;
  };
}

// Session Introspection Response Types
export interface SessionIntrospectionResponse {
  sessionId: string;
  timeline: TimelineMessage[];
  messageCount: number;
  sessionDurationMinutes: number;
}

export interface SessionTimelineMessage extends TimelineMessage {
  // Alias for TimelineMessage for backward compatibility
}