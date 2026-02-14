import { fetchCurrentPrice } from './dataService';
import { upsertQuote, getQuote, type Quote } from './db';

// Cache duration in milliseconds (60 seconds)
export const QUOTE_CACHE_DURATION_MS = 60 * 1000;

/**
 * Check if a quote is fresh (within cache duration)
 */
export function isQuoteFresh(quote: Quote | null): boolean {
  if (!quote || !quote.fetched_at) {
    return false;
  }
  
  const fetchedTime = new Date(quote.fetched_at).getTime();
  const now = Date.now();
  const age = now - fetchedTime;
  
  return age < QUOTE_CACHE_DURATION_MS;
}

/**
 * Fetch current quote for a symbol and cache it
 * Returns cached quote if fresh, otherwise fetches new one
 */
export async function fetchAndCacheQuote(symbol: string, forceRefresh = false): Promise<Quote> {
  // Check cache first unless forcing refresh
  if (!forceRefresh) {
    const cachedQuote = getQuote(symbol);
    if (cachedQuote && isQuoteFresh(cachedQuote)) {
      return cachedQuote;
    }
  }
  
  try {
    // Fetch fresh quote
    const currentPrice = await fetchCurrentPrice(symbol);
    
    // Create quote object
    const quote: Quote = {
      symbol: currentPrice.symbol,
      fetched_at: currentPrice.timestamp,
      price: currentPrice.price,
      change: currentPrice.change,
      change_pct: currentPrice.changePercent,
      source: currentPrice.source
    };
    
    // Cache the quote
    upsertQuote(quote);
    
    return quote;
  } catch (error) {
    // If fetch fails, try to return cached quote even if stale
    const cachedQuote = getQuote(symbol);
    if (cachedQuote) {
      console.warn(`Using stale quote for ${symbol} due to fetch error:`, error);
      return cachedQuote;
    }
    
    // No cached quote available, re-throw the error
    throw new Error(`Failed to fetch quote for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a quote, preferring cache but falling back to fetch if needed
 */
export async function getOrFetchQuote(symbol: string): Promise<Quote | null> {
  try {
    return await fetchAndCacheQuote(symbol, false);
  } catch (error) {
    console.error(`Failed to fetch quote for ${symbol}:`, error);
    // Return cached quote even if stale, or null
    return getQuote(symbol);
  }
}

/**
 * Batch fetch quotes for multiple symbols
 * Fetches quotes in parallel for better performance
 */
export async function batchFetchQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const results = new Map<string, Quote>();
  
  // Fetch all quotes in parallel
  const promises = symbols.map(async (symbol) => {
    try {
      const quote = await fetchAndCacheQuote(symbol, false);
      results.set(symbol, quote);
    } catch (error) {
      console.error(`Failed to fetch quote for ${symbol}:`, error);
      // Try to use cached quote even if stale
      const cachedQuote = getQuote(symbol);
      if (cachedQuote) {
        results.set(symbol, cachedQuote);
      }
    }
  });
  
  await Promise.all(promises);
  
  return results;
}
