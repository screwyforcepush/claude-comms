import { 
  initDatabase, 
  insertEvent, 
  getFilterOptions, 
  getRecentEvents,
  registerSubagent,
  sendSubagentMessage,
  getUnreadMessages,
  getSubagents,
  getAllSubagentMessages
} from './db';
import type { 
  HookEvent, 
  RegisterSubagentRequest, 
  SendMessageRequest, 
  GetUnreadMessagesRequest 
} from './types';

// Initialize database
initDatabase();

// Store WebSocket clients
const wsClients = new Set<any>();

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
        const event: HookEvent = await req.json();
        
        // Validate required fields
        if (!event.source_app || !event.session_id || !event.hook_event_type || !event.payload) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        // Insert event into database
        const savedEvent = insertEvent(event);
        
        // Broadcast to all WebSocket clients
        const message = JSON.stringify({ type: 'event', data: savedEvent });
        wsClients.forEach(client => {
          try {
            client.send(message);
          } catch (err) {
            // Client disconnected, remove from set
            wsClients.delete(client);
          }
        });
        
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
    
    // GET /events/recent - Get recent events
    if (url.pathname === '/events/recent' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const events = getRecentEvents(limit);
      return new Response(JSON.stringify(events), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // POST /subagents/register - Register a new subagent
    if (url.pathname === '/subagents/register' && req.method === 'POST') {
      try {
        const request: RegisterSubagentRequest = await req.json();
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
        const request: SendMessageRequest = await req.json();
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
        const request: GetUnreadMessagesRequest = await req.json();
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
    
    // GET /subagents/:sessionId - Get all subagents for a session
    if (url.pathname.startsWith('/subagents/') && req.method === 'GET') {
      const sessionId = url.pathname.split('/')[2];
      if (sessionId && sessionId !== 'register' && sessionId !== 'message' && sessionId !== 'unread' && sessionId !== 'messages') {
        const subagents = getSubagents(sessionId);
        return new Response(JSON.stringify(subagents), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // WebSocket upgrade
    if (url.pathname === '/stream') {
      const success = server.upgrade(req);
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
    open(ws) {
      console.log('WebSocket client connected');
      wsClients.add(ws);
      
      // Send recent events on connection
      const events = getRecentEvents(50);
      ws.send(JSON.stringify({ type: 'initial', data: events }));
    },
    
    message(ws, message) {
      // Handle any client messages if needed
      console.log('Received message:', message);
    },
    
    close(ws) {
      console.log('WebSocket client disconnected');
      wsClients.delete(ws);
    },
    
    error(ws, error) {
      console.error('WebSocket error:', error);
      wsClients.delete(ws);
    }
  }
});

console.log(`🚀 Server running on http://localhost:${server.port}`);
console.log(`📊 WebSocket endpoint: ws://localhost:${server.port}/stream`);
console.log(`📮 POST events to: http://localhost:${server.port}/events`);