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

export interface Subagent {
  id?: number;
  session_id: string;
  name: string;
  subagent_type: string;
  created_at: number;
  status?: string;
  completed_at?: number;
  completion_timestamp?: number; // Mapped from completed_at for client compatibility
  completion_metadata?: any;
  initial_prompt?: string; // Full prompt text sent to create the subagent
  final_response?: string; // Final response/output from the subagent
}

export interface SubagentMessage {
  sender: string;
  message: any;
  created_at: number;
  notified?: string[];
}

export interface RegisterSubagentRequest {
  session_id: string;
  name: string;
  subagent_type: string;
}

export interface SendMessageRequest {
  sender: string;
  message: any;
}

export interface GetUnreadMessagesRequest {
  subagent_name: string;
}

export interface UpdateSubagentPromptRequest {
  session_id: string;
  name: string;
  prompt: string;
}

export interface UpdateSubagentResponseRequest {
  session_id: string;
  name: string;
  response: string;
}

export interface UpdateSubagentCompletionRequest {
  session_id: string;
  name: string;
  status: string;
  completed_at?: number;
  completion_metadata?: any;
  total_duration_ms?: number;
  total_tokens?: number;
  total_tool_use_count?: number;
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  initial_prompt?: string;
  final_response?: string;
}

export interface SessionSummary {
  session_id: string;
  agent_count: number;
  created_at: number;
}

// Multi-session API types
export interface SessionWindowRequest {
  start: number;  // Unix timestamp
  end: number;    // Unix timestamp
  limit?: number; // Max sessions to return
}

export interface SessionBatchRequest {
  sessionIds: string[];
  includeAgents?: boolean;
  includeMessages?: boolean;
}

export interface SessionDetail {
  session_id: string;
  agent_count: number;
  created_at: number;
  agents?: Subagent[];
  messages?: SubagentMessage[];
  status: 'active' | 'completed' | 'failed' | 'pending';
  duration?: number;
  last_activity?: number;
}

export interface ComparisonRequest {
  sessionIds: string[];
  metrics?: string[];
}

export interface ComparisonData {
  sessions: SessionComparison[];
  metrics: ComparisonMetrics;
}

export interface SessionComparison {
  session_id: string;
  agent_count: number;
  message_count: number;
  duration: number;
  status: string;
  completion_rate: number;
  created_at: number;
}

export interface ComparisonMetrics {
  total_sessions: number;
  total_agents: number;
  total_messages: number;
  average_duration: number;
  completion_rate: number;
}

export interface MultiSessionUpdate {
  type: 'session_added' | 'session_updated' | 'session_removed' | 'batch_update';
  sessionId: string;
  data?: Partial<SessionDetail>;
  timestamp: number;
  priority_info?: {
    event_priority: number;
    retention_hint: 'standard' | 'extended';
    classification: 'automatic' | 'manual';
    bucket: 'priority' | 'regular';
  };
}

export interface MultiSessionWebSocketMessage {
  action: 'subscribe' | 'unsubscribe';
  sessionIds?: string[];
  sessionId?: string;
  priority_aware?: boolean; // Client capability flag
}

// New interfaces for agent prompt/response API
export interface UpdateAgentDataRequest {
  initial_prompt?: string;
  final_response?: string;
  tool_calls?: any[];
  metadata?: any;
}

export interface AgentPromptResponseData {
  initial_prompt?: string;
  final_response?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface WebSocketHandler<T = any> {
  open?: (ws: T) => void;
  message?: (ws: T, message: string | Buffer) => void;
  close?: (ws: T) => void;
  error?: (ws: T, error: any) => void;
}

// Priority Event System Types
export interface PriorityEventConfig {
  totalLimit: number;
  priorityLimit: number;
  regularLimit: number;
  priorityRetentionHours: number;
  regularRetentionHours: number;
}

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

export interface PriorityEventMetrics {
  totalEvents: number;
  priorityEvents: number;
  regularEvents: number;
  priorityPercentage: number;
  avgQueryTime?: number;
  bucketDistribution: {
    priority: number;
    regular: number;
  };
  retentionEffectiveness: {
    priorityRetained: number;
    regularRetained: number;
  };
  classificationAccuracy: {
    correctlyClassified: number;
    totalClassified: number;
    accuracy: number;
  };
}

// Priority classification constants  
export const PRIORITY_EVENT_TYPES = {
  'UserPromptSubmit': 1,
  'Notification': 1,
  'Stop': 1
} as const;

export const DEFAULT_PRIORITY_CONFIG: PriorityEventConfig = {
  totalLimit: 150,
  priorityLimit: 100,
  regularLimit: 50,
  priorityRetentionHours: 24,
  regularRetentionHours: 4
};

// Protocol versioning
export const PRIORITY_PROTOCOL_VERSION = '1.0.0';

// Session Introspection API Types (WP1)
export interface SessionIntrospectionRequest {
  sessionId: string;
  eventTypes?: string[]; // Optional filter for event types
}

export interface SessionTimelineMessage {
  id: number;
  type: 'user_message' | 'orchestrator_message' | 'agent_message';
  role: 'User' | 'Orchestrator' | 'Agent';
  timestamp: number;
  content: {
    prompt?: string;
    user_id?: string;
    agent_name?: string;
    task_description?: string;
    agent_type?: string;
    response?: string;
    [key: string]: any;
  };
  source_event: {
    hook_event_type: string;
    payload: Record<string, any>;
  };
}

export interface SessionTimeRange {
  start: number;
  end: number;
  duration: number;
}

export interface SessionIntrospectionResponse {
  sessionId: string;
  timeline: SessionTimelineMessage[];
  messageCount: number;
  timeRange: SessionTimeRange | null;
}