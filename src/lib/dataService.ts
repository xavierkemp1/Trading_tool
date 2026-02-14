import {
  upsertSymbol,
  addPrices,
  upsertFundamentals,
  getLatestPrice,
  getFundamentals,
  getPricesForSymbol,
  type Price,
  type Fundamentals,
  type Symbol
} from './db';
import { simpleMovingAverage, atr14, rsi14 } from './indicators';

// ============= TYPE DEFINITIONS =============

interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
  source?: 'yfinance' | 'alphavantage' | 'massive';
}

interface MarketDataResult {
  symbol: string;
  prices: Price[];
  source: 'yfinance' | 'alphavantage' | 'massive';
  timestamp: string;
}

interface FundamentalsResult {
  symbol: string;
  fundamentals: Fundamentals;
  source: 'yfinance' | 'alphavantage' | 'massive';
  timestamp: string;
}

interface CurrentPriceResult {
  symbol: string;
  price: number;
  change?: number;
  changePercent?: number;
  source: 'yfinance' | 'alphavantage' | 'massive';
  timestamp: string;
}

interface CalculatedIndicators {
  symbol: string;
  sma50?: number;
  sma200?: number;
  atr14?: number;
  rsi14?: number;
  timestamp: string;
}

interface RateLimitTracker {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// ============= CONSTANTS =============

const CACHE_DURATION_PRICES = 5 * 60 * 1000; // 5 minutes
const CACHE_DURATION_FUNDAMENTALS = 7 * 24 * 60 * 60 * 1000; // 1 week
const API_DELAY_MS = 1000; // Delay between API calls to avoid overwhelming
const SYMBOL_DELAY_MS = 500; // Delay between processing different symbols

// ============= RATE LIMITING =============

const rateLimits: RateLimitTracker = {};

/**
 * Check if we can make an API call within rate limits
 */
function canMakeAPICall(api: string, maxCalls: number, windowMs: number): boolean {
  const now = Date.now();
  
  if (!rateLimits[api] || now > rateLimits[api].resetTime) {
    rateLimits[api] = { count: 0, resetTime: now + windowMs };
  }
  
  if (rateLimits[api].count >= maxCalls) {
    return false;
  }
  
  rateLimits[api].count++;
  return true;
}

/**
 * Check if cached data is still fresh
 */
function isCacheFresh(timestamp: string, maxAge: number): boolean {
  const cacheTime = new Date(timestamp).getTime();
  const now = Date.now();
  return (now - cacheTime) < maxAge;
}

/**
 * Safely parse float, returning undefined for NaN
 */
function parseFloatSafe(value: any): number | undefined {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
}

// ============= YFINANCE API (Primary - Free, No API Key) =============

/**
 * Get the proxy URL from environment or default
 */
function getProxyUrl(): string {
  return import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
}

/**
 * Fetch OHLCV data from Yahoo Finance via proxy
 */
async function fetchYFinanceChart(symbol: string): Promise<APIResponse> {
  try {
    const period1 = Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60); // 1 year ago
    const period2 = Math.floor(Date.now() / 1000);
    const proxyUrl = getProxyUrl();
    const url = `${proxyUrl}/api/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    
    if (data.chart?.error) {
      return { success: false, error: data.chart.error.description };
    }
    
    const result = data.chart?.result?.[0];
    if (!result) {
      return { success: false, error: 'No data returned' };
    }
    
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const meta = result.meta || {};
    
    const prices: Price[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
      if (quotes.open?.[i] != null && quotes.close?.[i] != null) {
        prices.push({
          symbol: symbol.toUpperCase(),
          date,
          open: quotes.open[i],
          high: quotes.high[i] || quotes.close[i],
          low: quotes.low[i] || quotes.close[i],
          close: quotes.close[i],
          volume: quotes.volume[i] || 0
        });
      }
    }
    
    return { 
      success: true, 
      data: { prices, meta }, 
      source: 'yfinance' 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Fetch current quote from Yahoo Finance via proxy
 */
async function fetchYFinanceQuote(symbol: string): Promise<APIResponse> {
  try {
    const proxyUrl = getProxyUrl();
    const url = `${proxyUrl}/api/quote/${symbol}?interval=1d&range=1d`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    
    if (!result) {
      return { success: false, error: 'No quote data' };
    }
    
    const meta = result.meta;
    return { 
      success: true, 
      data: {
        price: meta.regularMarketPrice,
        previousClose: meta.previousClose,
        change: meta.regularMarketPrice - meta.previousClose,
        changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100
      },
      source: 'yfinance' 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// ============= ALPHA VANTAGE API (Backup - 25 requests/day) =============

/**
 * Fetch daily time series from Alpha Vantage
 */
async function fetchAlphaVantageDaily(symbol: string): Promise<APIResponse> {
  const apiKey = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'API key not configured' };
  }
  
  if (!canMakeAPICall('alphavantage', 25, 24 * 60 * 60 * 1000)) {
    return { success: false, error: 'Rate limit exceeded (25/day)' };
  }
  
  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    
    if (data['Error Message']) {
      return { success: false, error: data['Error Message'] };
    }
    
    if (data['Note']) {
      return { success: false, error: 'API rate limit reached' };
    }
    
    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) {
      return { success: false, error: 'No time series data' };
    }
    
    const prices: Price[] = [];
    for (const [date, values] of Object.entries(timeSeries)) {
      const v = values as any;
      prices.push({
        symbol: symbol.toUpperCase(),
        date,
        open: parseFloat(v['1. open']),
        high: parseFloat(v['2. high']),
        low: parseFloat(v['3. low']),
        close: parseFloat(v['4. close']),
        volume: parseFloat(v['5. volume'])
      });
    }
    
    // Sort by date descending
    prices.sort((a, b) => b.date.localeCompare(a.date));
    
    return { success: true, data: { prices }, source: 'alphavantage' };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Fetch company overview from Alpha Vantage
 */
async function fetchAlphaVantageOverview(symbol: string): Promise<APIResponse> {
  const apiKey = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'API key not configured' };
  }
  
  if (!canMakeAPICall('alphavantage', 25, 24 * 60 * 60 * 1000)) {
    return { success: false, error: 'Rate limit exceeded (25/day)' };
  }
  
  try {
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    
    if (data['Error Message'] || !data.Symbol) {
      return { success: false, error: data['Error Message'] || 'No data' };
    }
    
    return { success: true, data, source: 'alphavantage' };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Fetch global quote from Alpha Vantage
 */
async function fetchAlphaVantageQuote(symbol: string): Promise<APIResponse> {
  const apiKey = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'API key not configured' };
  }
  
  if (!canMakeAPICall('alphavantage', 25, 24 * 60 * 60 * 1000)) {
    return { success: false, error: 'Rate limit exceeded (25/day)' };
  }
  
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    const quote = data['Global Quote'];
    
    if (!quote || !quote['05. price']) {
      return { success: false, error: 'No quote data' };
    }
    
    return { 
      success: true, 
      data: {
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent'].replace('%', ''))
      },
      source: 'alphavantage' 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// ============= MASSIVE API (Tertiary - 5 calls/minute) =============

/**
 * Fetch aggregates (OHLCV) from Massive API
 */
async function fetchMassiveAggregates(symbol: string): Promise<APIResponse> {
  const apiKey = import.meta.env.VITE_MASSIVE_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'API key not configured' };
  }
  
  if (!canMakeAPICall('massive', 5, 60 * 1000)) {
    return { success: false, error: 'Rate limit exceeded (5/minute)' };
  }
  
  try {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}?apiKey=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.results) {
      return { success: false, error: data.error || 'No results' };
    }
    
    const prices: Price[] = data.results.map((bar: any) => ({
      symbol: symbol.toUpperCase(),
      date: new Date(bar.t).toISOString().split('T')[0],
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v
    }));
    
    // Sort by date descending
    prices.sort((a, b) => b.date.localeCompare(a.date));
    
    return { success: true, data: { prices }, source: 'massive' };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Fetch ticker details from Massive API
 */
async function fetchMassiveTickerDetails(symbol: string): Promise<APIResponse> {
  const apiKey = import.meta.env.VITE_MASSIVE_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'API key not configured' };
  }
  
  if (!canMakeAPICall('massive', 5, 60 * 1000)) {
    return { success: false, error: 'Rate limit exceeded (5/minute)' };
  }
  
  try {
    const url = `https://api.polygon.io/v3/reference/tickers/${symbol}?apiKey=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.results) {
      return { success: false, error: 'No ticker details' };
    }
    
