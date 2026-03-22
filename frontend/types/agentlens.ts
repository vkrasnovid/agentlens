export type EventType =
  | 'session_start'
  | 'api_request'
  | 'api_response'
  | 'tool_call'
  | 'tool_result'
  | 'error'
  | 'session_end'
  | 'message';

export interface SessionEvent {
  type: EventType;
  timestamp?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  tool_name?: string;
  cost_usd?: number;
  content_preview?: string;
  error?: string;
  [key: string]: unknown;
}

export interface SessionSummary {
  session_id: string;  // API returns session_id, not id
  id?: string;         // fallback alias
  name: string;
  created_at: string;
  total_tokens: number;
  total_cost_usd: number;
  event_count: number;
  model_used: string;
  duration_seconds: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
  total_api_requests?: number;
  models_used?: string[];
}

export interface SessionDetail {
  session_id: string;
  events: SessionEvent[];
  metadata?: SessionSummary;
}
