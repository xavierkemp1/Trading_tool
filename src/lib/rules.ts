import { ActionBadge } from './types';

export interface RuleInputs {
  close: number;
  sma50: number;
  sma200: number;
  atr: number;
  rsi?: number;
  invalidation?: number;
  momentumPositive: boolean;
}

export interface BadgeRuleSettings {
  exitBelowSma200: boolean;
  atrMultipleForReduce: number;
  rsiOverbought: number;
}

export const defaultRuleSettings: BadgeRuleSettings = {
  exitBelowSma200: false,
  atrMultipleForReduce: 2,
  rsiOverbought: 70
};

export function getActionBadge(inputs: RuleInputs, settings = defaultRuleSettings): ActionBadge {
  const { close, sma50, sma200, atr, rsi, invalidation, momentumPositive } = inputs;

  if (invalidation !== undefined && close < invalidation) {
    return 'EXIT';
  }

  if (close < sma200) {
    return settings.exitBelowSma200 ? 'EXIT' : 'WATCH';
  }

  if (close > sma50 + settings.atrMultipleForReduce * atr && (rsi ?? 0) > settings.rsiOverbought) {
    return 'REDUCE';
  }

  if (close > sma200 && momentumPositive) {
    return 'HOLD';
  }

  return 'WATCH';
}

export function getFlags(inputs: RuleInputs): string[] {
  const flags: string[] = [];
  const { close, atr, invalidation } = inputs;

  if (invalidation !== undefined && close < invalidation + atr) {
    flags.push('Near invalidation');
  }

  if (Math.abs(close - (invalidation ?? close)) > 2 * atr) {
    flags.push('Big move');
  }

  return flags;
}
