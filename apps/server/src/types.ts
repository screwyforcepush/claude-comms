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

export interface Subagent {
  id?: number;
  session_id: string;
  name: string;
  subagent_type: string;
  created_at: number;
  status?: string;
  completed_at?: number;
  completion_metadata?: any;
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

export interface UpdateSubagentCompletionRequest {
  session_id: string;
  name: string;
  status: string;
  completed_at?: number;
  completion_metadata?: any;
}

export interface SessionSummary {
  session_id: string;
  agent_count: number;
  created_at: number;
}