/**
 * Today Queue - Prioritized Action List
 * 
 * Turns computed metrics into concrete next steps for manual trading.
 * High-signal, minimal, action-oriented.
 */

import type { Position } from './dbOperations';
import { getLatestPrice, getSymbol } from './db';
import { calculateIndicators } from './dataService';
import { getActionBadge, getFlags, getRiskFlags, type RuleInputs } from './rules';
import { checkDataFreshness, type DataFreshness } from './dataQuality';
import { calculatePositionRisk } from './riskMetrics';
import { getSettings } from './settingsService';

export type ActionSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ActionItem {
  id: string;
  symbol: string;
  severity: ActionSeverity;
  message: string;
  category: 'exit' | 'invalidation' | 'risk' | 'data' | 'missing' | 'watch';
  actions: ActionType[];
}

export type ActionType = 'edit' | 'journal' | 'refresh';

/**
 * Generate prioritized action queue from positions and data freshness
 */
export async function generateTodayQueue(
  positions: Position[],
  portfolioValue: number
): Promise<ActionItem[]> {
  const actionItems: ActionItem[] = [];
  const settings = getSettings();

  for (const position of positions) {
    const latestPrice = getLatestPrice(position.symbol);
    if (!latestPrice) {
      // No price data at all
      actionItems.push({
        id: `${position.symbol}-no-data`,
        symbol: position.symbol,
        severity: 'high',
        message: 'No price data available - refresh symbol data',
        category: 'data',
        actions: ['refresh']
      });
      continue;
    }

    // Check data freshness
    const freshness = checkDataFreshness(position.symbol);
    
    // Calculate indicators and risk
    let indicators: any = null;
    let actionBadge: string = 'HOLD';
    let flags: string[] = [];
    let riskFlags: string[] = [];

    try {
      indicators = await calculateIndicators(position.symbol);
      
      if (indicators.sma50 && indicators.sma200 && indicators.atr14) {
        const inputs: RuleInputs = {
          close: latestPrice.close,
          sma50: indicators.sma50,
          sma200: indicators.sma200,
          atr: indicators.atr14,
          rsi: indicators.rsi14,
          invalidation: position.invalidation,
          momentumPositive: latestPrice.close > indicators.sma50
        };
        
        actionBadge = getActionBadge(inputs);
        flags = getFlags(inputs);
        
        // Calculate risk flags
        const positionRisk = calculatePositionRisk(
          position,
          latestPrice.close,
          portfolioValue,
          indicators.atr14
        );
        riskFlags = getRiskFlags(positionRisk, settings, position.invalidation);
      }
    } catch (err) {
      console.warn(`Failed to calculate indicators for ${position.symbol}:`, err);
    }

    // PRIORITY 1: EXIT (stop broken / below invalidation)
    if (actionBadge === 'EXIT') {
      actionItems.push({
        id: `${position.symbol}-exit`,
        symbol: position.symbol,
        severity: 'critical',
        message: position.invalidation && latestPrice.close < position.invalidation
          ? `Price ($${latestPrice.close.toFixed(2)}) below invalidation ($${position.invalidation.toFixed(2)}) - EXIT NOW`
          : 'Technical breakdown - EXIT signal triggered',
        category: 'exit',
        actions: ['edit', 'journal']
      });
      continue; // Don't add other items for this position if EXIT
    }

    // PRIORITY 2: Near invalidation
    if (flags.includes('Near invalidation')) {
      actionItems.push({
        id: `${position.symbol}-near-invalidation`,
        symbol: position.symbol,
        severity: 'high',
        message: `Price approaching invalidation ($${position.invalidation?.toFixed(2)}) - monitor closely`,
        category: 'invalidation',
        actions: ['edit', 'journal']
      });
    }

    // PRIORITY 3: Risk too high
    if (riskFlags.includes('Risk too high')) {
      actionItems.push({
        id: `${position.symbol}-risk-high`,
        symbol: position.symbol,
        severity: 'high',
        message: 'Position risk exceeds maximum allowed - reduce size or tighten stop',
        category: 'risk',
        actions: ['edit', 'journal']
      });
    }

    // PRIORITY 4: Data stale/error
    if (freshness.quality === 'error' || freshness.quality === 'stale') {
      const dataMessage = freshness.quality === 'error'
        ? 'Data fetch error - cannot calculate indicators'
        : `Price data stale (${freshness.priceAge}) - refresh to ensure accuracy`;
      
      actionItems.push({
        id: `${position.symbol}-data-${freshness.quality}`,
        symbol: position.symbol,
        severity: freshness.quality === 'error' ? 'high' : 'medium',
        message: dataMessage,
        category: 'data',
        actions: ['refresh']
      });
    }

    // PRIORITY 5: Missing thesis/invalidation/target
    const missingFields: string[] = [];
    if (!position.thesis || position.thesis.trim() === '') {
      missingFields.push('thesis');
    }
    if (!position.invalidation) {
      missingFields.push('invalidation');
    }
    if (!position.target) {
      missingFields.push('target');
    }

    if (missingFields.length > 0) {
      actionItems.push({
        id: `${position.symbol}-missing-fields`,
        symbol: position.symbol,
        severity: 'medium',
        message: `Missing: ${missingFields.join(', ')} - complete position setup`,
        category: 'missing',
        actions: ['edit']
      });
    }

    // PRIORITY 6: REDUCE signal or other watch items
    if (actionBadge === 'REDUCE') {
      actionItems.push({
        id: `${position.symbol}-reduce`,
        symbol: position.symbol,
        severity: 'low',
        message: 'Consider reducing position - extended move or overbought',
        category: 'watch',
        actions: ['edit', 'journal']
      });
    }
  }

  // Sort by priority
  return sortActionItems(actionItems);
}

/**
 * Sort action items by severity priority
 */
function sortActionItems(items: ActionItem[]): ActionItem[] {
  const severityOrder: Record<ActionSeverity, number> = {
    'critical': 1,
    'high': 2,
    'medium': 3,
    'low': 4
  };

  return items.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    
    // Within same severity, sort by category order
    const categoryOrder: Record<string, number> = {
      'exit': 1,
      'invalidation': 2,
      'risk': 3,
      'data': 4,
      'missing': 5,
      'watch': 6
    };
    
    return (categoryOrder[a.category] || 99) - (categoryOrder[b.category] || 99);
  });
}
