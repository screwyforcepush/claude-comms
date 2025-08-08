import { Database } from 'bun:sqlite';
import type { HookEvent, FilterOptions } from './types';

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
      created_at INTEGER NOT NULL
    )
  `);
  
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
  
  // Create indexes for subagent tables
  db.exec('CREATE INDEX IF NOT EXISTS idx_subagent_session ON subagent_registry(session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_subagent_name ON subagent_registry(name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_subagent_created ON subagent_registry(created_at)');
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
    SELECT id, name, subagent_type, created_at 
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