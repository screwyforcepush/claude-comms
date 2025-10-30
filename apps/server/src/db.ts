import { Database } from 'bun:sqlite';
import type { HookEvent, FilterOptions, UpdateSubagentCompletionRequest, SessionSummary, PriorityEventConfig, PriorityEventMetrics } from './types';
import { PRIORITY_EVENT_TYPES } from './types';

let db: Database;

// Allow dependency injection for testing
export function setDatabase(database: Database): void {
  db = database;
}

export function getDatabase(): Database {
  return db;
}

export function initDatabase(): void {
  // CRITICAL: Prevent test environment from using production database
  const isTestEnv = process.env.NODE_ENV === 'test' || 
                    process.env.BUN_ENV === 'test' ||
                    process.env.npm_lifecycle_event === 'test' ||
                    process.argv.some(arg => arg.includes('test'));
  
  // Use in-memory database for tests, production database for production
  const dbPath = isTestEnv ? ':memory:' : 'events.db';
  
  // Additional safety check: if running from test directory or test file, force memory
  const stack = (new Error()).stack || '';
  const isCalledFromTest = stack.includes('test') || stack.includes('spec');
  
  if (isCalledFromTest && !isTestEnv) {
    console.warn('🚨 WARNING: Test code detected but not in test environment. Forcing memory database for safety.');
    db = new Database(':memory:');
  } else {
    db = new Database(dbPath);
  }
  
  if (isTestEnv || isCalledFromTest) {
    console.log(`🧪 Test environment detected: Using ${db.filename} database for isolation`);
  }
  
  // Performance optimizations for concurrent access and query speed
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA cache_size = -64000'); // 64MB cache
  db.exec('PRAGMA temp_store = MEMORY');
  db.exec('PRAGMA mmap_size = 268435456'); // 256MB memory map
  db.exec('PRAGMA optimize'); // Gather statistics for query optimization
  
  // Create events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_app TEXT NOT NULL,
      session_id TEXT NOT NULL,
      hook_event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      chat TEXT,
      summary TEXT,
      timestamp INTEGER NOT NULL
    )
  `);
  
  // Check if chat column exists, add it if not (for migration)
  try {
    const columns = db.prepare("PRAGMA table_info(events)").all() as any[];
    const hasChatColumn = columns.some((col: any) => col.name === 'chat');
    if (!hasChatColumn) {
      db.exec('ALTER TABLE events ADD COLUMN chat TEXT');
    }
    
    // Check if summary column exists, add it if not (for migration)
    const hasSummaryColumn = columns.some((col: any) => col.name === 'summary');
    if (!hasSummaryColumn) {
      db.exec('ALTER TABLE events ADD COLUMN summary TEXT');
    }
    
    // Priority event bucket migration - add priority columns
    const hasPriorityColumn = columns.some((col: any) => col.name === 'priority');
    if (!hasPriorityColumn) {
      console.log('🔄 Adding priority column to events table...');
      db.exec('ALTER TABLE events ADD COLUMN priority INTEGER DEFAULT 0');
    }
    
    const hasPriorityMetadataColumn = columns.some((col: any) => col.name === 'priority_metadata');
    if (!hasPriorityMetadataColumn) {
      console.log('🔄 Adding priority_metadata column to events table...');
      db.exec('ALTER TABLE events ADD COLUMN priority_metadata TEXT');
    }
    
    // Backfill priority values for existing events if priority column was just added
    if (!hasPriorityColumn) {
      console.log('🔄 Backfilling priority values for existing events...');
      migratePriorityData();
    }
  } catch (error) {
    // If the table doesn't exist yet, the CREATE TABLE above will handle it
  }
  
  // Optimized indexes for performance-critical queries
  db.exec('CREATE INDEX IF NOT EXISTS idx_source_app ON events(source_app)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_id ON events(session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_hook_event_type ON events(hook_event_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_timestamp ON events(timestamp DESC)'); // DESC for recent events
  
  // Additional performance indexes based on query patterns
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_timestamp ON events(session_id, timestamp DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_type_timestamp ON events(hook_event_type, timestamp DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_type ON events(session_id, hook_event_type, timestamp DESC)');
  
  // Priority-based indexes for optimal priority event bucket performance
  db.exec('CREATE INDEX IF NOT EXISTS idx_events_priority_timestamp ON events(priority DESC, timestamp DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_events_session_priority_timestamp ON events(session_id, priority DESC, timestamp DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_events_type_priority_timestamp ON events(hook_event_type, priority DESC, timestamp DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_events_timestamp_priority ON events(timestamp ASC, priority ASC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_events_session_type_priority ON events(session_id, hook_event_type, priority DESC, timestamp DESC)');
  
  // Create subagent registry table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subagent_registry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      subagent_type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      status TEXT DEFAULT 'active',
      total_duration_ms INTEGER,
      total_tokens INTEGER,
      total_tool_use_count INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cache_creation_input_tokens INTEGER,
      cache_read_input_tokens INTEGER,
      initial_prompt TEXT,
      final_response TEXT
    )
  `);
  
  // Check and add new completion tracking columns for migration
  try {
    const columns = db.prepare("PRAGMA table_info(subagent_registry)").all() as any[];
    const columnNames = columns.map((col: any) => col.name);
    
    if (!columnNames.includes('completed_at')) {
      db.exec('ALTER TABLE subagent_registry ADD COLUMN completed_at INTEGER');
    }
    if (!columnNames.includes('status')) {
      db.exec('ALTER TABLE subagent_registry ADD COLUMN status TEXT DEFAULT "active"');
    }
    if (!columnNames.includes('total_duration_ms')) {
      db.exec('ALTER TABLE subagent_registry ADD COLUMN total_duration_ms INTEGER');
    }
    if (!columnNames.includes('total_tokens')) {
      db.exec('ALTER TABLE subagent_registry ADD COLUMN total_tokens INTEGER');
    }
    if (!columnNames.includes('total_tool_use_count')) {
      db.exec('ALTER TABLE subagent_registry ADD COLUMN total_tool_use_count INTEGER');
    }
    if (!columnNames.includes('input_tokens')) {
      db.exec('ALTER TABLE subagent_registry ADD COLUMN input_tokens INTEGER');
    }
    if (!columnNames.includes('output_tokens')) {
      db.exec('ALTER TABLE subagent_registry ADD COLUMN output_tokens INTEGER');
    }
    if (!columnNames.includes('cache_creation_input_tokens')) {
      db.exec('ALTER TABLE subagent_registry ADD COLUMN cache_creation_input_tokens INTEGER');
    }
    if (!columnNames.includes('cache_read_input_tokens')) {
      db.exec('ALTER TABLE subagent_registry ADD COLUMN cache_read_input_tokens INTEGER');
    }
    // Add new prompt and response columns
    if (!columnNames.includes('initial_prompt')) {
      db.exec('ALTER TABLE subagent_registry ADD COLUMN initial_prompt TEXT');
    }
    if (!columnNames.includes('final_response')) {
      db.exec('ALTER TABLE subagent_registry ADD COLUMN final_response TEXT');
    }
  } catch (error) {
    // If the table doesn't exist yet, the CREATE TABLE above will handle it
  }
  
  // Create subagent message ledger table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subagent_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      notified TEXT
    )
  `);
  
  // Add completion columns if they don't exist (for migration)
  try {
    const subagentColumns = db.prepare("PRAGMA table_info(subagent_registry)").all() as any[];
    const hasStatusColumn = subagentColumns.some((col: any) => col.name === 'status');
    if (!hasStatusColumn) {
      db.exec('ALTER TABLE subagent_registry ADD COLUMN status TEXT DEFAULT "active"');
    }
    
    // Migrate existing 'pending' status records to 'active' for backward compatibility
    db.exec('UPDATE subagent_registry SET status = "active" WHERE status = "pending"');
    
    const hasCompletedAtColumn = subagentColumns.some((col: any) => col.name === 'completed_at');
    if (!hasCompletedAtColumn) {
      db.exec('ALTER TABLE subagent_registry ADD COLUMN completed_at INTEGER');
    }
    
    const hasCompletionMetadataColumn = subagentColumns.some((col: any) => col.name === 'completion_metadata');
    if (!hasCompletionMetadataColumn) {
      db.exec('ALTER TABLE subagent_registry ADD COLUMN completion_metadata TEXT');
    }
  } catch (error) {
    // If the table doesn't exist yet, the CREATE TABLE above will handle it
  }

  // Create indexes for subagent tables
  db.exec('CREATE INDEX IF NOT EXISTS idx_subagent_session ON subagent_registry(session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_subagent_name ON subagent_registry(name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_subagent_created ON subagent_registry(created_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_subagent_status ON subagent_registry(status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_subagent_completed ON subagent_registry(completed_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_message_sender ON subagent_messages(sender)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_message_created ON subagent_messages(created_at)');
  
  // Additional indexes for multi-session API performance
  db.exec('CREATE INDEX IF NOT EXISTS idx_subagent_session_created ON subagent_registry(session_id, created_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_subagent_session_status ON subagent_registry(session_id, status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_subagent_created_completed ON subagent_registry(created_at, completed_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_events_session_timestamp ON events(session_id, timestamp)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_created_sender ON subagent_messages(created_at, sender)');
  
  // Add priority columns and indexes if they don't exist (migration support)
  try {
    const columns = db.prepare("PRAGMA table_info(events)").all() as any[];
    const hasPriorityColumn = columns.some((col: any) => col.name === 'priority');
    const hasPriorityMetadataColumn = columns.some((col: any) => col.name === 'priority_metadata');
    
    if (!hasPriorityColumn) {
      db.exec('ALTER TABLE events ADD COLUMN priority INTEGER DEFAULT 0');
    }
    
    if (!hasPriorityMetadataColumn) {
      db.exec('ALTER TABLE events ADD COLUMN priority_metadata TEXT');
    }
    
    // Create priority-optimized indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_priority_timestamp ON events(priority DESC, timestamp DESC)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_session_priority_timestamp ON events(session_id, priority DESC, timestamp DESC)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_type_priority_timestamp ON events(hook_event_type, priority DESC, timestamp DESC)');
  } catch (error) {
    // Tables might not exist yet or migration already applied
  }
}

// Priority Event Classification (imported from types.ts)

export function calculateEventPriority(eventType: string, payload?: any): number {
  // Base priority from event type
  const basePriority = PRIORITY_EVENT_TYPES[eventType as keyof typeof PRIORITY_EVENT_TYPES] || 0;
  
  // Future: Add payload-based priority modifiers
  // if (payload?.urgency === 'critical') return Math.max(basePriority, 2);
  
  return basePriority;
}

export function insertEvent(event: HookEvent): HookEvent {
  // Calculate priority for the event
  const priority = calculateEventPriority(event.hook_event_type, event.payload);
  const priorityMetadata = priority > 0 ? JSON.stringify({
    classified_at: Date.now(),
    classification_reason: 'automatic',
    retention_policy: priority === 1 ? 'extended' : 'standard'
  }) : null;
  
  // Check if priority columns exist
  let hasPriorityColumns = false;
  try {
    const columns = db.prepare("PRAGMA table_info(events)").all() as any[];
    hasPriorityColumns = columns.some((col: any) => col.name === 'priority');
  } catch (error) {
    // Table might not exist yet
  }
  
  const timestamp = event.timestamp || Date.now();
  
  if (hasPriorityColumns) {
    // Use enhanced insert with priority
    const stmt = db.prepare(`
      INSERT INTO events (source_app, session_id, hook_event_type, payload, chat, summary, timestamp, priority, priority_metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      event.source_app,
      event.session_id,
      event.hook_event_type,
      JSON.stringify(event.payload),
      event.chat ? JSON.stringify(event.chat) : null,
      event.summary || null,
      timestamp,
      priority,
      priorityMetadata
    );
    
    return {
      ...event,
      id: result.lastInsertRowid as number,
      timestamp,
      priority,
      priority_metadata: priorityMetadata ? JSON.parse(priorityMetadata) : undefined
    };
  } else {
    // Fallback to original insert for backward compatibility
    const stmt = db.prepare(`
      INSERT INTO events (source_app, session_id, hook_event_type, payload, chat, summary, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      event.source_app,
      event.session_id,
      event.hook_event_type,
      JSON.stringify(event.payload),
      event.chat ? JSON.stringify(event.chat) : null,
      event.summary || null,
      timestamp
    );
    
    return {
      ...event,
      id: result.lastInsertRowid as number,
      timestamp
    };
  }
}

export function getFilterOptions(): FilterOptions {
  const sourceApps = db.prepare('SELECT DISTINCT source_app FROM events ORDER BY source_app').all() as { source_app: string }[];
  const sessionIds = db.prepare('SELECT DISTINCT session_id FROM events ORDER BY session_id DESC LIMIT 100').all() as { session_id: string }[];
  const hookEventTypes = db.prepare('SELECT DISTINCT hook_event_type FROM events ORDER BY hook_event_type').all() as { hook_event_type: string }[];
  
  return {
    source_apps: sourceApps.map(row => row.source_app),
    session_ids: sessionIds.map(row => row.session_id),
    hook_event_types: hookEventTypes.map(row => row.hook_event_type)
  };
}

// Performance optimized query with prepared statement caching
const recentEventsStmt = (() => {
  let stmt: any = null;
  return (limit: number) => {
    if (!stmt) {
      stmt = db.prepare(`
        SELECT id, source_app, session_id, hook_event_type, payload, chat, summary, timestamp
        FROM events
        ORDER BY timestamp DESC
        LIMIT ?
      `);
    }
    return stmt;
  };
})();

export function getRecentEvents(limit: number = 100): HookEvent[] {
  const startTime = performance.now();
  
  const stmt = recentEventsStmt(limit);
  const rows = stmt.all(limit) as any[];
  
  const result = rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    hook_event_type: row.hook_event_type,
    payload: JSON.parse(row.payload),
    chat: row.chat ? JSON.parse(row.chat) : undefined,
    summary: row.summary || undefined,
    timestamp: row.timestamp
  })).reverse();
  
  const queryTime = performance.now() - startTime;
  if (queryTime > 100) {
    console.warn(`Slow query: getRecentEvents took ${queryTime.toFixed(2)}ms for ${rows.length} rows`);
  }
  
  return result;
}

// Subagent communication functions

// Helper function to get last message interaction timestamp for an agent
function getLastMessageInteraction(agentName: string): number | null {
  const stmt = db.prepare(`
    SELECT MAX(created_at) as last_interaction
    FROM subagent_messages 
    WHERE sender = ? OR notified LIKE '%' || ? || '%'
  `);
  
  const result = stmt.get(agentName, agentName) as any;
  return result?.last_interaction || null;
}

// Function to handle agent termination cleanup
function terminateInactiveAgents(currentSessionId: string): void {
  const now = Date.now();
  const oneMinuteAgo = now - (60 * 1000);
  const sixtyMinutesAgo = now - (60 * 60 * 1000);
  
  // Find agents to terminate:
  // 1. Same session agents with no completed_at and created_at > 1 minute ago
  // 2. Any session agents with no completed_at and created_at > 60 minutes ago
  const findAgentsStmt = db.prepare(`
    SELECT id, name, created_at, session_id
    FROM subagent_registry 
    WHERE completed_at IS NULL 
      AND status = 'active'
      AND (
        (session_id = ? AND created_at < ?) OR
        (created_at < ?)
      )
  `);
  
  const agentsToTerminate = findAgentsStmt.all(currentSessionId, oneMinuteAgo, sixtyMinutesAgo) as any[];
  
  // Update each agent's status and completed_at timestamp
  const updateStmt = db.prepare(`
    UPDATE subagent_registry 
    SET status = 'terminated', completed_at = ?
    WHERE id = ?
  `);
  
  agentsToTerminate.forEach(agent => {
    // Try to get last message interaction, fallback to created_at + 10 seconds
    const lastInteraction = getLastMessageInteraction(agent.name);
    const completedAt = (lastInteraction || agent.created_at) + 10000;
    
    updateStmt.run(completedAt, agent.id);
  });
  
  if (agentsToTerminate.length > 0) {
    console.log(`Terminated ${agentsToTerminate.length} inactive agents`);
  }
}

export function registerSubagent(sessionId: string, name: string, subagentType: string): number {
  // First, run termination cleanup for inactive agents
  terminateInactiveAgents(sessionId);
  
  const stmt = db.prepare(`
    INSERT INTO subagent_registry (session_id, name, subagent_type, created_at, status)
    VALUES (?, ?, ?, ?, 'active')
  `);
  
  const result = stmt.run(sessionId, name, subagentType, Date.now());
  return result.lastInsertRowid as number;
}

export function sendSubagentMessage(sender: string, message: any): number {
  const stmt = db.prepare(`
    INSERT INTO subagent_messages (sender, message, created_at, notified)
    VALUES (?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    sender,
    JSON.stringify(message),
    Date.now(),
    JSON.stringify([])
  );
  
  return result.lastInsertRowid as number;
}

export function getUnreadMessages(subagentName: string): any[] {
  // Get the most recent subagent registration with this name
  const subagentStmt = db.prepare(`
    SELECT created_at FROM subagent_registry 
    WHERE name = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);
  
  const subagent = subagentStmt.get(subagentName) as any;
  if (!subagent) {
    return [];
  }
  
  // Get all messages created after or at the same time as this subagent was registered
  const messagesStmt = db.prepare(`
    SELECT id, sender, message, created_at, notified 
    FROM subagent_messages 
    WHERE created_at >= ?
    ORDER BY created_at ASC
  `);
  
  const messages = messagesStmt.all(subagent.created_at) as any[];
  
  // Filter out messages where this subagent is already in the notified list
  // and also filter out messages sent by this subagent itself
  const unreadMessages = messages.filter(msg => {
    const notified = JSON.parse(msg.notified || '[]');
    return !notified.includes(subagentName) && msg.sender !== subagentName;
  });
  
  // Update the notified list for these messages
  const updateStmt = db.prepare(`
    UPDATE subagent_messages 
    SET notified = ? 
    WHERE id = ?
  `);
  
  unreadMessages.forEach(msg => {
    const notified = JSON.parse(msg.notified || '[]');
    notified.push(subagentName);
    updateStmt.run(JSON.stringify(notified), msg.id);
  });
  
  // Return the messages
  return unreadMessages.map(msg => ({
    sender: msg.sender,
    message: JSON.parse(msg.message),
    created_at: msg.created_at
  }));
}

export function getSubagents(sessionId: string) {
  const stmt = db.prepare(`
    SELECT id, session_id, name, subagent_type, created_at, completed_at, status, 
           total_duration_ms, total_tokens, total_tool_use_count, 
           input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens,
           initial_prompt, final_response
    FROM subagent_registry 
    WHERE session_id = ?
    ORDER BY created_at DESC
  `);
  
  const agents = stmt.all(sessionId) as any[];
  
  // Map completed_at to completion_timestamp for client compatibility
  return agents.map(agent => ({
    ...agent,
    completion_timestamp: agent.completed_at
  }));
}

export function getAllSubagentMessages() {
  const stmt = db.prepare(`
    SELECT id, sender, message, created_at, notified 
    FROM subagent_messages 
    ORDER BY created_at DESC
  `);
  
  const messages = stmt.all() as any[];
  
  // Same pattern as getUnreadMessages - parse JSON fields
  return messages.map(msg => ({
    sender: msg.sender,
    message: JSON.parse(msg.message),
    created_at: msg.created_at,
    notified: JSON.parse(msg.notified || '[]')
  }));
}

export function updateSubagentCompletion(
  sessionId: string, 
  name: string, 
  completionData: {
    completed_at?: number;
    status?: string;
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
): boolean {
  const stmt = db.prepare(`
    UPDATE subagent_registry 
    SET completed_at = COALESCE(?, completed_at),
        status = COALESCE(?, status),
        total_duration_ms = COALESCE(?, total_duration_ms),
        total_tokens = COALESCE(?, total_tokens),
        total_tool_use_count = COALESCE(?, total_tool_use_count),
        input_tokens = COALESCE(?, input_tokens),
        output_tokens = COALESCE(?, output_tokens),
        cache_creation_input_tokens = COALESCE(?, cache_creation_input_tokens),
        cache_read_input_tokens = COALESCE(?, cache_read_input_tokens),
        initial_prompt = COALESCE(?, initial_prompt),
        final_response = COALESCE(?, final_response)
    WHERE session_id = ? AND name = ?
  `);
  
  const result = stmt.run(
    completionData.completed_at !== undefined ? completionData.completed_at : null,
    completionData.status !== undefined ? completionData.status : null,
    completionData.total_duration_ms !== undefined ? completionData.total_duration_ms : null,
    completionData.total_tokens !== undefined ? completionData.total_tokens : null,
    completionData.total_tool_use_count !== undefined ? completionData.total_tool_use_count : null,
    completionData.input_tokens !== undefined ? completionData.input_tokens : null,
    completionData.output_tokens !== undefined ? completionData.output_tokens : null,
    completionData.cache_creation_input_tokens !== undefined ? completionData.cache_creation_input_tokens : null,
    completionData.cache_read_input_tokens !== undefined ? completionData.cache_read_input_tokens : null,
    completionData.initial_prompt !== undefined ? completionData.initial_prompt : null,
    completionData.final_response !== undefined ? completionData.final_response : null,
    sessionId,
    name
  );
  
  return result.changes > 0;
}

// Function to update subagent initial prompt
export function updateSubagentPrompt(
  sessionId: string, 
  name: string, 
  prompt: string
): boolean {
  const stmt = db.prepare(`
    UPDATE subagent_registry 
    SET initial_prompt = ?
    WHERE session_id = ? AND name = ?
  `);
  
  const result = stmt.run(prompt, sessionId, name);
  return result.changes > 0;
}

// Function to update subagent final response  
export function updateSubagentResponse(
  sessionId: string, 
  name: string, 
  response: string
): boolean {
  const stmt = db.prepare(`
    UPDATE subagent_registry 
    SET final_response = ?
    WHERE session_id = ? AND name = ?
  `);
  
  const result = stmt.run(response, sessionId, name);
  return result.changes > 0;
}

export function getSessionsWithAgents(): { session_id: string; created_at: number; agent_count: number }[] {
  const stmt = db.prepare(`
    SELECT session_id, MAX(created_at) as created_at, COUNT(*) as agent_count
    FROM subagent_registry 
    GROUP BY session_id 
    ORDER BY created_at DESC
  `);
  
  return stmt.all() as { session_id: string; created_at: number; agent_count: number }[];
}

// Multi-session API functions
export function getSessionsInTimeWindow(start: number, end: number, limit: number = 50): SessionSummary[] {
  const stmt = db.prepare(`
    SELECT 
      session_id, 
      MAX(created_at) as created_at, 
      COUNT(*) as agent_count,
      MIN(created_at) as first_agent_time,
      MAX(COALESCE(completed_at, created_at)) as last_activity
    FROM subagent_registry 
    GROUP BY session_id 
    HAVING MAX(created_at) >= ? AND MAX(created_at) <= ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
  
  return stmt.all(start, end, limit) as SessionSummary[];
}

export function getSessionDetails(sessionIds: string[], includeAgents: boolean = false, includeMessages: boolean = false) {
  const sessionDetails = [];
  
  for (const sessionId of sessionIds) {
    // Get session summary
    const sessionStmt = db.prepare(`
      SELECT 
        session_id,
        MAX(created_at) as created_at,
        COUNT(*) as agent_count,
        MIN(created_at) as first_agent_time,
        MAX(COALESCE(completed_at, created_at)) as last_activity,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) * 1.0 / COUNT(*) as completion_rate
      FROM subagent_registry 
      WHERE session_id = ?
      GROUP BY session_id
    `);
    
    const session = sessionStmt.get(sessionId) as any;
    if (!session) continue;
    
    // Calculate session status
    const statusStmt = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM subagent_registry 
      WHERE session_id = ? 
      GROUP BY status 
      ORDER BY count DESC 
      LIMIT 1
    `);
    const statusResult = statusStmt.get(sessionId) as any;
    
    // Determine overall session status
    let status = 'pending';
    if (statusResult) {
      if (session.completion_rate === 1) status = 'completed';
      else if (session.completion_rate > 0) status = 'active';
      else status = statusResult.status || 'pending';
    }
    
    const detail: any = {
      session_id: session.session_id,
      agent_count: session.agent_count,
      created_at: session.created_at,
      status,
      duration: session.last_activity - session.first_agent_time,
      last_activity: session.last_activity
    };
    
    // Include agents if requested
    if (includeAgents) {
      detail.agents = getSubagents(sessionId);
    }
    
    // Include messages if requested
    if (includeMessages) {
      const messageStmt = db.prepare(`
        SELECT sender, message, created_at 
        FROM subagent_messages 
        WHERE created_at >= ? AND created_at <= ?
        ORDER BY created_at ASC
      `);
      detail.messages = messageStmt.all(session.first_agent_time, session.last_activity)
        .map((msg: any) => ({
          sender: msg.sender,
          message: JSON.parse(msg.message),
          created_at: msg.created_at
        }));
    }
    
    sessionDetails.push(detail);
  }
  
  return sessionDetails;
}

export function getSessionComparison(sessionIds: string[]) {
  const sessionComparisons = [];
  let totalAgents = 0;
  let totalMessages = 0;
  let totalDuration = 0;
  let totalCompletions = 0;
  
  for (const sessionId of sessionIds) {
    const sessionStmt = db.prepare(`
      SELECT 
        session_id,
        COUNT(*) as agent_count,
        MIN(created_at) as first_agent_time,
        MAX(COALESCE(completed_at, created_at)) as last_activity,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) * 1.0 / COUNT(*) as completion_rate
      FROM subagent_registry 
      WHERE session_id = ?
      GROUP BY session_id
    `);
    
    const session = sessionStmt.get(sessionId) as any;
    if (!session) continue;
    
    // Get message count for this session
    const messageStmt = db.prepare(`
      SELECT COUNT(*) as message_count
      FROM subagent_messages 
      WHERE created_at >= ? AND created_at <= ?
    `);
    const messageResult = messageStmt.get(session.first_agent_time, session.last_activity) as any;
    
    const duration = session.last_activity - session.first_agent_time;
    
    const comparison = {
      session_id: session.session_id,
      agent_count: session.agent_count,
      message_count: messageResult?.message_count || 0,
      duration,
      status: session.completion_rate === 1 ? 'completed' : session.completion_rate > 0 ? 'active' : 'pending',
      completion_rate: session.completion_rate,
      created_at: session.first_agent_time
    };
    
    sessionComparisons.push(comparison);
    
    // Accumulate totals for metrics
    totalAgents += session.agent_count;
    totalMessages += comparison.message_count;
    totalDuration += duration;
    totalCompletions += session.completion_rate;
  }
  
  const metrics = {
    total_sessions: sessionComparisons.length,
    total_agents: totalAgents,
    total_messages: totalMessages,
    average_duration: sessionComparisons.length > 0 ? totalDuration / sessionComparisons.length : 0,
    completion_rate: sessionComparisons.length > 0 ? totalCompletions / sessionComparisons.length : 0
  };
  
  return {
    sessions: sessionComparisons,
    metrics
  };
}

// Performance optimized session events query with statement caching
const sessionEventsStmtCache = new Map<string, any>();

function getSessionEventsStmt(eventTypesCount: number): any {
  const cacheKey = `session_events_${eventTypesCount}`;
  let stmt = sessionEventsStmtCache.get(cacheKey);
  
  if (!stmt) {
    let query = `
      SELECT id, source_app, session_id, hook_event_type, payload, chat, summary, timestamp
      FROM events
      WHERE session_id = ?
    `;
    
    if (eventTypesCount > 0) {
      const placeholders = Array(eventTypesCount).fill('?').join(',');
      query += ` AND hook_event_type IN (${placeholders})`;
    }
    
    query += ` ORDER BY timestamp ASC`;
    
    stmt = db.prepare(query);
    sessionEventsStmtCache.set(cacheKey, stmt);
  }
  
  return stmt;
}

export function getSessionEvents(sessionId: string, eventTypes?: string[]): HookEvent[] {
  const startTime = performance.now();
  
  const eventTypesCount = eventTypes?.length || 0;
  const stmt = getSessionEventsStmt(eventTypesCount);
  
  const params = [sessionId, ...(eventTypes || [])];
  const rows = stmt.all(...params) as any[];
  
  const result = rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    hook_event_type: row.hook_event_type,
    payload: JSON.parse(row.payload),
    chat: row.chat ? JSON.parse(row.chat) : undefined,
    summary: row.summary || undefined,
    timestamp: row.timestamp
  }));
  
  const queryTime = performance.now() - startTime;
  if (queryTime > 80) {
    console.warn(`Slow session query: ${queryTime.toFixed(2)}ms for session ${sessionId} with ${rows.length} events`);
  }
  
  return result;
}

// New function to get sessions that have events within a time window
export function getSessionsWithEventsInWindow(start: number, end: number): string[] {
  const stmt = db.prepare(`
    SELECT DISTINCT session_id
    FROM events
    WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp DESC
  `);
  
  const rows = stmt.all(start, end) as { session_id: string }[];
  return rows.map(row => row.session_id);
}

// Priority Event Bucket System Implementation

// Migration function to backfill priority values for existing events
function migratePriorityData(): void {
  const priorityEventTypes = Object.keys(PRIORITY_EVENT_TYPES);
  let totalUpdated = 0;
  
  for (const eventType of priorityEventTypes) {
    const priority = PRIORITY_EVENT_TYPES[eventType as keyof typeof PRIORITY_EVENT_TYPES];
    const metadata = JSON.stringify({
      classified_at: Date.now(),
      classification_reason: 'migration_backfill',
      retention_policy: 'extended'
    });
    
    const updateStmt = db.prepare(`
      UPDATE events SET priority = ?, priority_metadata = ?
      WHERE hook_event_type = ? AND priority = 0
    `);
    
    try {
      const result = updateStmt.run(priority, metadata, eventType);
      totalUpdated += result.changes;
      console.log(`✓ Updated ${result.changes} ${eventType} events to priority ${priority}`);
    } catch (error) {
      console.error(`✗ Error updating ${eventType} events:`, error);
    }
  }
  
  console.log(`🎯 Migration completed: ${totalUpdated} events updated with priority classification`);
}

// Default priority configuration from environment variables
function getDefaultPriorityConfig(): PriorityEventConfig {
  return {
    totalLimit: parseInt(process.env.EVENT_TOTAL_INITIAL_LIMIT || '150'),
    priorityLimit: parseInt(process.env.EVENT_PRIORITY_INITIAL_LIMIT || '100'),
    regularLimit: parseInt(process.env.EVENT_REGULAR_INITIAL_LIMIT || '50'),
    priorityRetentionHours: parseInt(process.env.EVENT_PRIORITY_RETENTION_HOURS || '24'),
    regularRetentionHours: parseInt(process.env.EVENT_REGULAR_RETENTION_HOURS || '4')
  };
}

// Intelligent event limiting that preserves priority events
function intelligentEventLimiting(events: HookEvent[], totalLimit: number): HookEvent[] {
  if (events.length <= totalLimit) return events;
  
  // Separate priority and regular events
  const priorityEvents = events.filter(e => (e as any).priority > 0);
  const regularEvents = events.filter(e => (e as any).priority === 0);
  
  // Always preserve priority events within reason (70% allocation)
  const maxPriorityPreserve = Math.floor(totalLimit * 0.7);
  const preservedPriority = priorityEvents.slice(-maxPriorityPreserve);
  
  // Fill remaining space with regular events
  const remainingSpace = totalLimit - preservedPriority.length;
  const preservedRegular = regularEvents.slice(-remainingSpace);
  
  return [...preservedPriority, ...preservedRegular]
    .sort((a, b) => a.timestamp! - b.timestamp!);
}

// Map database row to HookEvent with priority fields
function mapDatabaseEventToHookEvent(row: any): HookEvent {
  return {
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    hook_event_type: row.hook_event_type,
    payload: JSON.parse(row.payload),
    chat: row.chat ? JSON.parse(row.chat) : undefined,
    summary: row.summary || undefined,
    timestamp: row.timestamp,
    priority: row.priority,
    priority_metadata: row.priority_metadata ? JSON.parse(row.priority_metadata) : undefined
  };
}

// Enhanced insertEvent function with automatic priority classification
export function insertEventWithPriority(event: HookEvent): HookEvent {
  const priority = calculateEventPriority(event.hook_event_type, event.payload);
  const priorityMetadata = priority > 0 ? JSON.stringify({
    classified_at: Date.now(),
    classification_reason: 'automatic',
    retention_policy: priority === 1 ? 'extended' : 'standard'
  }) : null;
  
  const stmt = db.prepare(`
    INSERT INTO events (
      source_app, session_id, hook_event_type, payload, 
      chat, summary, timestamp, priority, priority_metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const timestamp = event.timestamp || Date.now();
  const result = stmt.run(
    event.source_app,
    event.session_id,
    event.hook_event_type,
    JSON.stringify(event.payload),
    event.chat ? JSON.stringify(event.chat) : null,
    event.summary || null,
    timestamp,
    priority,
    priorityMetadata
  );
  
  return {
    ...event,
    id: result.lastInsertRowid as number,
    timestamp,
    priority,
    priority_metadata: priorityMetadata ? JSON.parse(priorityMetadata) : undefined
  };
}

// Core dual-bucket priority event retrieval function
export function getRecentEventsWithPriority(
  config: Partial<PriorityEventConfig> = {}
): HookEvent[] {
  const fullConfig = { ...getDefaultPriorityConfig(), ...config };
  const now = Date.now();
  const priorityCutoff = now - (fullConfig.priorityRetentionHours * 60 * 60 * 1000);
  const regularCutoff = now - (fullConfig.regularRetentionHours * 60 * 60 * 1000);
  
  // Get priority events with extended retention
  const priorityStmt = db.prepare(`
    SELECT id, source_app, session_id, hook_event_type, payload, 
           chat, summary, timestamp, priority, priority_metadata
    FROM events
    WHERE priority > 0 AND timestamp >= ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  
  // Get regular events with standard retention
  const regularStmt = db.prepare(`
    SELECT id, source_app, session_id, hook_event_type, payload, 
           chat, summary, timestamp, priority, priority_metadata
    FROM events
    WHERE priority = 0 AND timestamp >= ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  
  const priorityEvents = priorityStmt.all(priorityCutoff, fullConfig.priorityLimit) as any[];
  const regularEvents = regularStmt.all(regularCutoff, fullConfig.regularLimit) as any[];
  
  // Merge and sort by timestamp, respecting total limit
  const allEvents = [...priorityEvents, ...regularEvents]
    .map(mapDatabaseEventToHookEvent)
    .sort((a, b) => a.timestamp! - b.timestamp!);
  
  // Apply intelligent limiting that preserves priority events
  return intelligentEventLimiting(allEvents, fullConfig.totalLimit);
}

// Session-specific priority event queries
export function getSessionEventsWithPriority(
  sessionId: string, 
  eventTypes?: string[],
  priorityConfig?: Partial<PriorityEventConfig>
): HookEvent[] {
  const config = { ...getDefaultPriorityConfig(), ...priorityConfig };
  
  let baseQuery = `
    SELECT id, source_app, session_id, hook_event_type, payload, 
           chat, summary, timestamp, priority, priority_metadata
    FROM events
    WHERE session_id = ?
  `;
  
  const params: any[] = [sessionId];
  
  if (eventTypes && eventTypes.length > 0) {
    const placeholders = eventTypes.map(() => '?').join(',');
    baseQuery += ` AND hook_event_type IN (${placeholders})`;
    params.push(...eventTypes);
  }
  
  // Apply retention windows for priority vs regular events
  const now = Date.now();
  const priorityCutoff = now - (config.priorityRetentionHours * 60 * 60 * 1000);
  const regularCutoff = now - (config.regularRetentionHours * 60 * 60 * 1000);
  
  baseQuery += ` 
    AND (
      (priority > 0 AND timestamp >= ?) OR 
      (priority = 0 AND timestamp >= ?)
    )
    ORDER BY timestamp ASC
  `;
  
  params.push(priorityCutoff, regularCutoff);
  
  const stmt = db.prepare(baseQuery);
  const rows = stmt.all(...params) as any[];
  
  return rows.map(mapDatabaseEventToHookEvent);
}

// Backward-compatible wrapper that falls back to original implementation
export function getRecentEventsWithFallback(limit: number = 100): HookEvent[] {
  try {
    // Check if priority columns exist by attempting a priority query
    const testStmt = db.prepare('SELECT priority FROM events LIMIT 1');
    testStmt.get();
    
    // If we get here, priority columns exist - use priority implementation
    return getRecentEventsWithPriority({
      totalLimit: limit,
      priorityLimit: Math.floor(limit * 0.7),
      regularLimit: Math.floor(limit * 0.3),
      priorityRetentionHours: 24,
      regularRetentionHours: 4
    });
  } catch (error) {
    // Fallback to original implementation if priority columns don't exist
    console.warn('Priority columns not found, falling back to original implementation');
    return getRecentEvents(limit);
  }
}

// New functions for agent prompt/response storage

export function storeAgentPrompt(sessionId: string, agentName: string, prompt: string): boolean {
  const stmt = db.prepare(`
    UPDATE subagent_registry 
    SET initial_prompt = ?
    WHERE session_id = ? AND name = ?
  `);
  
  const result = stmt.run(prompt, sessionId, agentName);
  return result.changes > 0;
}

export function storeAgentResponse(sessionId: string, agentName: string, response: string): boolean {
  const stmt = db.prepare(`
    UPDATE subagent_registry 
    SET final_response = ?
    WHERE session_id = ? AND name = ?
  `);
  
  const result = stmt.run(response, sessionId, agentName);
  return result.changes > 0;
}

export function getAgentPromptResponse(sessionId: string, agentName: string): { initial_prompt?: string; final_response?: string } | null {
  const stmt = db.prepare(`
    SELECT initial_prompt, final_response
    FROM subagent_registry 
    WHERE session_id = ? AND name = ?
  `);
  
  const result = stmt.get(sessionId, agentName) as any;
  return result || null;
}

// Priority Event System Validation and Migration Functions

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  stats: any;
}

export interface PerformanceResult {
  performant: boolean;
  issues: string[];
  metrics: any;
}

// Validate priority implementation integrity
export function validatePriorityImplementation(): ValidationResult {
  const issues: string[] = [];
  let stats: any = {};
  
  try {
    // Check schema structure
    const columns = db.prepare("PRAGMA table_info(events)").all() as any[];
    const hasPriority = columns.some((col: any) => col.name === 'priority');
    const hasPriorityMetadata = columns.some((col: any) => col.name === 'priority_metadata');
    
    if (!hasPriority) issues.push('Missing priority column');
    if (!hasPriorityMetadata) issues.push('Missing priority_metadata column');
    
    // Check indexes
    const indexes = db.prepare("PRAGMA index_list(events)").all() as any[];
    const priorityIndexExists = indexes.some((idx: any) => 
      idx.name === 'idx_events_priority_timestamp'
    );
    
    if (!priorityIndexExists) issues.push('Missing priority timestamp index');
    
    // Validate data integrity
    const priorityStats = db.prepare(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN priority > 0 THEN 1 END) as priority_events,
        COUNT(CASE WHEN priority = 0 THEN 1 END) as regular_events,
        AVG(CASE WHEN priority > 0 THEN 1.0 ELSE 0.0 END) as priority_ratio
      FROM events
    `).get() as any;
    
    stats = priorityStats;
    
    if (priorityStats && priorityStats.total_events > 0 && priorityStats.priority_events === 0) {
      issues.push('No priority events found - classification may not be working');
    }
    
    // Check for orphaned priority metadata
    const orphanedMetadata = db.prepare(`
      SELECT COUNT(*) as orphaned_count
      FROM events
      WHERE priority = 0 AND priority_metadata IS NOT NULL
    `).get() as any;
    
    if (orphanedMetadata && orphanedMetadata.orphaned_count > 0) {
      issues.push(`Found ${orphanedMetadata.orphaned_count} regular events with priority metadata`);
    }
    
  } catch (error: any) {
    issues.push(`Validation error: ${error.message}`);
  }
  
  return {
    valid: issues.length === 0,
    issues,
    stats
  };
}

// Validate performance of priority queries
export function validatePriorityPerformance(): PerformanceResult {
  const results: any = {};
  const performanceIssues: string[] = [];
  
  try {
    // Test priority query performance
    const startTime = Date.now();
    const events = getRecentEventsWithPriority({
      totalLimit: 100,
      priorityLimit: 70,
      regularLimit: 30,
      priorityRetentionHours: 24,
      regularRetentionHours: 4
    });
    const queryTime = Date.now() - startTime;
    
    results.queryTime = queryTime;
    results.eventCount = events.length;
    results.priorityCount = events.filter(e => (e as any).priority > 0).length;
    
    // Performance criteria
    const maxAcceptableQueryTime = 100; // 100ms
    
    if (queryTime > maxAcceptableQueryTime) {
      performanceIssues.push(`Query time ${queryTime}ms exceeds ${maxAcceptableQueryTime}ms limit`);
    }
    
    // Test session-specific query performance
    const sessionStartTime = Date.now();
    const sessionEvents = getSessionEventsWithPriority('test-session', ['UserPromptSubmit', 'Notification']);
    const sessionQueryTime = Date.now() - sessionStartTime;
    
    results.sessionQueryTime = sessionQueryTime;
    results.sessionEventCount = sessionEvents.length;
    
    if (sessionQueryTime > maxAcceptableQueryTime) {
      performanceIssues.push(`Session query time ${sessionQueryTime}ms exceeds ${maxAcceptableQueryTime}ms limit`);
    }
    
  } catch (error: any) {
    performanceIssues.push(`Performance test error: ${error.message}`);
  }
  
  return {
    performant: performanceIssues.length === 0,
    issues: performanceIssues,
    metrics: results
  };
}

// Rollback priority schema changes (for emergency use)
export function rollbackPriorityMigration(): { success: boolean; message: string; backupCount?: number } {
  try {
    console.log('🔄 Starting priority schema rollback...');
    
    // First, backup existing data with priority information
    const backupStmt = db.prepare(`
      SELECT id, priority, priority_metadata
      FROM events
      WHERE priority > 0 OR priority_metadata IS NOT NULL
    `);
    const priorityData = backupStmt.all();
    
    console.log(`📦 Backing up ${priorityData.length} events with priority data...`);
    
    // Store backup in a temporary table
    db.exec(`
      CREATE TABLE IF NOT EXISTS priority_backup (
        event_id INTEGER,
        priority INTEGER,
        priority_metadata TEXT,
        backed_up_at INTEGER
      )
    `);
    
    const insertBackupStmt = db.prepare(`
      INSERT INTO priority_backup (event_id, priority, priority_metadata, backed_up_at)
      VALUES (?, ?, ?, ?)
    `);
    
    const backupTime = Date.now();
    for (const row of priorityData) {
      insertBackupStmt.run((row as any).id, (row as any).priority, (row as any).priority_metadata, backupTime);
    }
    
    // Drop priority-specific indexes
    const priorityIndexes = [
      'idx_events_priority_timestamp',
      'idx_events_session_priority_timestamp', 
      'idx_events_type_priority_timestamp',
      'idx_events_timestamp_priority',
      'idx_events_session_type_priority'
    ];
    
    for (const indexName of priorityIndexes) {
      try {
        db.exec(`DROP INDEX IF EXISTS ${indexName}`);
        console.log(`✓ Dropped index: ${indexName}`);
      } catch (error) {
        console.warn(`⚠️ Could not drop index ${indexName}:`, error);
      }
    }
    
    // Note: SQLite doesn't support dropping columns directly
    // In production, you would need to recreate the table without priority columns
    // For now, we'll just set all priority values to 0 and clear metadata
    db.exec(`
      UPDATE events 
      SET priority = 0, priority_metadata = NULL
      WHERE priority > 0 OR priority_metadata IS NOT NULL
    `);
    
    console.log('🎯 Priority schema rollback completed successfully');
    
    return {
      success: true,
      message: `Rollback completed. ${priorityData.length} priority events backed up to priority_backup table.`,
      backupCount: priorityData.length
    };
    
  } catch (error: any) {
    console.error('✗ Priority rollback failed:', error);
    return {
      success: false,
      message: `Rollback failed: ${error.message}`
    };
  }
}

// Restore priority data from backup (in case rollback needs to be undone)
export function restorePriorityFromBackup(): { success: boolean; message: string; restoredCount?: number } {
  try {
    console.log('🔄 Starting priority data restoration from backup...');
    
    // Check if backup table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='priority_backup'
    `).get();
    
    if (!tableExists) {
      return {
        success: false,
        message: 'No backup table found. Cannot restore priority data.'
      };
    }
    
    // Get all backup data
    const backupData = db.prepare(`
      SELECT event_id, priority, priority_metadata
      FROM priority_backup
      ORDER BY backed_up_at DESC
    `).all() as any[];
    
    if (backupData.length === 0) {
      return {
        success: false,
        message: 'Backup table is empty. No data to restore.'
      };
    }
    
    // Restore priority data
    const restoreStmt = db.prepare(`
      UPDATE events 
      SET priority = ?, priority_metadata = ?
      WHERE id = ?
    `);
    
    let restoredCount = 0;
    for (const backup of backupData) {
      try {
        const result = restoreStmt.run(backup.priority, backup.priority_metadata, backup.event_id);
        if (result.changes > 0) {
          restoredCount++;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to restore event ${backup.event_id}:`, error);
      }
    }
    
    // Recreate priority indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_priority_timestamp ON events(priority DESC, timestamp DESC)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_session_priority_timestamp ON events(session_id, priority DESC, timestamp DESC)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_type_priority_timestamp ON events(hook_event_type, priority DESC, timestamp DESC)');
    
    console.log(`🎯 Priority data restoration completed: ${restoredCount} events restored`);
    
    return {
      success: true,
      message: `Restoration completed. ${restoredCount} events restored from backup.`,
      restoredCount
    };
    
  } catch (error: any) {
    console.error('✗ Priority restoration failed:', error);
    return {
      success: false,
      message: `Restoration failed: ${error.message}`
    };
  }
}

// Priority event metrics for monitoring (interface imported from types.ts)

export function collectPriorityMetrics(): PriorityEventMetrics {
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  const fourHoursAgo = now - (4 * 60 * 60 * 1000);
  
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_events,
      COUNT(CASE WHEN priority > 0 THEN 1 END) as priority_events,
      COUNT(CASE WHEN priority = 0 THEN 1 END) as regular_events,
      COUNT(CASE WHEN priority > 0 AND timestamp >= ? THEN 1 END) as priority_retained,
      COUNT(CASE WHEN priority = 0 AND timestamp >= ? THEN 1 END) as regular_retained
    FROM events
  `).get(oneDayAgo, fourHoursAgo) as any;
  
  // Check classification accuracy by looking at known priority event types
  const classificationStats = db.prepare(`
    SELECT 
      COUNT(*) as total_classified,
      COUNT(CASE 
        WHEN (hook_event_type IN ('UserPromptSubmit', 'Notification', 'Stop', 'SubagentStop', 'SubagentComplete') AND priority > 0)
          OR (hook_event_type NOT IN ('UserPromptSubmit', 'Notification', 'Stop', 'SubagentStop', 'SubagentComplete') AND priority = 0)
        THEN 1 
      END) as correctly_classified
    FROM events
  `).get() as any;
  
  return {
    totalEvents: stats?.total_events || 0,
    priorityEvents: stats?.priority_events || 0,
    regularEvents: stats?.regular_events || 0,
    priorityPercentage: stats?.total_events > 0 ? (stats.priority_events / stats.total_events) * 100 : 0,
    bucketDistribution: {
      priority: stats?.priority_events || 0,
      regular: stats?.regular_events || 0
    },
    retentionEffectiveness: {
      priorityRetained: stats?.priority_retained || 0,
      regularRetained: stats?.regular_retained || 0
    },
    classificationAccuracy: {
      correctlyClassified: classificationStats?.correctly_classified || 0,
      totalClassified: classificationStats?.total_classified || 0,
      accuracy: classificationStats?.total_classified > 0 
        ? (classificationStats.correctly_classified / classificationStats.total_classified) * 100 
        : 0
    }
  };
}

// Session Introspection Functions (WP1)

// High-performance introspection query with optimized statement caching
const introspectionStmtCache = new Map<string, any>();

function getIntrospectionStmt(hasEventTypes: boolean): any {
  const cacheKey = `introspection_${hasEventTypes}`;
  let stmt = introspectionStmtCache.get(cacheKey);
  
  if (!stmt) {
    let query = `
      SELECT id, source_app, session_id, hook_event_type, payload, chat, summary, timestamp, priority, priority_metadata
      FROM events
      WHERE session_id = ? 
      AND (
        hook_event_type = 'UserPromptSubmit' 
        OR (
          hook_event_type = 'PreToolUse' 
          AND json_extract(payload, '$.tool_name') = 'Task'
        )
        OR (
          hook_event_type = 'PostToolUse' 
          AND json_extract(payload, '$.tool_name') = 'Task'
        )
      )
    `;
    
    if (hasEventTypes) {
      // Dynamic placeholder generation for event types
      query += ` AND hook_event_type IN (?, ?, ?, ?, ?)`; // Support up to 5 event types
    }
    
    query += ` ORDER BY timestamp ASC`;
    
    stmt = db.prepare(query);
    introspectionStmtCache.set(cacheKey, stmt);
  }
  
  return stmt;
}

export function getSessionIntrospectionEvents(sessionId: string, eventTypes?: string[]): HookEvent[] {
  if (!sessionId || sessionId.trim() === '') {
    return [];
  }

  const startTime = performance.now();
  
  const hasEventTypes = eventTypes && eventTypes.length > 0 ? true : false;
  const stmt = getIntrospectionStmt(hasEventTypes);
  
  let params: any[] = [sessionId];
  if (hasEventTypes) {
    // Pad with nulls for unused placeholders
    const paddedEventTypes = [...(eventTypes || [])].slice(0, 5);
    while (paddedEventTypes.length < 5) paddedEventTypes.push('');
    params.push(...paddedEventTypes);
  }
  
  const rows = stmt.all(...params) as any[];
  
  const result = rows
    .filter(row => !hasEventTypes || !eventTypes || eventTypes.includes(row.hook_event_type))
    .map(row => ({
      id: row.id,
      source_app: row.source_app,
      session_id: row.session_id,
      hook_event_type: row.hook_event_type,
      payload: JSON.parse(row.payload),
      chat: row.chat ? JSON.parse(row.chat) : undefined,
      summary: row.summary || undefined,
      timestamp: row.timestamp,
      priority: row.priority,
      priority_metadata: row.priority_metadata ? JSON.parse(row.priority_metadata) : undefined
    }));
  
  const queryTime = performance.now() - startTime;
  if (queryTime > 60) {
    console.warn(`Slow introspection query: ${queryTime.toFixed(2)}ms for session ${sessionId} with ${result.length} events`);
  }
  
  return result;
}

// Helper function to get subagent messages for a session
function getSubagentMessagesForSession(sessionId: string, events: HookEvent[]): any[] {
  if (events.length === 0) return [];
  
  // Extract time range from events
  const timestamps = events.map(e => e.timestamp).filter(Boolean) as number[];
  if (timestamps.length === 0) return [];
  
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  
  // Extract unique agent names from events
  const agentNames = new Set<string>();
  events.forEach(event => {
    if (event.hook_event_type === 'PreToolUse' || event.hook_event_type === 'PostToolUse') {
      const description = event.payload?.tool_input?.description || '';
      const agentNameMatch = description.match(/^([^:]+):/);
      if (agentNameMatch) {
        agentNames.add(agentNameMatch[1].trim());
      }
    }
  });
  
  if (agentNames.size === 0) return [];
  
  // Query subagent_messages table
  const stmt = db.prepare(`
    SELECT id, sender, message, created_at, notified
    FROM subagent_messages
    WHERE created_at >= ? AND created_at <= ?
    ORDER BY created_at ASC
  `);
  
  const messages = stmt.all(minTime, maxTime) as any[];
  
  // Filter messages by sender and transform to timeline format
  return messages
    .filter(msg => agentNames.has(msg.sender))
    .map(msg => {
      const messageContent = JSON.parse(msg.message);
      const notified = JSON.parse(msg.notified || '[]');
      
      // Look up agent type from subagent_registry
      const agentStmt = db.prepare(`
        SELECT subagent_type FROM subagent_registry 
        WHERE session_id = ? AND name = ?
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const agent = agentStmt.get(sessionId, msg.sender) as any;
      const agentType = agent?.subagent_type || 'unknown';
      
      return {
        sender: `${msg.sender} (${agentType})`,
        recipient: 'Team',
        content: typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent),
        metadata: {
          timestamp: msg.created_at,
          read_by: notified
        }
      };
    });
}

export function transformToMessageHistory(events: HookEvent[], sessionId: string): any {
  // Transform hook events to timeline messages
  const eventMessages = events.flatMap(event => {
    if (event.hook_event_type === 'UserPromptSubmit') {
      return [{
        sender: 'User',
        recipient: 'Orchestrator',
        content: event.payload?.prompt || '',
        metadata: {
          timestamp: event.timestamp!
        }
      }];
    } else if (event.hook_event_type === 'PreToolUse' && event.payload?.tool_name === 'Task') {
      // PreToolUse: Orchestrator assigns task to agent (actual task assignment time)
      const description = event.payload?.tool_input?.description || '';
      const prompt = event.payload?.tool_input?.prompt || '';
      const agentType = event.payload?.tool_input?.subagent_type || 'unknown';
      
      // Parse agent name from description (format: "AgentName: task description")
      const agentNameMatch = description.match(/^([^:]+):/);
      const agentName = agentNameMatch ? agentNameMatch[1].trim() : 'Unknown Agent';
      
      return [{
        sender: 'Orchestrator',
        recipient: `${agentName} (${agentType})`,
        content: prompt, // The full prompt is the message body
        metadata: {
          timestamp: event.timestamp!, // This is the actual task assignment time
          task_description: description
        }
      }];
    } else if (event.hook_event_type === 'PostToolUse' && event.payload?.tool_name === 'Task') {
      // PostToolUse: Agent responds (task completion time)
      if (event.payload?.tool_response?.content) {
        const description = event.payload?.tool_input?.description || '';
        const agentType = event.payload?.tool_input?.subagent_type || 'unknown';
        
        // Parse agent name from description
        const agentNameMatch = description.match(/^([^:]+):/);
        const agentName = agentNameMatch ? agentNameMatch[1].trim() : 'Unknown Agent';
        
        const responseText = event.payload.tool_response.content[0]?.text || 'Task completed';
        const totalDurationMs = event.payload.tool_response.totalDurationMs || 0;
        const totalTokens = event.payload.tool_response.totalTokens || 0;
        const totalToolUseCount = event.payload.tool_response.totalToolUseCount || 0;
        
        return [{
          sender: `${agentName} (${agentType})`,
          recipient: 'Orchestrator',
          content: responseText, // The response text is the message body
          metadata: {
            timestamp: event.timestamp!, // This is the actual task completion time
            duration_minutes: Math.round(totalDurationMs / 60000 * 10) / 10, // Round to 1 decimal
            cost: Math.round(totalTokens / 1000), // Tokens/1000 rounded
            effort: totalToolUseCount
          }
        }];
      }
      return []; // No response content, skip this event
    }
    
    // Skip any unexpected event types
    return [];
  });
  
  // Get subagent messages for this session
  const subagentMessages = getSubagentMessagesForSession(sessionId, events);
  
  // Merge and sort all messages by timestamp
  const timeline = [...eventMessages, ...subagentMessages].sort((a, b) => {
    const timeA = a.metadata?.timestamp || 0;
    const timeB = b.metadata?.timestamp || 0;
    return timeA - timeB;
  });
  
  // Calculate session duration in minutes
  let sessionDurationMinutes = 0;
  if (timeline.length > 0) {
    const timestamps = timeline.map(msg => msg.metadata.timestamp).sort((a, b) => a - b);
    const start = timestamps[0];
    const end = timestamps[timestamps.length - 1];
    sessionDurationMinutes = Math.round((end - start) / 60000 * 10) / 10; // Round to 1 decimal
  }
  
  return {
    sessionId,
    timeline,
    messageCount: timeline.length,
    sessionDurationMinutes
  };
}