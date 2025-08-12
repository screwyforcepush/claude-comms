import { Database } from 'bun:sqlite';
import type { HookEvent, FilterOptions, UpdateSubagentCompletionRequest, SessionSummary } from './types';

let db: Database;

export function initDatabase(): void {
  db = new Database('events.db');
  
  // Enable WAL mode for better concurrent performance
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  
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
  } catch (error) {
    // If the table doesn't exist yet, the CREATE TABLE above will handle it
  }
  
  // Create indexes for common queries
  db.exec('CREATE INDEX IF NOT EXISTS idx_source_app ON events(source_app)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_id ON events(session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_hook_event_type ON events(hook_event_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_timestamp ON events(timestamp)');
  
  // Create subagent registry table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subagent_registry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      subagent_type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      status TEXT DEFAULT 'pending',
      total_duration_ms INTEGER,
      total_tokens INTEGER,
      total_tool_use_count INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cache_creation_input_tokens INTEGER,
      cache_read_input_tokens INTEGER
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
      db.exec('ALTER TABLE subagent_registry ADD COLUMN status TEXT DEFAULT "pending"');
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
}

export function insertEvent(event: HookEvent): HookEvent {
  const stmt = db.prepare(`
    INSERT INTO events (source_app, session_id, hook_event_type, payload, chat, summary, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const timestamp = event.timestamp || Date.now();
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

export function getRecentEvents(limit: number = 100): HookEvent[] {
  const stmt = db.prepare(`
    SELECT id, source_app, session_id, hook_event_type, payload, chat, summary, timestamp
    FROM events
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  
  const rows = stmt.all(limit) as any[];
  
  return rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    hook_event_type: row.hook_event_type,
    payload: JSON.parse(row.payload),
    chat: row.chat ? JSON.parse(row.chat) : undefined,
    summary: row.summary || undefined,
    timestamp: row.timestamp
  })).reverse();
}

// Subagent communication functions
export function registerSubagent(sessionId: string, name: string, subagentType: string): number {
  const stmt = db.prepare(`
    INSERT INTO subagent_registry (session_id, name, subagent_type, created_at)
    VALUES (?, ?, ?, ?)
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
  
  // Get all messages created after this subagent was registered
  const messagesStmt = db.prepare(`
    SELECT id, sender, message, created_at, notified 
    FROM subagent_messages 
    WHERE created_at > ?
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
    SELECT id, name, subagent_type, created_at, completed_at, status, 
           total_duration_ms, total_tokens, total_tool_use_count, 
           input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens
    FROM subagent_registry 
    WHERE session_id = ?
    ORDER BY created_at DESC
  `);
  
  return stmt.all(sessionId) as any[];
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
        cache_read_input_tokens = COALESCE(?, cache_read_input_tokens)
    WHERE session_id = ? AND name = ?
  `);
  
  const result = stmt.run(
    completionData.completed_at || null,
    completionData.status || null,
    completionData.total_duration_ms || null,
    completionData.total_tokens || null,
    completionData.total_tool_use_count || null,
    completionData.input_tokens || null,
    completionData.output_tokens || null,
    completionData.cache_creation_input_tokens || null,
    completionData.cache_read_input_tokens || null,
    sessionId,
    name
  );
  
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