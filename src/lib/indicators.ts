export function simpleMovingAverage(values: number[], window: number): number {
  if (values.length < window) return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const slice = values.slice(values.length - window);
  return slice.reduce((sum, value) => sum + value, 0) / window;
}

export function atr14(highs: number[], lows: number[], closes: number[]): number {
  const length = Math.min(highs.length, lows.length, closes.length);
  if (length === 0) return 0;
  const ranges = [] as number[];
  for (let i = 1; i < length; i += 1) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    ranges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  const window = Math.min(14, ranges.length);
  if (window === 0) return 0;
  const slice = ranges.slice(ranges.length - window);
  return slice.reduce((sum, value) => sum + value, 0) / window;
}

export function rsi14(closes: number[]): number {
  const window = 14;
  if (closes.length <= window) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - window; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / window;
  const avgLoss = losses / window;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
