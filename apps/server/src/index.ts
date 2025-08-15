import { 
  initDatabase, 
  insertEvent, 
  getFilterOptions, 
  getRecentEvents,
  getRecentEventsWithPriority,
  getSessionEventsWithPriority,
  calculateEventPriority,
  collectPriorityMetrics,
  registerSubagent,
  sendSubagentMessage,
  getUnreadMessages,
  getSubagents,
  getAllSubagentMessages,
  updateSubagentCompletion,
  getSessionsWithAgents,
  getSessionsInTimeWindow,
  getSessionsWithEventsInWindow,
  getSessionDetails,
  getSessionComparison,
  getSessionEvents,
  storeAgentPrompt,
  storeAgentResponse,
  getAgentPromptResponse
} from './db';
import type { 
  HookEvent, 
  RegisterSubagentRequest, 
  SendMessageRequest, 
  GetUnreadMessagesRequest,
  UpdateSubagentCompletionRequest,
  SessionWindowRequest,
  SessionBatchRequest,
  ComparisonRequest,
  MultiSessionWebSocketMessage,
  MultiSessionUpdate,
  UpdateAgentDataRequest,
  ValidationError,
  PriorityEventConfig,
  PriorityWebSocketMessage
} from './types';
import { 
  PRIORITY_EVENT_TYPES,
  DEFAULT_PRIORITY_CONFIG,
  PRIORITY_PROTOCOL_VERSION
} from './types';

// Initialize database
initDatabase();

// Store WebSocket clients
const wsClients = new Set<any>();
const multiSessionClients = new Map<any, Set<string>>(); // WebSocket -> subscribed session IDs

// Priority Event Broadcasting (using existing classification from BellaServer/AdamMigrate)

function broadcastEventWithPriority(savedEvent: HookEvent) {
  const isPriorityEvent = (savedEvent.priority || 0) > 0;
  
  // Create priority-aware message
  const priorityMessage: PriorityWebSocketMessage = {
    type: isPriorityEvent ? 'priority_event' : 'event',
    data: savedEvent,
    priority_info: isPriorityEvent ? {
      total_events: 0, // Will be populated by actual count if needed
      priority_events: 0,
      regular_events: 0,
      retention_window: {
        priority_hours: DEFAULT_PRIORITY_CONFIG.priorityRetentionHours,
        regular_hours: DEFAULT_PRIORITY_CONFIG.regularRetentionHours
      },
      protocol_version: PRIORITY_PROTOCOL_VERSION
    } : undefined
  };
  
  // Create backward-compatible message for legacy clients
  const legacyMessage = JSON.stringify({ type: 'event', data: savedEvent });
  const priorityMessageStr = JSON.stringify(priorityMessage);
  
  // Broadcast to single-session clients (use priority-aware format)
  wsClients.forEach(client => {
    try {
      client.send(priorityMessageStr);
    } catch (err) {
      wsClients.delete(client);
    }
  });
  
  // Broadcast to multi-session clients with session context
  const multiSessionMessage: PriorityWebSocketMessage = {
    ...priorityMessage,
    type: isPriorityEvent ? 'priority_session_event' : 'session_event',
    sessionId: savedEvent.session_id
  };
  
  multiSessionClients.forEach((subscribedSessions, client) => {
    if (subscribedSessions.has(savedEvent.session_id)) {
      try {
        client.send(JSON.stringify(multiSessionMessage));
      } catch (err) {
        multiSessionClients.delete(client);
      }
    }
  });
}

