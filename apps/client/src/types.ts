export interface HookEvent {
  id?: number;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: Record<string, any>;
  chat?: any[];
  summary?: string;
  timestamp?: number;
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