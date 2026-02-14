/**
 * Export/Import Functionality
 * 
 * Provides comprehensive backup and restore functionality for the database
 * Supports both raw SQLite export and JSON format with version tracking
 */

import { getDatabase, importDatabase, exportDatabase, saveDatabaseImmediate, DB_VERSION, getCurrentDatabaseVersion } from './database';
import { 
  getAllPositions, 
  getAllSymbols, 
  getAllWatchlist, 
  getPricesForSymbol,
  upsertSymbol,
  addPosition,
  addToWatchlist,
  addPrices,
  upsertFundamentals,
  addReview,
  addJournalEntry,
  type Symbol,
  type Position,
  type WatchlistEntry,
  type Price,
  type Fundamentals,
  type AIReview,
  type JournalEntry
} from './dbOperations';

const APP_VERSION = '0.1.0';

export interface JsonExportPayload {
  version: string;
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  tables: {
    symbols: Symbol[];
    positions: Position[];
    watchlist: WatchlistEntry[];
    prices: Record<string, Price[]>;
    fundamentals: Fundamentals[];
    ai_reviews: AIReview[];
    journal_entries: JournalEntry[];
  };
}

/**
 * Exports raw SQLite database as downloadable file
 */
export function exportDbBytes(): void {
  try {
    const blob = exportDatabase();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading_tool_backup_${new Date().toISOString().split('T')[0]}.sqlite`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('Database exported successfully');
  } catch (error) {
    console.error('Failed to export database:', error);
    throw new Error('Database export failed');
  }
}

/**
 * Exports all tables as JSON with metadata
 */
export async function exportJson(): Promise<void> {
  try {
    const db = getDatabase();
    
    // Get current database version from _meta table
    const currentSchemaVersion = getCurrentDatabaseVersion();
    
    // Get all data from tables
    const symbols = getAllSymbols();
    const positions = getAllPositions();
    const watchlist = getAllWatchlist();
    
    // Get prices for all symbols
    const pricesMap: Record<string, Price[]> = {};
    const allSymbols = getAllSymbols();
    for (const symbol of allSymbols) {
      const prices = getPricesForSymbol(symbol.symbol);
      if (prices.length > 0) {
        pricesMap[symbol.symbol] = prices;
      }
    }
    
    // Get fundamentals
    const fundamentalsResults = db.exec('SELECT * FROM fundamentals');
    const fundamentals: Fundamentals[] = fundamentalsResults.length > 0 
      ? fundamentalsResults[0].values.map((row: any[]) => ({
          symbol: row[0],
          fetched_at: row[1],
          market_cap: row[2],
          trailing_pe: row[3],
          forward_pe: row[4],
          price_to_sales: row[5],
          profit_margins: row[6],
          revenue_growth: row[7],
          earnings_growth: row[8],
          dividend_yield: row[9],
          beta: row[10],
          total_debt: row[11],
          total_cash: row[12]
        }))
      : [];
    
    // Get AI reviews
    const aiReviewsResults = db.exec('SELECT * FROM ai_reviews');
    const ai_reviews: AIReview[] = aiReviewsResults.length > 0
      ? aiReviewsResults[0].values.map((row: any[]) => ({
          id: row[0],
          created_at: row[1],
          scope: row[2],
          symbol: row[3],
          input_json: row[4],
          output_md: row[5]
        }))
      : [];
    
    // Get journal entries
    const journalResults = db.exec('SELECT * FROM journal_entries');
    const journal_entries: JournalEntry[] = journalResults.length > 0
      ? journalResults[0].values.map((row: any[]) => ({
          id: row[0],
          created_at: row[1],
          type: row[2],
          symbol: row[3],
          entry_price: row[4],
          exit_price: row[5],
          qty: row[6],
          pnl: row[7],
          thesis: row[8],
          invalidation: row[9],
          outcome: row[10],
          lesson: row[11]
        }))
      : [];
    
    // Create JSON payload with current schema version
    const payload: JsonExportPayload = {
      version: '1.0',
      schemaVersion: currentSchemaVersion,
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      tables: {
        symbols,
        positions,
        watchlist,
        prices: pricesMap,
        fundamentals,
        ai_reviews,
        journal_entries
      }
    };
    
    // Create and download JSON file
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading_tool_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('JSON export completed successfully');
  } catch (error) {
    console.error('Failed to export JSON:', error);
    throw new Error('JSON export failed');
  }
}

/**
 * Imports SQLite database file
 * Overwrites current database entirely
 */
export async function importDbBytes(file: File): Promise<void> {
  try {
    // Validate file type
    if (!file.name.endsWith('.sqlite') && !file.name.endsWith('.db')) {
      throw new Error('Invalid file type. Please upload a .sqlite or .db file');
    }
    
    // Import the database
    await importDatabase(file);
    
    console.log('Database imported successfully');
  } catch (error) {
    console.error('Failed to import database:', error);
    const message = error instanceof Error ? error.message : 'Database import failed';
    throw new Error(message);
  }
}

/**
 * Imports JSON backup
 * Validates version and clears existing data
 * Supports importing older schema versions and migrates them automatically
 */
export async function importJson(file: File): Promise<void> {
  try {
    // Read and parse JSON file
    const text = await file.text();
    const payload: JsonExportPayload = JSON.parse(text);
    
    // Validate version
    if (!payload.version || payload.schemaVersion === undefined) {
      throw new Error('Invalid JSON backup file - missing version information');
    }
    
    // Check if imported version is newer than current DB version
    if (payload.schemaVersion > DB_VERSION) {
      throw new Error(
        `Cannot import newer schema version. Backup is version ${payload.schemaVersion}, ` +
        `but this app supports up to version ${DB_VERSION}. Please update the application.`
      );
    }
    
    const db = getDatabase();
    
    // Begin transaction and clear all tables
    db.run('BEGIN TRANSACTION');
    
    try {
      // Clear existing data
      db.run('DELETE FROM journal_entries');
      db.run('DELETE FROM ai_reviews');
      db.run('DELETE FROM prices');
      db.run('DELETE FROM fundamentals');
      db.run('DELETE FROM watchlist');
      db.run('DELETE FROM positions');
      db.run('DELETE FROM symbols');
      
      // Import symbols
      for (const symbol of payload.tables.symbols) {
        upsertSymbol(symbol);
      }
      
      // Import positions
      for (const position of payload.tables.positions) {
        // Remove created_at and updated_at from the data as addPosition will set them
        const { created_at, updated_at, ...positionData } = position;
        addPosition(positionData);
      }
      
      // Import watchlist
      for (const entry of payload.tables.watchlist) {
        const { added_at, ...entryData } = entry;
        addToWatchlist(entryData);
      }
      
      // Import prices
      for (const symbol in payload.tables.prices) {
        const prices = payload.tables.prices[symbol];
        addPrices(prices);
      }
      
      // Import fundamentals
      for (const fundamental of payload.tables.fundamentals) {
        upsertFundamentals(fundamental);
      }
      
      // Import AI reviews
      for (const review of payload.tables.ai_reviews) {
        const { id, ...reviewData } = review;
        addReview(reviewData);
      }
      
      // Import journal entries
      for (const entry of payload.tables.journal_entries) {
        const { id, ...entryData } = entry;
        addJournalEntry(entryData);
      }
      
      // Update the database version to match the imported version
      db.run(`INSERT OR REPLACE INTO _meta (key, value) VALUES ('version', '${payload.schemaVersion}')`);
      
      // Commit transaction
      db.run('COMMIT');
      
      // Save database immediately
      await saveDatabaseImmediate();
      
      // If imported version is older than current, apply migrations to bring it up to date
      if (payload.schemaVersion < DB_VERSION) {
        console.log(`Imported older version ${payload.schemaVersion}, applying migrations to ${DB_VERSION}...`);
        const { initDatabase } = await import('./database');
        await initDatabase(); // This will apply pending migrations
        console.log('Migrations applied successfully');
      }
      
      console.log('JSON import completed successfully');
    } catch (error) {
      // Rollback on error
      db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Failed to import JSON:', error);
    const message = error instanceof Error ? error.message : 'JSON import failed';
    throw new Error(message);
  }
}
