/**
 * Data Quality Indicator Component
 * 
 * Shows a colored dot indicating data quality and freshness
 * Tooltip provides detailed information about when data was last updated
 */

import { checkDataFreshness } from '../lib/dataQuality';
import { getSymbol } from '../lib/db';
import { getSettings } from '../lib/settingsService';

interface DataQualityIndicatorProps {
  symbol: string;
}

export default function DataQualityIndicator({ symbol }: DataQualityIndicatorProps) {
  const settings = getSettings();
  const freshness = checkDataFreshness(
    symbol,
    settings.dataQuality.priceStaleMinutes,
    settings.dataQuality.fundamentalsStaleDays
  );
  const symbolData = getSymbol(symbol);
  
  const colors = {
    ok: 'bg-emerald-500',
    stale: 'bg-yellow-500',
    partial: 'bg-orange-500',
    error: 'bg-rose-500'
  };
  
  const tooltipContent = `Prices: ${freshness.priceAge}\nFundamentals: ${freshness.fundamentalsAge}${
    freshness.quality === 'error' && symbolData?.last_error 
      ? `\nError: ${symbolData.last_error}` 
      : ''
  }`;
  
  return (
    <div 
      className={`w-2 h-2 rounded-full ${colors[freshness.quality]}`}
      title={tooltipContent}
    />
  );
}
