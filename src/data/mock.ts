import { ActionBadge, AlertItem, JournalEntry, PositionSnapshot, RegimeSummary, WatchlistItem } from '../lib/types';

export const regimeSummary: RegimeSummary = {
  mode: 'Neutral',
  explanation:
    'SPY sits slightly above the 200D while breadth is mixed; volatility proxy has cooled but remains above the 3M average.',
  breadthPct: 54,
  spyAboveSma200: true,
  vixProxy: 'ATR trend flattening'
};

export const alerts: AlertItem[] = [
  {
    id: '1',
    symbol: 'NVDA',
    message: 'Near invalidation (within 1 ATR).',
    severity: 'warn'
  },
  {
    id: '2',
    symbol: 'XOM',
    message: 'Below 200D trend. Review thesis alignment.',
    severity: 'danger'
  },
  {
    id: '3',
    symbol: 'TLT',
    message: 'Move +2.3 ATR vs 20D average.',
    severity: 'info'
  }
];

export const positions: PositionSnapshot[] = [
  {
    symbol: 'NVDA',
    name: 'NVIDIA',
    qty: 42,
    avgCost: 925.4,
    last: 905.12,
    pnl: -853.5,
    pnlPct: -2.2,
    portfolioPct: 18.4,
    thesisTag: 'Growth',
    timeHorizon: 'Months',
    thesis: 'AI infrastructure leader; demand durable through 2025 capex wave.',
    invalidation: 860,
    target: 1100,
    aboveSma50: true,
    aboveSma200: true,
    atrPct: 4.8,
    rsi: 62,
    actionBadge: 'HOLD',
    flags: ['Near invalidation']
  },
  {
    symbol: 'XOM',
    name: 'Exxon Mobil',
    qty: 120,
    avgCost: 109.2,
    last: 103.6,
    pnl: -672,
    pnlPct: -5.1,
    portfolioPct: 9.2,
    thesisTag: 'Energy',
    timeHorizon: 'Weeks',
    thesis: 'Supply discipline + buybacks support downside while geopolitical risk persists.',
    invalidation: 100,
    target: 125,
    aboveSma50: false,
    aboveSma200: false,
    atrPct: 2.9,
    rsi: 43,
    actionBadge: 'WATCH',
    flags: ['Below 200D']
  },
  {
    symbol: 'GLD',
    name: 'SPDR Gold',
    qty: 80,
    avgCost: 190.1,
    last: 196.4,
    pnl: 504,
    pnlPct: 3.3,
    portfolioPct: 6.7,
    thesisTag: 'Hedge',
    timeHorizon: 'Years',
    thesis: 'Maintain defensive hedge vs policy and liquidity shocks.',
    aboveSma50: true,
    aboveSma200: true,
    atrPct: 1.8,
    rsi: 58,
    actionBadge: 'HOLD',
    flags: []
  },
  {
    symbol: 'PLTR',
    name: 'Palantir',
    qty: 200,
    avgCost: 21.2,
    last: 18.5,
    pnl: -540,
    pnlPct: -12.7,
    portfolioPct: 5.1,
    thesisTag: 'Spec',
    timeHorizon: 'Months',
    thesis: '',
    invalidation: 17,
    aboveSma50: false,
    aboveSma200: true,
    atrPct: 6.2,
    rsi: 39,
    actionBadge: 'WATCH',
    flags: ['Missing thesis']
  }
];

export const watchlist: WatchlistItem[] = [
  {
    symbol: 'AVGO',
    name: 'Broadcom',
    thesisTag: 'Growth',
    timeHorizon: 'Months',
    notes: 'AI + infrastructure blend. Waiting for volume confirmation.',
    last: 1415.2,
    aboveSma200: true,
    atrPct: 3.4
  },
  {
    symbol: 'RTX',
    name: 'RTX Corp',
    thesisTag: 'Defense',
    timeHorizon: 'Years',
    notes: 'Cycle tailwinds from defense budgets; watch for margin inflection.',
    last: 103.8,
    aboveSma200: false,
    atrPct: 2.3
  },
  {
    symbol: 'TSLA',
    name: 'Tesla',
    thesisTag: 'Spec',
    timeHorizon: 'Weeks',
    notes: 'High volatility; only consider after base builds.',
    last: 221.9,
    aboveSma200: true,
    atrPct: 5.9
  }
];

export const journalEntries: JournalEntry[] = [
  {
    id: 1,
    createdAt: '2024-09-07',
    type: 'trade',
    symbol: 'NVDA',
    thesis: 'Breakout from consolidation with strong AI capex signals.',
    outcome: 'Scaled out at target, remainder held.',
    lesson: 'Pre-plan trims to avoid emotional sells.'
  },
  {
    id: 2,
    createdAt: '2024-09-05',
    type: 'note',
    thesis: 'Market breadth weakening, reduce gross exposure.',
    lesson: 'Track breadth weekly to avoid late-cycle surprises.'
  },
  {
    id: 3,
    createdAt: '2024-08-30',
    type: 'postmortem',
    symbol: 'XOM',
    thesis: 'Expected upside on oil spike.',
    outcome: 'Oil reversed, stock lagged. Thesis invalid.',
    lesson: 'Set clearer invalidation levels for macro trades.'
  }
];

export const aiReviewSnippets: Record<ActionBadge, string> = {
  HOLD: 'Maintain thesis discipline; watch for regime shifts.',
  WATCH: 'Risk rising relative to thesis. Gather data before adjusting.',
  REDUCE: 'Position extended. Trim to reduce volatility drag.',
  EXIT: 'Thesis invalidation triggered. Close or de-risk promptly.',
  ADD: 'Conditions align with thesis and risk budget permits.'
};
