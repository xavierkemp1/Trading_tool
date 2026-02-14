/**
 * Data Quality and Freshness Tracking
 * 
 * Monitors data staleness and quality to ensure traders don't act on old information
 */

import { getSymbol } from './dbOperations';

export interface DataFreshness {
  symbol: string;
  pricesFresh: boolean;
  fundamentalsFresh: boolean;
  priceAge: string; // "5 min ago", "2 hours ago"
  fundamentalsAge: string;
  quality: 'ok' | 'stale' | 'partial' | 'error';
}

/**
 * Check if data is stale based on configurable thresholds
 * 
 * @param symbol - The symbol to check
 * @param priceStaleMinutes - Minutes before price data is considered stale (default: 10)
 * @param fundamentalsStaleDays - Days before fundamentals are considered stale (default: 7)
 * @returns Data freshness information
 */
export function checkDataFreshness(
  symbol: string,
  priceStaleMinutes: number = 10,
  fundamentalsStaleDays: number = 7
): DataFreshness {
  const symbolData = getSymbol(symbol);
  const now = Date.now();
  
  // Default to unfresh if no symbol data
  if (!symbolData) {
    return {
      symbol,
      pricesFresh: false,
      fundamentalsFresh: false,
      priceAge: 'never',
      fundamentalsAge: 'never',
      quality: 'error'
    };
  }
  
  // Calculate price staleness
  const priceStaleThreshold = priceStaleMinutes * 60 * 1000;
  const priceAge = symbolData.last_price_update 
    ? now - new Date(symbolData.last_price_update).getTime()
    : null;
  
  // Calculate fundamentals staleness
  const fundamentalsStaleThreshold = fundamentalsStaleDays * 24 * 60 * 60 * 1000;
  const fundamentalsAge = symbolData.last_fundamentals_update
    ? now - new Date(symbolData.last_fundamentals_update).getTime()
    : null;
  
  return {
    symbol,
    pricesFresh: priceAge !== null && priceAge < priceStaleThreshold,
    fundamentalsFresh: fundamentalsAge !== null && fundamentalsAge < fundamentalsStaleThreshold,
    priceAge: priceAge !== null ? formatTimeAgo(priceAge) : 'never',
    fundamentalsAge: fundamentalsAge !== null ? formatTimeAgo(fundamentalsAge) : 'never',
    quality: symbolData.data_quality || 'ok'
  };
}

/**
 * Format milliseconds into human-readable time ago string
 */
function formatTimeAgo(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
