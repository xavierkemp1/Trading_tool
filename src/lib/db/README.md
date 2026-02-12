# Database Integration Layer

This directory contains the SQLite database integration for the trading application using sql.js for browser-based persistence.

## Files

- **`database.ts`** - Core database initialization, persistence, and utilities
- **`dbOperations.ts`** - CRUD operations for all database tables
- **`index.ts`** - Convenience exports for easy importing
- **`example.ts`** - Example usage demonstrating the API
- **`migrations/001_init.sql`** - Initial database schema

## Quick Start

```typescript
import { initDatabase, addPosition, getAllPositions } from './lib/db';

// Initialize the database (call once at app startup - this is async)
await initDatabase();

// Add a position (synchronous operation)
addPosition({
  symbol: 'AAPL',
  qty: 100,
  avg_cost: 150.50,
  currency: 'USD',
  thesis_tag: 'Growth',
  time_horizon: 'Years'
});

// Get all positions (synchronous operation)
const positions = getAllPositions();
```

## Database Tables

### symbols
Stores information about trading symbols/tickers
- `symbol` (PRIMARY KEY)
- `name`, `asset_class`, `currency`, `sector`, `industry`

### positions
Tracks current portfolio positions
- `symbol` (PRIMARY KEY)
- `qty`, `avg_cost`, `currency`
- `thesis_tag`, `time_horizon`, `thesis`
- `invalidation`, `target`
- `created_at`, `updated_at`

### watchlist
Symbols being monitored
- `symbol` (PRIMARY KEY)
- `added_at`, `thesis_tag`, `notes`

### prices
Historical price data
- `symbol`, `date` (COMPOSITE PRIMARY KEY)
- `open`, `high`, `low`, `close`, `volume`

### fundamentals
Fundamental data for symbols
- `symbol` (PRIMARY KEY)
- `market_cap`, `trailing_pe`, `forward_pe`, etc.
- `fetched_at`

### journal_entries
Trading journal entries
- `id` (AUTOINCREMENT PRIMARY KEY)
- `created_at`, `type`, `symbol`
- `entry_price`, `exit_price`, `qty`, `pnl`
- `thesis`, `invalidation`, `outcome`, `lesson`

### ai_reviews
AI-generated analysis and reviews
- `id` (AUTOINCREMENT PRIMARY KEY)
- `created_at`, `scope`, `symbol`
- `input_json`, `output_md`

## API Reference

### Database Initialization

```typescript
// Initialize database - loads from localStorage if exists, creates new if not
await initDatabase(): Promise<Database>

// Get database instance (after initialization)
getDatabase(): Database

// Save current state to localStorage (debounced - waits 2 seconds)
saveDatabase(): void

// Save current state to localStorage immediately (no debouncing)
await saveDatabaseImmediate(): Promise<void>

// Clear database and reset to initial schema
await resetDatabase(): Promise<void>

// Export database as a downloadable file
exportDatabase(): Blob

// Import database from a file
await importDatabase(file: File): Promise<void>
```

### Symbols Operations

```typescript
upsertSymbol(symbolData: Symbol): void
getSymbol(symbol: string): Symbol | null
getAllSymbols(): Symbol[]
```

### Positions Operations

```typescript
addPosition(position: Omit<Position, 'created_at' | 'updated_at'>): void
updatePosition(symbol: string, updates: Partial<Position>): void
deletePosition(symbol: string): void
getAllPositions(): Position[]
getPositionBySymbol(symbol: string): Position | null
```

### Watchlist Operations

```typescript
addToWatchlist(entry: Omit<WatchlistEntry, 'added_at'>): void
deleteFromWatchlist(symbol: string): void
getAllWatchlist(): WatchlistEntry[]
getWatchlistBySymbol(symbol: string): WatchlistEntry | null
```

### Prices Operations

```typescript
addPrices(prices: Price[]): void
getPricesForSymbol(symbol: string, limit?: number): Price[]
getLatestPrice(symbol: string): Price | null
deletePricesForSymbol(symbol: string): void
```

### Fundamentals Operations

```typescript
upsertFundamentals(data: Fundamentals): void
getFundamentals(symbol: string): Fundamentals | null
deleteFundamentals(symbol: string): void
```

### Journal Operations

```typescript
addJournalEntry(entry: Omit<JournalEntry, 'id'>): number
getAllJournalEntries(limit?: number): JournalEntry[]
getJournalEntriesBySymbol(symbol: string): JournalEntry[]
deleteJournalEntry(id: number): void
updateJournalEntry(id: number, updates: Partial<JournalEntry>): void
```

### AI Reviews Operations

```typescript
addReview(review: Omit<AIReview, 'id'>): number
getReviews(symbol?: string, limit?: number): AIReview[]
deleteReview(id: number): void
```

## Persistence

The database automatically persists to `localStorage` under the key `trading_app_db`. The data is stored as a base64-encoded binary blob. 

**Important:** Database operations automatically trigger a debounced save (2-second delay) to optimize performance. This prevents excessive writes when performing multiple operations in quick succession. For critical operations like database initialization or import, `saveDatabaseImmediate()` is used to ensure data is persisted immediately.

**Performance Optimization:** The debounced save mechanism reduces thousands of potential localStorage writes during bulk operations (e.g., refreshing price data for multiple symbols) down to a single save operation, dramatically improving performance and preventing stack overflow errors.

## Error Handling

All database operations throw errors if they fail. Wrap calls in try-catch blocks:

```typescript
try {
  addPosition({ ... });
} catch (error) {
  console.error('Failed to add position:', error);
}
```

## TypeScript Types

All operations are fully typed. Import types from `dbOperations.ts`:

```typescript
import type { Position, WatchlistEntry, Price, Fundamentals } from './lib/db';
```

## Notes

- The database must be initialized with `initDatabase()` before any operations
- All timestamps should be in ISO 8601 format (`new Date().toISOString()`)
- The database uses sql.js which runs entirely in the browser
- Data persists across page reloads via localStorage
- For large datasets, consider implementing pagination in queries
