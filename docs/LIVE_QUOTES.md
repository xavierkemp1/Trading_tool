# Live Quote Support - Implementation Guide

## Overview
This feature adds live quote support to the Trading Tool, allowing users to view intraday prices for their positions while maintaining the integrity of daily bar analysis.

## Components

### 1. Database Schema
**Migration**: `005_live_quotes.sql`

```sql
CREATE TABLE quotes (
  symbol TEXT PRIMARY KEY,
  fetched_at TEXT,
  price REAL,
  change REAL,
  change_pct REAL,
  source TEXT
);
```

The quotes table stores live price data with a timestamp, enabling cache management.

### 2. Quote Service (`src/lib/quoteService.ts`)

**Cache Duration**: 60 seconds (configurable via `QUOTE_CACHE_DURATION_MS`)

**Key Functions**:
- `isQuoteFresh(quote)`: Checks if a quote is within the cache duration
- `fetchAndCacheQuote(symbol, forceRefresh)`: Fetches a quote and caches it
- `getOrFetchQuote(symbol)`: Gets cached quote or fetches if needed
- `batchFetchQuotes(symbols)`: Fetches multiple quotes in parallel

### 3. Database Operations

**Added to `src/lib/dbOperations.ts`**:
- `Quote` interface
- `upsertQuote()`: Insert or update a quote
- `getQuote()`: Retrieve a cached quote
- `getAllQuotes()`: Get all cached quotes
- `deleteQuote()`: Remove a quote from cache

### 4. UI Changes (`src/pages/CurrentInvestments.tsx`)

**Toggle Button**: 
- 📊 EOD: Uses daily close prices from the prices table
- 🔴 Live: Uses live quotes from the quotes table

**Delayed Indicator**: 
- ⏱ symbol appears next to prices when quote is older than 60 seconds
- Helps users identify potentially stale data

## Usage

### User Workflow

1. **View Positions with Daily Prices** (Default)
   - Application starts with daily close prices
   - All calculations use end-of-day data
   - Daily bar analysis remains intact

2. **Enable Live Quotes**
   - Click the "📊 EOD" button to switch to "🔴 Live"
   - Application fetches current quotes for all visible positions
   - Quotes are cached for 60 seconds

3. **Monitor Freshness**
   - Fresh quotes (< 60s old) show no indicator
   - Stale quotes (> 60s old) show ⏱ indicator
   - User can toggle to force refresh

### Developer Usage

```typescript
import { fetchAndCacheQuote, isQuoteFresh } from './lib/quoteService';

// Fetch a quote (uses cache if fresh)
const quote = await fetchAndCacheQuote('AAPL');

// Check if quote is fresh
if (isQuoteFresh(quote)) {
  console.log('Quote is current');
}

// Force refresh (bypass cache)
const freshQuote = await fetchAndCacheQuote('AAPL', true);

// Batch fetch for multiple symbols
const quotes = await batchFetchQuotes(['AAPL', 'MSFT', 'GOOGL']);
```

## Architecture Decisions

### Why Separate Quotes Table?
- **Separation of Concerns**: Daily bars (prices table) remain untouched
- **Cache Management**: Easy to clear/refresh live data without affecting historical data
- **Performance**: Indexed by symbol for fast lookups
- **Flexibility**: Can store additional live data (volume, bid/ask) in the future

### Why 60-Second Cache?
- Balance between data freshness and API quota usage
- Prevents excessive API calls during active trading
- Provides near-real-time updates without overwhelming the backend
- Users can force refresh by toggling off/on

### Why Toggle Instead of Always-On?
- **Preserves Daily Bar Analysis**: Default behavior unchanged
- **User Control**: Users choose when they need live data
- **API Quota Management**: Only fetch when needed
- **Clear Intent**: Users explicitly choose between EOD and live views

## Data Flow

```
User toggles Live Quotes
  ↓
CurrentInvestments.loadPositions()
  ↓
batchFetchQuotes(symbols)
  ↓
For each symbol:
  - Check cache (getQuote)
  - If fresh: use cached quote
  - If stale: fetchCurrentPrice()
  - Store in quotes table (upsertQuote)
  ↓
Display prices with freshness indicators
```

## Future Enhancements

Potential improvements:
1. **Auto-refresh**: Optional auto-refresh every 60 seconds when live mode is active
2. **Quote Details**: Show bid/ask, volume, day range in tooltip
3. **Sparkline**: Mini chart showing intraday price movement
4. **Alert Integration**: Notify when price crosses certain thresholds
5. **Market Hours Detection**: Show warning when market is closed

## Testing

To test the feature:

1. **Build**: `npm run build` - Verify no TypeScript errors
2. **Start Dev Server**: `npm run dev`
3. **Navigate to Current Investments**
4. **Test Toggle**: Click 📊 EOD button to switch to 🔴 Live
5. **Verify Quotes**: Check that prices update (requires API configuration)
6. **Check Indicator**: Wait 60+ seconds, verify ⏱ appears for stale quotes

## Migration

When existing databases are upgraded:
- Migration 005 runs automatically on next database initialization
- Creates quotes table with index
- No data migration needed (table starts empty)
- Users see toggle button immediately

## Troubleshooting

**Quotes not fetching?**
- Check API configuration in backend/server
- Verify fetchCurrentPrice() is working
- Check browser console for errors

**Delayed indicator not showing?**
- Verify quote.fetched_at is a valid ISO timestamp
- Check that QUOTE_CACHE_DURATION_MS is set to 60000

**Toggle not working?**
- Verify useLiveQuotes state is updating
- Check loadPositions dependency array includes useLiveQuotes
- Ensure batchFetchQuotes is called when useLiveQuotes is true
