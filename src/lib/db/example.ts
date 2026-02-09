/**
 * Example usage of the database integration layer
 * This file demonstrates how to initialize and use the database
 */

import {
  initDatabase,
  addPosition,
  getAllPositions,
  addToWatchlist,
  getAllWatchlist,
  addPrices,
  getLatestPrice,
  upsertSymbol,
  addJournalEntry,
  getAllJournalEntries
} from './index';

/**
 * Example: Initialize the database and perform basic operations
 */
export async function exampleUsage() {
  try {
    // 1. Initialize the database (must be called first)
    await initDatabase();
    console.log('✓ Database initialized');

    // 2. Add a symbol
    upsertSymbol({
      symbol: 'AAPL',
      name: 'Apple Inc.',
      asset_class: 'Stock',
      currency: 'USD',
      sector: 'Technology',
      industry: 'Consumer Electronics'
    });
    console.log('✓ Symbol added');

    // 3. Add a position
    addPosition({
      symbol: 'AAPL',
      qty: 100,
      avg_cost: 150.50,
      currency: 'USD',
      thesis_tag: 'Growth',
      time_horizon: 'Years',
      thesis: 'Strong brand, ecosystem lock-in, services growth',
      invalidation: 120,
      target: 200
    });
    console.log('✓ Position added');

    // 4. Add to watchlist
    addToWatchlist({
      symbol: 'MSFT',
      thesis_tag: 'Growth',
      notes: 'Cloud computing leader, AI opportunities'
    });
    console.log('✓ Watchlist item added');

    // 5. Add price data
    addPrices([
      {
        symbol: 'AAPL',
        date: '2024-01-15',
        open: 150.0,
        high: 152.5,
        low: 149.5,
        close: 151.0,
        volume: 50000000
      },
      {
        symbol: 'AAPL',
        date: '2024-01-16',
        open: 151.0,
        high: 153.0,
        low: 150.5,
        close: 152.5,
        volume: 55000000
      }
    ]);
    console.log('✓ Price data added');

    // 6. Add a journal entry
    addJournalEntry({
      created_at: new Date().toISOString(),
      type: 'trade',
      symbol: 'AAPL',
      entry_price: 150.50,
      exit_price: 152.50,
      qty: 100,
      pnl: 200,
      thesis: 'Breakout above resistance',
      outcome: 'Success',
      lesson: 'Patience paid off, technical setup was correct'
    });
    console.log('✓ Journal entry added');

    // 7. Retrieve data
    const positions = getAllPositions();
    console.log('✓ Positions:', positions);

    const watchlist = getAllWatchlist();
    console.log('✓ Watchlist:', watchlist);

    const latestPrice = getLatestPrice('AAPL');
    console.log('✓ Latest price:', latestPrice);

    const journalEntries = getAllJournalEntries(10);
    console.log('✓ Journal entries:', journalEntries);

    return {
      positions,
      watchlist,
      latestPrice,
      journalEntries
    };
  } catch (error) {
    console.error('Error in example usage:', error);
    throw error;
  }
}
