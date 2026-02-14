/**
 * Risk Metrics Calculation
 * 
 * Calculates position risk based on invalidation levels and portfolio value
 * Helps traders maintain discipline by quantifying downside risk
 */

import type { Position } from './dbOperations';

export interface PositionRisk {
  riskPerShare: number;
  riskDollars: number;
  riskPctOfPortfolio: number;
  atrStopDistance: number | null;
  riskBasis: 'avg_cost' | 'current_price';
}

/**
 * Calculates comprehensive risk metrics for a position
 * 
 * @param position - The position to calculate risk for
 * @param currentPrice - Current market price
 * @param portfolioValue - Total portfolio value for % calculation
 * @param atr14 - 14-day Average True Range (optional)
 * @param riskBasis - Whether to calculate risk from avg_cost or current_price
 * @returns Comprehensive risk metrics
 */
export function calculatePositionRisk(
  position: Position,
  currentPrice: number,
  portfolioValue: number,
  atr14?: number,
  riskBasis: 'avg_cost' | 'current_price' = 'avg_cost'
): PositionRisk {
  // Calculate risk per share
  // Risk is the difference between entry/current price and invalidation
  const basisPrice = riskBasis === 'avg_cost' ? position.avg_cost : currentPrice;
  const invalidation = position.invalidation ?? 0;
  
  // Risk per share is how much we could lose if invalidation is hit
  // If no invalidation is set, risk is 0 (we don't know our risk!)
  const riskPerShare = invalidation > 0 ? Math.max(0, basisPrice - invalidation) : 0;
  
  // Total dollar risk for this position
  const riskDollars = riskPerShare * position.qty;
  
  // Risk as percentage of portfolio
  const riskPctOfPortfolio = portfolioValue > 0 
    ? (riskDollars / portfolioValue) * 100 
    : 0;
  
  // Calculate ATR stop distance (how many ATRs away is our invalidation)
  // This helps understand if our stop is too tight or too loose
  let atrStopDistance: number | null = null;
  if (atr14 && atr14 > 0 && invalidation > 0) {
    atrStopDistance = (currentPrice - invalidation) / atr14;
  }
  
  return {
    riskPerShare,
    riskDollars,
    riskPctOfPortfolio,
    atrStopDistance,
    riskBasis
  };
}
