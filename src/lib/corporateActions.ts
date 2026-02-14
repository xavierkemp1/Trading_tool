import { type Price } from './db';

/**
 * Detection result for corporate actions
 */
export interface CorporateActionDetection {
  detected: boolean;
  type?: 'split' | 'reverse_split' | 'dividend' | 'unknown';
  ratio?: string;
  date?: string;
  confidence: 'high' | 'medium' | 'low';
  details?: string;
}

/**
 * Detects potential stock splits by analyzing abnormal price jumps
 * 
 * Criteria for split detection:
 * - Price drops by ~50% (2:1 split) or ~66% (3:1 split) overnight
 * - Volume increases significantly (>200% of average)
 * - Open price approximately matches previous close divided by split ratio
 * 
 * @param prices Array of prices in descending order by date (most recent first)
 * @returns Detection result with type and ratio if detected
 */
export function detectStockSplit(prices: Price[]): CorporateActionDetection {
  if (prices.length < 20) {
    return { detected: false, confidence: 'low' };
  }
  
  // Sort by date descending to ensure we have chronological order (newest first)
  const sortedPrices = [...prices].sort((a, b) => b.date.localeCompare(a.date));
  
  // Check last 20 days for abnormal price movements
  for (let i = 1; i < Math.min(20, sortedPrices.length); i++) {
    // When sorted DESC: i-1 is newer, i is older
    const newer = sortedPrices[i - 1];
    const older = sortedPrices[i];
    
    if (!newer || !older) continue;
    
    // Calculate price change from older to newer
    const priceChange = (newer.close - older.close) / older.close;
    const openVsPrevClose = newer.open / older.close;
    
    // Calculate average volume of previous 10 days (excluding current day)
    const avgVolume = sortedPrices
      .slice(i + 1, i + 11)
      .reduce((sum, p) => sum + p.volume, 0) / 10;
    
    const volumeIncrease = avgVolume > 0 ? newer.volume / avgVolume : 1;
    
    // Check for 2:1 split (price drops ~50%)
    if (
      priceChange < -0.45 && 
      priceChange > -0.55 &&
      openVsPrevClose >= 0.45 &&
      openVsPrevClose <= 0.55 &&
      volumeIncrease > 1.5
    ) {
      return {
        detected: true,
        type: 'split',
        ratio: '2:1',
        date: newer.date,
        confidence: 'high',
        details: `Price dropped ${Math.abs(priceChange * 100).toFixed(1)}% on ${newer.date} with ${(volumeIncrease * 100).toFixed(0)}% volume increase`
      };
    }
    
    // Check for 3:1 split (price drops ~66%)
    if (
      priceChange < -0.62 && 
      priceChange > -0.70 &&
      openVsPrevClose >= 0.30 &&
      openVsPrevClose <= 0.38 &&
      volumeIncrease > 1.5
    ) {
      return {
        detected: true,
        type: 'split',
        ratio: '3:1',
        date: newer.date,
        confidence: 'high',
        details: `Price dropped ${Math.abs(priceChange * 100).toFixed(1)}% on ${newer.date} with ${(volumeIncrease * 100).toFixed(0)}% volume increase`
      };
    }
    
    // Check for 4:1 split (price drops ~75%)
    if (
      priceChange < -0.72 && 
      priceChange > -0.78 &&
      openVsPrevClose >= 0.22 &&
      openVsPrevClose <= 0.28 &&
      volumeIncrease > 1.5
    ) {
      return {
        detected: true,
        type: 'split',
        ratio: '4:1',
        date: newer.date,
        confidence: 'high',
        details: `Price dropped ${Math.abs(priceChange * 100).toFixed(1)}% on ${newer.date} with ${(volumeIncrease * 100).toFixed(0)}% volume increase`
      };
    }
    
    // Check for reverse split (price increases by ~100% for 1:2)
    if (
      priceChange > 0.9 && 
      priceChange < 1.1 &&
      openVsPrevClose >= 1.9 &&
      openVsPrevClose <= 2.1 &&
      volumeIncrease > 1.5
    ) {
      return {
        detected: true,
        type: 'reverse_split',
        ratio: '1:2',
        date: newer.date,
        confidence: 'high',
        details: `Price increased ${(priceChange * 100).toFixed(1)}% on ${newer.date} with ${(volumeIncrease * 100).toFixed(0)}% volume increase`
      };
    }
    
    // Check for other abnormal price movements (potential unidentified corporate action)
    if (
      (Math.abs(priceChange) > 0.40 && volumeIncrease > 3.0) ||
      (Math.abs(priceChange) > 0.60 && volumeIncrease > 2.0)
    ) {
      return {
        detected: true,
        type: 'unknown',
        date: newer.date,
        confidence: 'medium',
        details: `Abnormal price movement of ${(priceChange * 100).toFixed(1)}% on ${newer.date} with ${(volumeIncrease * 100).toFixed(0)}% volume increase`
      };
    }
  }
  
  return { detected: false, confidence: 'low' };
}

/**
 * Formats corporate action detection for storage/display
 */
export function formatCorporateActionWarning(detection: CorporateActionDetection): string | null {
  if (!detection.detected) return null;
  
  const typeLabel = 
    detection.type === 'split' ? 'Stock Split' :
    detection.type === 'reverse_split' ? 'Reverse Split' :
    detection.type === 'dividend' ? 'Dividend' :
    'Corporate Action';
  
  const parts = [typeLabel];
  
  if (detection.ratio) {
    parts.push(`(${detection.ratio})`);
  }
  
  if (detection.date) {
    parts.push(`detected on ${detection.date}`);
  }
  
  if (detection.details) {
    parts.push(`- ${detection.details}`);
  }
  
  return parts.join(' ');
}
