import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import schemaSQL from './db/migrations/001_init.sql';

const DB_KEY = 'trading_app_db';
const DB_VERSION = 1;
const MAX_FILE_PATH_LENGTH = 100; // Max length to distinguish file paths from SQL content

let dbInstance: Database | null = null;
let sqlJs: SqlJsStatic | null = null;

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

    // Try to load existing database from localStorage
    const savedDb = localStorage.getItem(DB_KEY);
    
    if (savedDb) {
      // Load existing database
      console.log('Loading existing database from localStorage...');
      const data = Uint8Array.from(atob(savedDb), c => c.charCodeAt(0));
      dbInstance = new sqlJs.Database(data);
      console.log('Database loaded from localStorage');
    } else {
      // Create new database
      console.log('Creating new database...');
      dbInstance = new sqlJs.Database();
      
      // Load and execute schema
      if (dbInstance) {
        await loadSchema(dbInstance);
      }
      
      // Save to localStorage
      await saveDatabase();
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
 * Load schema from imported SQL file
 */
async function loadSchema(db: Database): Promise<void> {
  try {
    // Validate that schemaSQL is a valid SQL string
    if (typeof schemaSQL !== 'string' || schemaSQL.trim().length === 0) {
      throw new Error(`Invalid schema SQL: expected non-empty string, got ${typeof schemaSQL}`);
    }
    
    // Check if schemaSQL looks like a file path (common import issue)
    if (schemaSQL.includes('.sql') && schemaSQL.length < MAX_FILE_PATH_LENGTH) {
      throw new Error(`Schema SQL appears to be a file path (${schemaSQL}) instead of SQL content. Check Vite configuration for SQL file loading.`);
    }
    
    console.log('Executing schema SQL...');
    db.exec(schemaSQL);
    console.log('Schema loaded successfully');
    
    // Store version info
    db.exec(`CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT)`);
    db.exec(`INSERT OR REPLACE INTO _meta (key, value) VALUES ('version', '${DB_VERSION}')`);
  } catch (error) {
    console.error('Failed to load schema:', error);
    if (error instanceof Error) {
      throw new Error(`Schema loading failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Save database to localStorage
 */
export async function saveDatabase(): Promise<void> {
  if (!dbInstance) {
    throw new Error('Database not initialized');
  }

  try {
    const data = dbInstance.export();
    const base64 = btoa(String.fromCharCode(...data));
    localStorage.setItem(DB_KEY, base64);
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
  localStorage.removeItem(DB_KEY);
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
    
    // Save to localStorage
    await saveDatabase();
  } catch (error) {
    console.error('Failed to import database:', error);
    throw new Error('Database import failed');
  }
}
