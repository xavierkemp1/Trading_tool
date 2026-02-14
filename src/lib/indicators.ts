export function simpleMovingAverage(values: number[], window: number): number {
  if (values.length < window) return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const slice = values.slice(values.length - window);
  return slice.reduce((sum, value) => sum + value, 0) / window;
}

/**
 * @deprecated Use wilderAtr() for industry-standard Wilder smoothing
 */
export function simpleAtr(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  const length = Math.min(highs.length, lows.length, closes.length);
  if (length === 0) return 0;
  const ranges = [] as number[];
  for (let i = 1; i < length; i += 1) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    ranges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  const window = Math.min(period, ranges.length);
  if (window === 0) return 0;
  const slice = ranges.slice(ranges.length - window);
  return slice.reduce((sum, value) => sum + value, 0) / window;
}

/**
 * Calculate ATR using Wilder's smoothing method (industry standard)
 * Matches TradingView and other charting platforms
 */
export function wilderAtr(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  const length = Math.min(highs.length, lows.length, closes.length);
  if (length < period + 1) return 0; // Need at least period + 1 data points
  
  // Calculate True Range for each period
  const trueRanges: number[] = [];
  for (let i = 1; i < length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }
  
  if (trueRanges.length < period) return 0;
  
  // Initial ATR is SMA of first 'period' true ranges
  let atr = 0;
  for (let i = 0; i < period; i++) {
    atr += trueRanges[i];
  }
  atr = atr / period;
  
  // Apply Wilder's smoothing for remaining periods
  // Formula: ATR = ((prior ATR × (period - 1)) + current TR) / period
  for (let i = period; i < trueRanges.length; i++) {
    atr = ((atr * (period - 1)) + trueRanges[i]) / period;
  }
  
  return atr;
}

/**
 * Legacy ATR function - calls simpleAtr for backwards compatibility
 * @deprecated Use wilderAtr() for industry-standard Wilder smoothing
 */
export function atr14(highs: number[], lows: number[], closes: number[]): number {
  return simpleAtr(highs, lows, closes, 14);
}

/**
 * @deprecated Use wilderRsi() for industry-standard Wilder smoothing
 */
export function simpleRsi(closes: number[], period: number = 14): number {
  if (closes.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Calculate RSI using Wilder's smoothing method (industry standard)
 * Matches TradingView and other charting platforms
 */
export function wilderRsi(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50; // Need at least period + 1 data points
  
  // Calculate price changes
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  
  if (changes.length < period) return 50;
  
  // Initial average gain and loss (SMA of first 'period' changes)
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] >= 0) {
      avgGain += changes[i];
    } else {
      avgLoss += Math.abs(changes[i]);
    }
  }
  avgGain = avgGain / period;
  avgLoss = avgLoss / period;
  
  // Apply Wilder's smoothing for remaining periods
  // Formula: Avg = ((prior Avg × (period - 1)) + current value) / period
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    if (change >= 0) {
      avgGain = ((avgGain * (period - 1)) + change) / period;
      avgLoss = ((avgLoss * (period - 1)) + 0) / period;
    } else {
      avgGain = ((avgGain * (period - 1)) + 0) / period;
      avgLoss = ((avgLoss * (period - 1)) + Math.abs(change)) / period;
    }
  }
  
  // Calculate RSI
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Legacy RSI function - calls simpleRsi for backwards compatibility
 * @deprecated Use wilderRsi() for industry-standard Wilder smoothing
 */
export function rsi14(closes: number[]): number {
  return simpleRsi(closes, 14);
}
