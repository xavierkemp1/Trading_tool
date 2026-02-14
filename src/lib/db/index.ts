// Export database initialization and utility functions
export {
  initDatabase,
  saveDatabase,
  getDatabase,
  resetDatabase,
  exportDatabase,
  importDatabase
} from '../database';

// Export storage health utility
export {
  getStorageHealth,
  type StorageHealth
} from '../storageHealth';

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
  type Quote,
  
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
  updateJournalEntry,
  
  // Quotes
  upsertQuote,
  getQuote,
  getAllQuotes,
  deleteQuote
} from '../dbOperations';