// Create Bun server with HTTP and WebSocket support
const server = Bun.serve({
  port: 4000,
  
  async fetch(req: Request) {
    const url = new URL(req.url);
    
    // Handle CORS
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers });
    }
    
    // POST /events - Receive new events
    if (url.pathname === '/events' && req.method === 'POST') {
      try {
        const eventData = await req.json();
        const event: HookEvent = eventData as HookEvent;
        
        // Validate required fields
        if (!event.source_app || !event.session_id || !event.hook_event_type || !event.payload) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        // Insert event into database
        const savedEvent = insertEvent(event);
        
        // Broadcast event with priority-aware protocol
        broadcastEventWithPriority(savedEvent);
        
        return new Response(JSON.stringify(savedEvent), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error processing event:', error);
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /events/filter-options - Get available filter options
    if (url.pathname === '/events/filter-options' && req.method === 'GET') {
      const options = getFilterOptions();
      return new Response(JSON.stringify(options), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // GET /events/recent - Get recent events (with priority support)
    if (url.pathname === '/events/recent' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const usePriority = url.searchParams.get('priority') === 'true';
      
      let events;
      if (usePriority) {
        events = getRecentEventsWithPriority({ totalLimit: limit });
      } else {
        events = getRecentEvents(limit);
      }
      
      return new Response(JSON.stringify(events), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // GET /events/priority-metrics - Get priority event statistics
    if (url.pathname === '/events/priority-metrics' && req.method === 'GET') {
      try {
        const metrics = collectPriorityMetrics();
        return new Response(JSON.stringify(metrics), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error collecting priority metrics:', error);
        return new Response(JSON.stringify({ error: 'Failed to collect metrics' }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /events/session/:sessionId - Get events for a specific session
    if (url.pathname.startsWith('/events/session/') && req.method === 'GET') {
      try {
        const sessionId = url.pathname.split('/')[3];
        if (!sessionId) {
          return new Response(JSON.stringify({ error: 'Session ID is required' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        // Parse event types filter from query parameters
        const typesParam = url.searchParams.get('types');
        const eventTypes = typesParam ? typesParam.split(',').map(t => t.trim()) : undefined;
        
        // Validate event types if provided
        if (eventTypes && eventTypes.length > 0) {
          const validEventTypes = ['UserPromptSubmit', 'Notification', 'SubagentStart', 'SubagentComplete', 'ToolUse', 'Error'];
          const invalidTypes = eventTypes.filter(type => !validEventTypes.includes(type));
          if (invalidTypes.length > 0) {
            return new Response(JSON.stringify({ 
              error: `Invalid event types: ${invalidTypes.join(', ')}`,
              validTypes: validEventTypes
            }), {
              status: 400,
              headers: { ...headers, 'Content-Type': 'application/json' }
            });
          }
        }
        
        const events = getSessionEvents(sessionId, eventTypes);
        
        return new Response(JSON.stringify({
          sessionId,
          eventTypes: eventTypes || ['all'],
          events: events,
          count: events.length
        }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error fetching session events:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch session events' }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // POST /subagents/register - Register a new subagent
    if (url.pathname === '/subagents/register' && req.method === 'POST') {
      try {
        const requestData = await req.json();
        const request: RegisterSubagentRequest = requestData as RegisterSubagentRequest;
        const id = registerSubagent(request.session_id, request.name, request.subagent_type);
        
        // Broadcast to WebSocket clients
        const message = JSON.stringify({ 
          type: 'subagent_registered', 
          data: { ...request, id } 
        });
        wsClients.forEach(client => {
          try {
            client.send(message);
          } catch (err) {
            wsClients.delete(client);
          }
        });
        
        // Broadcast to multi-session clients
        const multiSessionMessage = JSON.stringify({ 
          type: 'agent_registered', 
          sessionId: request.session_id,
          data: { ...request, id } 
        });
        multiSessionClients.forEach((subscribedSessions, client) => {
          if (subscribedSessions.has(request.session_id)) {
            try {
              client.send(multiSessionMessage);
            } catch (err) {
              multiSessionClients.delete(client);
            }
          }
        });
        
        return new Response(JSON.stringify({ success: true, id }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error registering subagent:', error);
        return new Response(JSON.stringify({ error: 'Failed to register subagent' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // POST /subagents/message - Send a message from a subagent
    if (url.pathname === '/subagents/message' && req.method === 'POST') {
      try {
        const requestData = await req.json();
        const request: SendMessageRequest = requestData as SendMessageRequest;
        const id = sendSubagentMessage(request.sender, request.message);
        
        // Broadcast to WebSocket clients
        const message = JSON.stringify({ 
          type: 'subagent_message', 
          data: request 
        });
        wsClients.forEach(client => {
          try {
            client.send(message);
          } catch (err) {
            wsClients.delete(client);
          }
        });
        
        // Broadcast to all multi-session clients (messages are global)
        const multiSessionMessage = JSON.stringify({ 
          type: 'agent_message', 
          data: request 
        });
        multiSessionClients.forEach((subscribedSessions, client) => {
          try {
            client.send(multiSessionMessage);
          } catch (err) {
            multiSessionClients.delete(client);
          }
        });
        
        return new Response(JSON.stringify({ success: true, id }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error sending subagent message:', error);
        return new Response(JSON.stringify({ error: 'Failed to send message' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // POST /subagents/unread - Get unread messages for a subagent
    if (url.pathname === '/subagents/unread' && req.method === 'POST') {
      try {
        const requestData = await req.json();
        const request: GetUnreadMessagesRequest = requestData as GetUnreadMessagesRequest;
        const messages = getUnreadMessages(request.subagent_name);
        
        return new Response(JSON.stringify({ messages }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error getting unread messages:', error);
        return new Response(JSON.stringify({ error: 'Failed to get messages' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /subagents/messages - Get all messages
    if (url.pathname === '/subagents/messages' && req.method === 'GET') {
      const messages = getAllSubagentMessages();
      return new Response(JSON.stringify(messages), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // POST /subagents/update-completion - Update subagent completion status
    if (url.pathname === '/subagents/update-completion' && req.method === 'POST') {
      try {
        const requestData = await req.json();
        const request: UpdateSubagentCompletionRequest = requestData as UpdateSubagentCompletionRequest;
        const success = updateSubagentCompletion(request.session_id, request.name, {
          completed_at: request.completed_at || Date.now(),
          status: request.status,
          total_duration_ms: request.total_duration_ms,
          total_tokens: request.total_tokens,
          total_tool_use_count: request.total_tool_use_count,
          input_tokens: request.input_tokens,
          output_tokens: request.output_tokens,
          cache_creation_input_tokens: request.cache_creation_input_tokens,
          cache_read_input_tokens: request.cache_read_input_tokens,
          initial_prompt: request.initial_prompt,
          final_response: request.final_response,
          ...(request.completion_metadata || {})
        });
        
        if (success) {
          // Broadcast to WebSocket clients
          const message = JSON.stringify({ 
            type: 'agent_status_update', 
            data: request 
          });
          wsClients.forEach(client => {
            try {
              client.send(message);
            } catch (err) {
              wsClients.delete(client);
            }
          });
          
          // Broadcast to multi-session clients
          const multiSessionMessage = JSON.stringify({ 
            type: 'agent_status_update', 
            sessionId: request.session_id,
            data: request 
          });
          multiSessionClients.forEach((subscribedSessions, client) => {
            if (subscribedSessions.has(request.session_id)) {
              try {
                client.send(multiSessionMessage);
              } catch (err) {
                multiSessionClients.delete(client);
              }
            }
          });
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ error: 'Subagent not found' }), {
            status: 404,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
      } catch (error) {
        console.error('Error updating subagent completion:', error);
        return new Response(JSON.stringify({ error: 'Failed to update completion' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /subagents/sessions - Get all unique sessions with agent counts
    if (url.pathname === '/subagents/sessions' && req.method === 'GET') {
      try {
        const sessions = getSessionsWithAgents();
        return new Response(JSON.stringify(sessions), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error getting sessions:', error);
        return new Response(JSON.stringify({ error: 'Failed to get sessions' }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /subagents/{sessionId}/{name}/full - Get complete agent data including large text fields (MUST come before general GET pattern)
    if (url.pathname.startsWith('/subagents/') && url.pathname.endsWith('/full') && req.method === 'GET') {
      try {
        const pathParts = url.pathname.split('/');
        if (pathParts.length !== 5 || pathParts[4] !== 'full') {
          return new Response(JSON.stringify({ error: 'Invalid path format. Use /subagents/{sessionId}/{name}/full' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        const sessionId = pathParts[2];
        const agentName = pathParts[3];
        
        if (!sessionId || !agentName) {
          return new Response(JSON.stringify({ error: 'sessionId and agentName are required' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        // Get basic agent info
        const agents = getSubagents(sessionId);
        const agent = agents.find(a => a.name === agentName);
        
        if (!agent) {
          return new Response(JSON.stringify({ error: 'Agent not found' }), {
            status: 404,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        // Get prompt/response data (already included in getSubagents now)
        const fullAgentData = {
          ...agent,
          prompt_length: agent.initial_prompt?.length || 0,
          response_length: agent.final_response?.length || 0,
          has_prompt: !!agent.initial_prompt,
          has_response: !!agent.final_response
        };
        
        return new Response(JSON.stringify(fullAgentData), {
          headers: { 
            ...headers, 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
          }
        });
        
      } catch (error) {
        console.error('Error fetching full agent data:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch agent data' }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /subagents/:sessionId - Get all subagents for a session
    if (url.pathname.startsWith('/subagents/') && req.method === 'GET') {
      const sessionId = url.pathname.split('/')[2];
      if (sessionId && sessionId !== 'register' && sessionId !== 'message' && sessionId !== 'unread' && sessionId !== 'messages' && sessionId !== 'update-completion' && sessionId !== 'sessions') {
        const subagents = getSubagents(sessionId);
        return new Response(JSON.stringify(subagents), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /api/sessions/window - Fetch sessions within a time window
    if (url.pathname === '/api/sessions/window' && req.method === 'GET') {
      try {
        const start = parseInt(url.searchParams.get('start') || '0');
        const end = parseInt(url.searchParams.get('end') || Date.now().toString());
        const limit = parseInt(url.searchParams.get('limit') || '50');
        
        if (!start || !end || start >= end) {
          return new Response(JSON.stringify({ error: 'Invalid time window parameters' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        const sessions = getSessionsInTimeWindow(start, end, limit);
        return new Response(JSON.stringify(sessions), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error fetching sessions in time window:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch sessions' }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /api/sessions/events-window - Get sessions that have events within a time window
    if (url.pathname === '/api/sessions/events-window' && req.method === 'GET') {
      try {
        const start = parseInt(url.searchParams.get('start') || '0');
        const end = parseInt(url.searchParams.get('end') || Date.now().toString());
        
        if (!start || !end || start >= end) {
          return new Response(JSON.stringify({ error: 'Invalid time window parameters' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        const sessionIds = getSessionsWithEventsInWindow(start, end);
        return new Response(JSON.stringify({ sessionIds, count: sessionIds.length }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error fetching sessions with events in window:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch sessions' }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // POST /api/sessions/batch - Batch fetch session details with agents
    if (url.pathname === '/api/sessions/batch' && req.method === 'POST') {
      try {
        const requestData = await req.json();
        const request: SessionBatchRequest = requestData as SessionBatchRequest;
        
        if (!request.sessionIds || !Array.isArray(request.sessionIds)) {
          return new Response(JSON.stringify({ error: 'Invalid sessionIds parameter' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        if (request.sessionIds.length > 20) {
          return new Response(JSON.stringify({ error: 'Too many session IDs (max 20)' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        const sessions = getSessionDetails(
          request.sessionIds,
          request.includeAgents || false,
          request.includeMessages || false
        );
        
        return new Response(JSON.stringify(sessions), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error batch fetching session details:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch session details' }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /api/sessions/compare - Session comparison data
    if (url.pathname === '/api/sessions/compare' && req.method === 'GET') {
      try {
        const sessionIdsParam = url.searchParams.get('sessionIds');
        if (!sessionIdsParam) {
          return new Response(JSON.stringify({ error: 'Missing sessionIds parameter' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        const sessionIds = sessionIdsParam.split(',').map(id => id.trim()).filter(id => id);
        if (sessionIds.length === 0 || sessionIds.length > 10) {
          return new Response(JSON.stringify({ error: 'Invalid number of sessionIds (1-10 allowed)' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        const comparison = getSessionComparison(sessionIds);
        return new Response(JSON.stringify(comparison), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error comparing sessions:', error);
        return new Response(JSON.stringify({ error: 'Failed to compare sessions' }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    // PATCH /subagents/{sessionId}/{name} - Update agent prompt, response, or metadata
    if (url.pathname.startsWith('/subagents/') && req.method === 'PATCH') {
      try {
        const pathParts = url.pathname.split('/');
        if (pathParts.length !== 4) {
          return new Response(JSON.stringify({ error: 'Invalid path format. Use /subagents/{sessionId}/{name}' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        const sessionId = pathParts[2];
        const agentName = pathParts[3];
        
        if (!sessionId || !agentName) {
          return new Response(JSON.stringify({ error: 'sessionId and agentName are required' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        const updateRequestData = await req.json();
        const updateData: UpdateAgentDataRequest = updateRequestData as UpdateAgentDataRequest;
        const errors: ValidationError[] = [];
        
        // Validate text field sizes (1MB limit each)
        const MAX_TEXT_SIZE = 1024 * 1024; // 1MB
        
        if (updateData.initial_prompt && updateData.initial_prompt.length > MAX_TEXT_SIZE) {
          errors.push({
            field: 'initial_prompt',
            message: `Prompt exceeds maximum size of ${MAX_TEXT_SIZE} characters`,
            code: 'TEXT_TOO_LONG'
          });
        }
        
        if (updateData.final_response && updateData.final_response.length > MAX_TEXT_SIZE) {
          errors.push({
            field: 'final_response', 
            message: `Response exceeds maximum size of ${MAX_TEXT_SIZE} characters`,
            code: 'TEXT_TOO_LONG'
          });
        }
        
        if (errors.length > 0) {
          return new Response(JSON.stringify({ 
            error: 'Validation failed',
            validation_errors: errors 
          }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        let updatedFields: string[] = [];
        let hasUpdates = false;
        
        // Store prompt if provided
        if (updateData.initial_prompt !== undefined) {
          const success = storeAgentPrompt(sessionId, agentName, updateData.initial_prompt);
          if (success) {
            updatedFields.push('initial_prompt');
            hasUpdates = true;
          }
        }
        
        // Store response if provided
        if (updateData.final_response !== undefined) {
          const success = storeAgentResponse(sessionId, agentName, updateData.final_response);
          if (success) {
            updatedFields.push('final_response');
            hasUpdates = true;
          }
        }
        
        if (!hasUpdates && (updateData.initial_prompt !== undefined || updateData.final_response !== undefined)) {
          return new Response(JSON.stringify({ error: 'Agent not found' }), {
            status: 404,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        // Broadcast update to WebSocket clients if any fields were updated
        if (hasUpdates) {
          const updateMessage = JSON.stringify({ 
            type: 'agent_data_updated', 
            sessionId,
            agentName,
            updatedFields,
            timestamp: Date.now()
          });
          
          multiSessionClients.forEach((subscribedSessions, client) => {
            if (subscribedSessions.has(sessionId)) {
              try {
                client.send(updateMessage);
              } catch (err) {
                multiSessionClients.delete(client);
              }
            }
          });
        }
        
        return new Response(JSON.stringify({ 
          success: true,
          updated_fields: updatedFields,
          message: `Updated ${updatedFields.length} field(s) for agent ${agentName}`
        }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('Error updating agent data:', error);
        
        if (error instanceof SyntaxError) {
          return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({ error: 'Failed to update agent data' }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    
    // WebSocket upgrade - existing single-session stream
    if (url.pathname === '/stream') {
      const success = server.upgrade(req);
      if (success) {
        return undefined;
      }
    }
    
    // WebSocket upgrade - multi-session stream
    if (url.pathname === '/api/sessions/multi-stream') {
      const success = server.upgrade(req, {
        data: { type: 'multi-session' }
      });
      if (success) {
        return undefined;
      }
    }
    
    // Default response
    return new Response('Multi-Agent Observability Server', {
      headers: { ...headers, 'Content-Type': 'text/plain' }
    });
  },
  
  websocket: {
    open(ws: any) {
      const isMultiSession = (ws.data as any)?.type === 'multi-session';
      console.log(`WebSocket client connected: ${isMultiSession ? 'multi-session' : 'single-session'}`);
      
      if (isMultiSession) {
        multiSessionClients.set(ws, new Set());
      } else {
        wsClients.add(ws);
        
        // Send priority-aware initial events on connection for single-session clients
        const config: PriorityEventConfig = {
          totalLimit: parseInt(process.env.EVENT_TOTAL_INITIAL_LIMIT || '150'),
          priorityLimit: parseInt(process.env.EVENT_PRIORITY_INITIAL_LIMIT || '100'),
          regularLimit: parseInt(process.env.EVENT_REGULAR_INITIAL_LIMIT || '50'),
          priorityRetentionHours: parseInt(process.env.EVENT_PRIORITY_RETENTION_HOURS || '24'),
          regularRetentionHours: parseInt(process.env.EVENT_REGULAR_RETENTION_HOURS || '4')
        };
        
        const events = getRecentEventsWithPriority(config);
        
        const initialMessage: PriorityWebSocketMessage = {
          type: 'initial',
          data: events,
          priority_info: {
            total_events: events.length,
            priority_events: events.filter(e => (e.priority || 0) > 0).length,
            regular_events: events.filter(e => (e.priority || 0) === 0).length,
            retention_window: {
              priority_hours: config.priorityRetentionHours,
              regular_hours: config.regularRetentionHours
            },
            protocol_version: PRIORITY_PROTOCOL_VERSION
          }
        };
        
        ws.send(JSON.stringify(initialMessage));
      }
    },
    
    message(ws: any, message: any) {
      const isMultiSession = multiSessionClients.has(ws);
      
      if (isMultiSession) {
        try {
          const parsed: MultiSessionWebSocketMessage = JSON.parse(message.toString());
          const subscribedSessions = multiSessionClients.get(ws)!;
          
          switch (parsed.action) {
            case 'subscribe':
              if (parsed.sessionIds) {
                // Subscribe to multiple sessions
                parsed.sessionIds.forEach(id => subscribedSessions.add(id));
                ws.send(JSON.stringify({ 
                  type: 'subscription_confirmed', 
                  sessionIds: parsed.sessionIds,
                  priority_protocol_supported: true,
                  protocol_version: PRIORITY_PROTOCOL_VERSION
                }));
              } else if (parsed.sessionId) {
                // Subscribe to single session
                subscribedSessions.add(parsed.sessionId);
                ws.send(JSON.stringify({ 
                  type: 'subscription_confirmed', 
                  sessionId: parsed.sessionId,
                  priority_protocol_supported: true,
                  protocol_version: PRIORITY_PROTOCOL_VERSION
                }));
              }
              break;
              
            case 'unsubscribe':
              if (parsed.sessionIds) {
                // Unsubscribe from multiple sessions
                parsed.sessionIds.forEach(id => subscribedSessions.delete(id));
                ws.send(JSON.stringify({ 
                  type: 'unsubscription_confirmed', 
                  sessionIds: parsed.sessionIds 
                }));
              } else if (parsed.sessionId) {
                // Unsubscribe from single session
                subscribedSessions.delete(parsed.sessionId);
                ws.send(JSON.stringify({ 
                  type: 'unsubscription_confirmed', 
                  sessionId: parsed.sessionId 
                }));
              }
              break;
          }
          
          console.log(`Multi-session client ${parsed.action} for sessions:`, 
                     parsed.sessionIds || [parsed.sessionId]);
        } catch (error) {
          console.error('Error parsing multi-session WebSocket message:', error);
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      } else {
        // Handle any client messages for single-session clients
        console.log('Received message:', message);
      }
    },
    
    close(ws: any) {
      const isMultiSession = multiSessionClients.has(ws);
      console.log(`WebSocket client disconnected: ${isMultiSession ? 'multi-session' : 'single-session'}`);
      
      if (isMultiSession) {
        multiSessionClients.delete(ws);
      } else {
        wsClients.delete(ws);
      }
    }
  } as any
});

console.log(`🚀 Server running on http://localhost:${server.port}`);
console.log(`📊 WebSocket endpoint: ws://localhost:${server.port}/stream`);
console.log(`🔄 Multi-session WebSocket: ws://localhost:${server.port}/api/sessions/multi-stream`);
console.log(`📮 POST events to: http://localhost:${server.port}/events`);
console.log(`🎯 Multi-session API endpoints:`);
console.log(`   GET /api/sessions/window - Fetch sessions in time window`);
console.log(`   POST /api/sessions/batch - Batch fetch session details`);
console.log(`   GET /api/sessions/compare - Compare sessions`);
console.log(`   WS /api/sessions/multi-stream - Real-time multi-session updates`);