    return { success: true, data: data.results, source: 'massive' };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// ============= CASCADING FAILOVER FUNCTIONS =============

/**
 * Fetch market data with cascading failover
 * Tries yfinance → Alpha Vantage → Massive API
 */
export async function fetchMarketData(symbol: string): Promise<MarketDataResult> {
  const upperSymbol = symbol.toUpperCase();
  
  // Check cache first
  const latestPrice = getLatestPrice(upperSymbol);
  if (latestPrice && isCacheFresh(latestPrice.date, CACHE_DURATION_PRICES)) {
    const cachedPrices = getPricesForSymbol(upperSymbol, 365);
    if (cachedPrices.length > 0) {
      return {
        symbol: upperSymbol,
        prices: cachedPrices,
        source: 'yfinance', // Default source for cached data
        timestamp: new Date().toISOString()
      };
    }
  }
  
  try {
    // Try yfinance first (free, no API key)
    let response = await fetchYFinanceChart(upperSymbol);
    
    // Fallback to Alpha Vantage
    if (!response.success) {
      console.warn(`yfinance failed for ${upperSymbol}: ${response.error}`);
      response = await fetchAlphaVantageDaily(upperSymbol);
    }
    
    // Fallback to Massive
    if (!response.success) {
      console.warn(`Alpha Vantage failed for ${upperSymbol}: ${response.error}`);
      response = await fetchMassiveAggregates(upperSymbol);
    }
    
    if (!response.success) {
      // Update symbol with error state
      upsertSymbol({
        symbol: upperSymbol,
        data_quality: 'error',
        last_error: response.error || 'All APIs failed'
      });
      throw new Error(`All APIs failed for ${upperSymbol}: ${response.error}`);
    }
    
    const prices = response.data.prices as Price[];
    const meta = response.data.meta;
    
    // Validate data quality
    const quality = validatePriceData(prices);
    
    // Store in database
    if (prices.length > 0) {
      addPrices(prices);
      
      // Update symbol metadata with data quality tracking
      upsertSymbol({
        symbol: upperSymbol,
        name: meta?.longName || meta?.shortName,
        currency: meta?.currency,
        asset_class: 'stock',
        last_price_update: new Date().toISOString(),
        data_quality: quality,
        last_error: null
      });
    }
    
    return {
      symbol: upperSymbol,
      prices,
      source: response.source!,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    // Update symbol with error state
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    upsertSymbol({
      symbol: upperSymbol,
      data_quality: 'error',
      last_error: errorMessage
    });
    throw error;
  }
}

/**
 * Validate price data quality
 */
function validatePriceData(prices: Price[]): 'ok' | 'partial' | 'stale' {
  // Need at least ~2 months of daily data for meaningful technical analysis (50 trading days)
  const MIN_PRICE_POINTS = 50;
  if (prices.length < MIN_PRICE_POINTS) return 'partial';
  
  const hasVolume = prices.some(p => p.volume > 0);
  if (!hasVolume) return 'partial';
  
  const latestDate = new Date(prices[prices.length - 1].date);
  const daysSinceUpdate = (Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate > 2) return 'stale';
  
  return 'ok';
}

/**
 * Fetch fundamentals with cascading failover
 */
export async function fetchFundamentals(symbol: string): Promise<FundamentalsResult> {
  const upperSymbol = symbol.toUpperCase();
  
  // Check cache first
  const cached = getFundamentals(upperSymbol);
  if (cached && isCacheFresh(cached.fetched_at, CACHE_DURATION_FUNDAMENTALS)) {
    return {
      symbol: upperSymbol,
      fundamentals: cached,
      source: 'yfinance', // Default source for cached data
      timestamp: cached.fetched_at
    };
  }
  
  try {
    // Try Alpha Vantage first (has best fundamental data)
    let response = await fetchAlphaVantageOverview(upperSymbol);
    let source: 'alphavantage' | 'massive' = 'alphavantage';
    
    // Fallback to Massive
    if (!response.success) {
      console.warn(`Alpha Vantage fundamentals failed for ${upperSymbol}: ${response.error}`);
      response = await fetchMassiveTickerDetails(upperSymbol);
      source = 'massive';
    }
    
    if (!response.success) {
      // Update symbol with error state
      upsertSymbol({
        symbol: upperSymbol,
        data_quality: 'error',
        last_error: response.error || 'Failed to fetch fundamentals'
      });
      throw new Error(`Failed to fetch fundamentals for ${upperSymbol}: ${response.error}`);
    }
    
    // Map to our schema
    const fundamentals: Fundamentals = {
      symbol: upperSymbol,
      fetched_at: new Date().toISOString()
    };
    
    // Check for missing critical fields
    let quality: 'ok' | 'partial' = 'ok';
    
    if (source === 'alphavantage') {
      const data = response.data;
      fundamentals.market_cap = parseFloatSafe(data.MarketCapitalization);
      fundamentals.trailing_pe = parseFloatSafe(data.PERatio);
      fundamentals.forward_pe = parseFloatSafe(data.ForwardPE);
      fundamentals.price_to_sales = parseFloatSafe(data.PriceToSalesRatioTTM);
      fundamentals.profit_margins = parseFloatSafe(data.ProfitMargin);
      fundamentals.revenue_growth = parseFloatSafe(data.QuarterlyRevenueGrowthYOY);
      fundamentals.earnings_growth = parseFloatSafe(data.QuarterlyEarningsGrowthYOY);
      fundamentals.dividend_yield = parseFloatSafe(data.DividendYield);
      fundamentals.beta = parseFloatSafe(data.Beta);
      
      // Check for critical missing data
      if (!data.MarketCapitalization) {
        quality = 'partial';
      }
      
      // Update symbol info with data quality tracking
      upsertSymbol({
        symbol: upperSymbol,
        name: data.Name,
        sector: data.Sector,
        industry: data.Industry,
        asset_class: 'stock',
        currency: 'USD',
        last_fundamentals_update: new Date().toISOString(),
        data_quality: quality,
        last_error: null
      });
    } else if (source === 'massive') {
      const data = response.data;
      fundamentals.market_cap = data.market_cap;
      
      // Update symbol info with data quality tracking
      upsertSymbol({
        symbol: upperSymbol,
        name: data.name,
        sector: data.sic_description,
        asset_class: data.type,
        currency: data.currency_name,
        last_fundamentals_update: new Date().toISOString(),
        data_quality: quality,
        last_error: null
      });
    }
    
    // Store in database
    upsertFundamentals(fundamentals);
    
    return {
      symbol: upperSymbol,
      fundamentals,
      source,
      timestamp: fundamentals.fetched_at
    };
  } catch (error) {
    // Update symbol with error state
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    upsertSymbol({
      symbol: upperSymbol,
      data_quality: 'error',
      last_error: errorMessage
    });
    throw error;
  }
}

/**
 * Fetch current price quickly with cascading failover
 */
export async function fetchCurrentPrice(symbol: string): Promise<CurrentPriceResult> {
  const upperSymbol = symbol.toUpperCase();
  
  // Try yfinance first (fastest)
  let response = await fetchYFinanceQuote(upperSymbol);
  
  // Fallback to Alpha Vantage
  if (!response.success) {
    response = await fetchAlphaVantageQuote(upperSymbol);
  }
  
  if (!response.success) {
    throw new Error(`Failed to fetch current price for ${upperSymbol}: ${response.error}`);
  }
  
  return {
    symbol: upperSymbol,
    price: response.data.price,
    change: response.data.change,
    changePercent: response.data.changePercent,
    source: response.source!,
    timestamp: new Date().toISOString()
  };
}

/**
 * Refresh data for multiple symbols in batch
 */
export async function refreshAllData(symbols: string[]): Promise<{
  successful: string[];
  failed: { symbol: string; error: string }[];
}> {
  const successful: string[] = [];
  const failed: { symbol: string; error: string }[] = [];
  
  for (const symbol of symbols) {
    try {
      // Fetch both market data and fundamentals
      await fetchMarketData(symbol);
      
      // Add small delay to avoid overwhelming APIs
      await new Promise(resolve => setTimeout(resolve, API_DELAY_MS));
      
      try {
        await fetchFundamentals(symbol);
      } catch (error) {
        // Fundamentals are optional, don't fail the whole symbol
        console.warn(`Failed to fetch fundamentals for ${symbol}:`, error);
      }
      
      successful.push(symbol);
    } catch (error) {
      failed.push({
        symbol,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // Add delay between symbols
    await new Promise(resolve => setTimeout(resolve, SYMBOL_DELAY_MS));
  }
  
  return { successful, failed };
}

/**
 * Calculate technical indicators for a symbol
 */
export async function calculateIndicators(symbol: string): Promise<CalculatedIndicators> {
  const upperSymbol = symbol.toUpperCase();
  
  // Get price history (at least 200 days for SMA200)
  const prices = getPricesForSymbol(upperSymbol, 250);
  
  if (prices.length === 0) {
    throw new Error(`No price data available for ${upperSymbol}`);
  }
  
  // Reverse to chronological order for indicator calculations
  prices.reverse();
  
  const closes = prices.map(p => p.close);
  const highs = prices.map(p => p.high);
  const lows = prices.map(p => p.low);
  
  const indicators: CalculatedIndicators = {
    symbol: upperSymbol,
    timestamp: new Date().toISOString()
  };
  
  // Calculate SMA50
  if (closes.length >= 50) {
    indicators.sma50 = simpleMovingAverage(closes, 50);
  }
  
  // Calculate SMA200
  if (closes.length >= 200) {
    indicators.sma200 = simpleMovingAverage(closes, 200);
  }
  
  // Calculate ATR14
  if (highs.length >= 15 && lows.length >= 15 && closes.length >= 15) {
    indicators.atr14 = atr14(highs, lows, closes);
  }
  
  // Calculate RSI14
  if (closes.length >= 15) {
    indicators.rsi14 = rsi14(closes);
  }
  
  return indicators;
}

/**
 * Get cached data status for a symbol
 */
export function getCacheStatus(symbol: string): {
  pricesCached: boolean;
  pricesFresh: boolean;
  fundamentalsCached: boolean;
  fundamentalsFresh: boolean;
} {
  const upperSymbol = symbol.toUpperCase();
  
  const latestPrice = getLatestPrice(upperSymbol);
  const fundamentals = getFundamentals(upperSymbol);
  
  return {
    pricesCached: !!latestPrice,
    pricesFresh: latestPrice ? isCacheFresh(latestPrice.date, CACHE_DURATION_PRICES) : false,
    fundamentalsCached: !!fundamentals,
    fundamentalsFresh: fundamentals ? isCacheFresh(fundamentals.fetched_at, CACHE_DURATION_FUNDAMENTALS) : false
  };
}

/**
 * Clear rate limit counters (useful for testing)
 */
export function clearRateLimits(): void {
  Object.keys(rateLimits).forEach(key => delete rateLimits[key]);
}
