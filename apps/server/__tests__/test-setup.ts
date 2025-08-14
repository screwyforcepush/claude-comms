/**
 * Test Setup Utility - Provides isolated test environments
 * Fixes database state pollution by ensuring each test gets clean state
 */

import { Database } from 'bun:sqlite';
import { setDatabase, initDatabase } from '../src/db';

/**
 * Creates an isolated in-memory database for testing
 */
function createTestDatabase(): Database {
  const db = new Database(':memory:');
  
  // Enable WAL mode for better concurrent performance
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  
  // Initialize all required tables and indexes
  initTestSchema(db);
  
  return db;
}

/**
 * Initializes all database tables and indexes for test database
 */
function initTestSchema(db: Database): void {
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
}

let testDatabases: Database[] = [];

/**
 * Sets up isolated test database for each test
 * Call this in beforeEach to ensure test isolation
 */
export function setupTestDatabase(): Database {
  const testDb = createTestDatabase();
  testDatabases.push(testDb);
  
  // Inject the test database into the db module
  setDatabase(testDb);
  
  return testDb;
}

/**
 * Cleans up test databases
 * Call this in afterEach or afterAll to prevent memory leaks
 */
export function teardownTestDatabase(): void {
  // Close all test databases
  testDatabases.forEach(db => {
    try {
      db.close();
    } catch (e) {
      // Ignore close errors
    }
  });
  testDatabases = [];
}

/**
 * Completely clears all data from current test database
 * Alternative to creating new database - useful for tests that need persistence
 */
export function clearTestDatabase(): void {
  const db = testDatabases[testDatabases.length - 1];
  if (!db) return;
  
  // Clear all data but preserve schema
  db.exec('DELETE FROM subagent_messages');
  db.exec('DELETE FROM subagent_registry');  
  db.exec('DELETE FROM events');
  
  // Reset auto-increment counters
  db.exec('DELETE FROM sqlite_sequence WHERE name IN ("events", "subagent_registry", "subagent_messages")');
}

/**
 * Alternative: Create temporary file-based database
 * Useful for integration tests that need persistence across operations
 */
export function setupTempFileDatabase(): Database {
  const tempPath = `/tmp/test-db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.db`;
  const db = new Database(tempPath);
  
  // Enable WAL mode
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  
  // Initialize schema
  initTestSchema(db);
  
  // Store for cleanup
  testDatabases.push(db);
  
  // Inject into db module
  setDatabase(db);
  
  return db;
}

/**
 * Creates a test database with specific data
 * Useful for tests that need pre-populated data
 */
export function setupTestDatabaseWithData(sessionCount: number = 3, agentsPerSession: number = 2): Database {
  const db = setupTestDatabase();
  
  // Populate with test data
  for (let i = 1; i <= sessionCount; i++) {
    const sessionId = `test-session-${i.toString().padStart(3, '0')}`;
    
    for (let j = 1; j <= agentsPerSession; j++) {
      const agentName = `Agent${j}`;
      const agentType = ['engineer', 'tester', 'architect', 'planner'][j % 4];
      
      // Use direct SQL to avoid triggering termination logic
      db.exec(`
        INSERT INTO subagent_registry (session_id, name, subagent_type, created_at, status)
        VALUES ('${sessionId}', '${agentName}', '${agentType}', ${Date.now() - (sessionCount - i) * 1000 - (agentsPerSession - j) * 100}, 'active')
      `);
    }
  }
  
  return db;
}

/**
 * Assert test database is properly isolated
 * Call this in tests to verify isolation is working
 */
export function assertDatabaseIsolation(): void {
  const db = testDatabases[testDatabases.length - 1];
  if (!db) {
    throw new Error('No test database found - call setupTestDatabase() first');
  }
  
  // Verify we're using in-memory database
  if (db.filename !== ':memory:') {
    console.warn('Warning: Test database is not in-memory, may cause test pollution');
  }
  
  // Check for unexpected data that might indicate pollution
  const eventCount = db.prepare('SELECT COUNT(*) as count FROM events').get() as { count: number };
  const agentCount = db.prepare('SELECT COUNT(*) as count FROM subagent_registry').get() as { count: number };
  const messageCount = db.prepare('SELECT COUNT(*) as count FROM subagent_messages').get() as { count: number };
  
  if (eventCount.count > 0 || agentCount.count > 0 || messageCount.count > 0) {
    console.warn('Warning: Test database contains data at start of test, check isolation setup');
  }
}