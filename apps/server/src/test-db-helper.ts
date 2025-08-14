import { Database } from 'bun:sqlite';

/**
 * Test Database Helper - Provides isolated database instances for testing
 * Ensures each test gets a clean, isolated database state
 */

let testDb: Database | null = null;
let originalInitDatabase: any = null;

/**
 * Creates an isolated in-memory database for testing
 */
export function createTestDatabase(): Database {
  const db = new Database(':memory:');
  
  // Enable WAL mode for better concurrent performance
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  
  return db;
}

/**
 * Initializes test database with all required tables and indexes
 */
export function initTestDatabase(db: Database): void {
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

/**
 * Sets up test database isolation by patching the db module
 * Call this in beforeEach to ensure each test gets a clean database
 */
export function setupTestDatabase(): void {
  // Create new isolated database
  testDb = createTestDatabase();
  initTestDatabase(testDb);
  
  // Patch the db module to use our test database
  const dbModule = require('./db');
  if (!originalInitDatabase) {
    originalInitDatabase = dbModule.initDatabase;
  }
  
  // Replace the global db instance with our test database
  (dbModule as any).db = testDb;
}

/**
 * Tears down test database isolation
 * Call this in afterEach to clean up
 */
export function teardownTestDatabase(): void {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
  
  // Restore original initDatabase if it was patched
  if (originalInitDatabase) {
    const dbModule = require('./db');
    dbModule.initDatabase = originalInitDatabase;
  }
}

/**
 * Gets the current test database instance
 */
export function getTestDatabase(): Database {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testDb;
}

/**
 * Completely clears all data from test database while preserving schema
 */
export function clearTestDatabase(): void {
  if (!testDb) return;
  
  // Clear all data but preserve schema
  testDb.exec('DELETE FROM subagent_messages');
  testDb.exec('DELETE FROM subagent_registry');
  testDb.exec('DELETE FROM events');
  
  // Reset auto-increment counters
  testDb.exec('DELETE FROM sqlite_sequence');
}

/**
 * Alternative approach: Use file-based temporary databases
 */
export function createTempFileDatabase(): Database {
  const tempPath = `/tmp/test-db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.db`;
  const db = new Database(tempPath);
  
  // Enable WAL mode
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  
  return db;
}

/**
 * Clean up temporary database file
 */
export function cleanupTempDatabase(db: Database): void {
  const filename = db.filename;
  db.close();
  
  // Try to remove temp files
  try {
    require('fs').unlinkSync(filename);
    require('fs').unlinkSync(filename + '-wal');
    require('fs').unlinkSync(filename + '-shm');
  } catch (e) {
    // Ignore cleanup errors in tests
  }
}