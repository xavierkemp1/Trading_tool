export type ThesisTag =
  | 'Energy'
  | 'Defense'
  | 'Growth'
  | 'Hedge'
  | 'Spec'
  | 'Other';

export type TimeHorizon = 'Days' | 'Weeks' | 'Months' | 'Years';

export type ActionBadge = 'HOLD' | 'WATCH' | 'REDUCE' | 'EXIT' | 'ADD';

export interface PositionSnapshot {
  symbol: string;
  name: string;
  qty: number;
  avgCost: number;
  last: number;
  pnl: number;
  pnlPct: number;
  portfolioPct: number;
  thesisTag: ThesisTag;
  timeHorizon: TimeHorizon;
  thesis?: string;
  invalidation?: number;
  target?: number;
  aboveSma50: boolean;
  aboveSma200: boolean;
  atrPct: number;
  rsi?: number;
  actionBadge: ActionBadge;
  flags: string[];
  riskDollars?: number;
  riskPctOfPortfolio?: number;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  thesisTag: ThesisTag;
  timeHorizon: TimeHorizon;
  notes: string;
  last: number;
  aboveSma200: boolean;
  atrPct: number;
}

export interface RegimeSummary {
  mode: 'Risk-on' | 'Neutral' | 'Risk-off';
  explanation: string;
  breadthPct: number;
  spyAboveSma200: boolean;
  vixProxy: string;
}

export interface AlertItem {
  id: string;
  symbol: string;
  message: string;
  severity: 'warn' | 'danger' | 'info';
}

export interface JournalEntry {
  id: number;
  createdAt: string;
  type: 'trade' | 'note' | 'postmortem';
  symbol?: string;
  thesis: string;
  lesson: string;
  outcome?: string;
}
