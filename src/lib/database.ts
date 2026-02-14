import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import schemaSQL from './db/migrations/001_init.sql';
import migration002 from './db/migrations/002_data_quality.sql';
import migration003 from './db/migrations/003_corporate_actions.sql';
import { getDbBytes, setDbBytes, clearDbBytes, IDB_NAME, IDB_STORE } from './idbStore';

const DB_KEY = 'trading_app_db'; // Keep for migration from localStorage
const DB_VERSION = 3; // Updated to version 3 for corporate actions tracking.
const MAX_FILE_PATH_LENGTH = 100; // Max length to distinguish file paths from SQL content
const SAVE_DEBOUNCE_MS = 2000; // Debounce database saves by 2 seconds

// Migration definitions
const MIGRATIONS = [
  { version: 1, sql: schemaSQL, description: 'Initial schema' },
  { version: 2, sql: migration002, description: 'Data quality tracking' },
  { version: 3, sql: migration003, description: 'Corporate actions tracking' }
];

let dbInstance: Database | null = null;
let sqlJs: SqlJsStatic | null = null;
let saveTimeout: number | null = null;
let pendingSave = false;

/**
 * Migrates existing localStorage database to IndexedDB
 * Runs once on first load with new system
 * Removes localStorage data after successful migration
 */
async function migrateFromLocalStorage(): Promise<boolean> {
  try {
    // Check if localStorage has old database
    const savedDb = localStorage.getItem(DB_KEY);
    if (!savedDb) {
      return false;
    }

    // Check if IndexedDB already has data
    const existingBytes = await getDbBytes();
    if (existingBytes) {
      console.log('IndexedDB already has data, skipping migration');
      return false;
    }

    console.log('Migrating database from localStorage to IndexedDB...');
    
    // Decode base64 data from localStorage
    const data = Uint8Array.from(atob(savedDb), c => c.charCodeAt(0));
    
    // Save to IndexedDB
    await setDbBytes(data);
    
    // Remove from localStorage after successful migration
    localStorage.removeItem(DB_KEY);
    
    console.log('Database migration completed successfully');
    return true;
  } catch (error) {
    console.error('Failed to migrate database from localStorage:', error);
    return false;
  }
}

/**
 * Initialize sql.js and load the database
 */
export async function initDatabase(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    console.log('Initializing database...');
    
    // Initialize SQL.js
    if (!sqlJs) {
      console.log('Loading SQL.js library...');
      sqlJs = await initSqlJs({
        locateFile: (file: string) => `/${file}`
      });
      console.log('SQL.js loaded successfully');
    }

    // Try to migrate from localStorage if needed
    await migrateFromLocalStorage();

    // Try to load existing database from IndexedDB
    const savedData = await getDbBytes();
    
    if (savedData) {
      // Load existing database
      console.log('Loading existing database from IndexedDB...');
      dbInstance = new sqlJs.Database(savedData);
      console.log('Database loaded from IndexedDB');
      
      // Apply any pending migrations
      await applyMigrations(dbInstance);
    } else {
      // Create new database
      console.log('Creating new database...');
      dbInstance = new sqlJs.Database();
      
      // Load and execute schema
      if (dbInstance) {
        await loadSchema(dbInstance);
      }
      
      // Save to IndexedDB immediately for initial creation
      await saveDatabaseImmediate();
      console.log('New database created and schema loaded');
    }

    if (!dbInstance) {
      throw new Error('Failed to create database instance');
    }

    console.log('Database initialization complete');
    return dbInstance;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Database initialization failed: ${errorMessage}`);
  }
}

/**
 * Get current database version
 */
function getDatabaseVersion(db: Database): number {
  try {
    const result = db.exec("SELECT value FROM _meta WHERE key = 'version'");
    if (result.length > 0 && result[0].values.length > 0) {
      return parseInt(result[0].values[0][0] as string, 10);
    }
  } catch (error) {
    // _meta table doesn't exist yet
    return 0;
  }
  return 0;
}

/**
 * Apply pending migrations to bring database to current version
 */
async function applyMigrations(db: Database): Promise<void> {
  const currentVersion = getDatabaseVersion(db);
  console.log(`Current database version: ${currentVersion}`);
  
  // Create meta table if it doesn't exist
  db.exec(`CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT)`);
  
  // Apply migrations that haven't been applied yet
  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      console.log(`Applying migration ${migration.version}: ${migration.description}`);
      
      try {
        // Validate migration SQL
        if (typeof migration.sql !== 'string' || migration.sql.trim().length === 0) {
          throw new Error(`Invalid migration SQL for version ${migration.version}`);
        }
        
        db.exec(migration.sql);
        db.exec(`INSERT OR REPLACE INTO _meta (key, value) VALUES ('version', '${migration.version}')`);
        
        console.log(`Migration ${migration.version} completed successfully`);
      } catch (error) {
        console.error(`Failed to apply migration ${migration.version}:`, error);
        throw new Error(`Migration ${migration.version} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
  
  // Save database immediately after migrations
  if (currentVersion < DB_VERSION) {
    await saveDatabaseImmediate();
    console.log('Database migrations completed and saved');
  }
}

/**
 * Load schema from imported SQL file
 */
async function loadSchema(db: Database): Promise<void> {
  try {
    // For new databases, apply all migrations in order
    await applyMigrations(db);
    console.log('Schema loaded successfully');
  } catch (error) {
    console.error('Failed to load schema:', error);
    if (error instanceof Error) {
      throw new Error(`Schema loading failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Save database to IndexedDB with debouncing
 */
export function saveDatabase(): void {
  if (!dbInstance) {
    throw new Error('Database not initialized');
  }

  // Clear existing timeout
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  // Mark that we have a pending save
  pendingSave = true;

  // Set up debounced save
  saveTimeout = setTimeout(async () => {
    try {
      await saveDatabaseImmediate();
    } catch (error) {
      console.error('Debounced database save failed:', error);
    }
  }, SAVE_DEBOUNCE_MS) as unknown as number;
}

/**
 * Save database to IndexedDB immediately without debouncing
 */
export async function saveDatabaseImmediate(): Promise<void> {
  if (!dbInstance) {
    throw new Error('Database not initialized');
  }

  try {
    const data = dbInstance.export();
    
    // Save directly to IndexedDB (no base64 encoding needed)
    await setDbBytes(data);
    
    // Clear pending save flag
    pendingSave = false;
    saveTimeout = null;
  } catch (error) {
    console.error('Failed to save database:', error);
    throw new Error('Database save failed');
  }
}

/**
 * Get the database instance
 */
export function getDatabase(): Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

/**
 * Clear the database and reset to initial schema
 */
export async function resetDatabase(): Promise<void> {
  await clearDbBytes();
  dbInstance = null;
  await initDatabase();
}

/**
 * Export database as a downloadable file
 */
export function exportDatabase(): Blob {
  if (!dbInstance) {
    throw new Error('Database not initialized');
  }

  const data = dbInstance.export();
  return new Blob([data.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
}

/**
 * Import database from a file
 */
export async function importDatabase(file: File): Promise<void> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    if (!sqlJs) {
      sqlJs = await initSqlJs({
        locateFile: (file: string) => `/${file}`
      });
    }

    // Close existing database
    if (dbInstance) {
      dbInstance.close();
    }

    // Create new database from imported data
    dbInstance = new sqlJs.Database(data);
    
    // Save to IndexedDB immediately for imports
    await saveDatabaseImmediate();
  } catch (error) {
    console.error('Failed to import database:', error);
    throw new Error('Database import failed');
  }
}
