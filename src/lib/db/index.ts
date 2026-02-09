// Export database initialization and utility functions
export {
  initDatabase,
  saveDatabase,
  getDatabase,
  resetDatabase,
  exportDatabase,
  importDatabase
} from '../database';

// Export all database operation functions
export {
  // Types
  type Symbol,
  type Price,
  type Fundamentals,
  type Position,
  type WatchlistEntry,
  type JournalEntry,
  type AIReview,
  
  // Symbols
  upsertSymbol,
  getSymbol,
  getAllSymbols,
  
  // Positions
  addPosition,
  updatePosition,
  deletePosition,
  getAllPositions,
  getPositionBySymbol,
  
  // Watchlist
  addToWatchlist,
  deleteFromWatchlist,
  getAllWatchlist,
  getWatchlistBySymbol,
  
  // Prices
  addPrices,
  getPricesForSymbol,
  getLatestPrice,
  deletePricesForSymbol,
  
  // Fundamentals
  upsertFundamentals,
  getFundamentals,
  deleteFundamentals,
  
  // AI Reviews
  addReview,
  getReviews,
  deleteReview,
  
  // Journal Entries
  addJournalEntry,
  getAllJournalEntries,
  getJournalEntriesBySymbol,
  deleteJournalEntry,
  updateJournalEntry
} from '../dbOperations';
