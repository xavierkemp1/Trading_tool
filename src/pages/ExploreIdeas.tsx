import { useState, useEffect, useCallback } from 'react';
import SectionHeader from '../components/SectionHeader';
import WatchlistManager from '../components/WatchlistManager';
import { getAllWatchlist, getLatestPrice, getSymbol } from '../lib/db';
import { calculateIndicators } from '../lib/dataService';
import type { WatchlistItem } from '../lib/types';

const quantFilters = [
  { label: 'Above SMA200', value: 'On' },
  { label: '1M Rel Strength vs SPY', value: 'Top 30%' },
  { label: 'ATR% band', value: '2% - 6%' },
  { label: 'Rising volume', value: '2 of last 3 weeks' }
];

const narrativeClusters = [
  {
    symbol: 'NVDA',
    mentions: 82,
    change: '+14%',
    sentiment: 'Mixed',
    themes: ['Supply chain', 'Enterprise AI', 'Margins']
  },
  {
    symbol: 'SMCI',
    mentions: 48,
    change: '+7%',
    sentiment: 'Positive',
    themes: ['Data center demand', 'Short squeeze', 'Guidance']
  },
  {
    symbol: 'TSLA',
    mentions: 55,
    change: '-9%',
    sentiment: 'Negative',
    themes: ['Deliveries', 'Pricing', 'China mix']
  }
];

export default function ExploreIdeas() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    try {
      const dbWatchlist = getAllWatchlist();
      const items: WatchlistItem[] = [];
      
      for (const entry of dbWatchlist) {
        const latestPrice = getLatestPrice(entry.symbol);
        const symbolInfo = getSymbol(entry.symbol);
        
        if (!latestPrice) {
          console.warn(`No price data for ${entry.symbol}`);
          continue;
        }
        
        let indicators;
        try {
          indicators = await calculateIndicators(entry.symbol);
        } catch (err) {
          console.warn(`Failed to calculate indicators for ${entry.symbol}:`, err);
          continue;
        }
        
        const aboveSma200 = indicators.sma200 ? latestPrice.close > indicators.sma200 : false;
        const atrPct = indicators.atr14 ? (indicators.atr14 / latestPrice.close) * 100 : 0;
        
        items.push({
          symbol: entry.symbol,
          name: symbolInfo?.name || entry.symbol,
          thesisTag: entry.thesis_tag || 'Other',
          timeHorizon: 'Months', // Default
          notes: entry.notes || '',
          last: latestPrice.close,
          aboveSma200,
          atrPct
        });
      }
      
      setWatchlist(items);
    } catch (err) {
      console.error('Failed to load watchlist:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader title="Explore / New Ideas" subtitle="Shortlist only. Cap candidates to 50." />

      <WatchlistManager onUpdate={loadWatchlist} />

      <div className="card">
        <SectionHeader title="Watchlist" subtitle="Your tracked ideas" />
        {loading ? (
          <div className="mt-4 text-sm text-slate-400">Loading watchlist...</div>
        ) : watchlist.length === 0 ? (
          <div className="mt-4 text-sm text-slate-400">No watchlist items yet. Add symbols above to track them.</div>
        ) : (
          <div className="mt-4">
            <table className="table-grid">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Last</th>
                  <th>ATR%</th>
                  <th>SMA200</th>
                  <th>Thesis</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((item) => (
                  <tr key={item.symbol}>
                    <td className="font-semibold text-slate-100">{item.symbol}</td>
                    <td>{item.name}</td>
                    <td>${item.last.toFixed(2)}</td>
                    <td>{item.atrPct.toFixed(1)}%</td>
                    <td>{item.aboveSma200 ? 'Above' : 'Below'}</td>
                    <td>
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                        {item.thesisTag}
                      </span>
                    </td>
                    <td className="text-xs text-slate-400">{item.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <SectionHeader title="Quant screen" subtitle="Objective filters" />
        <div className="mt-4 flex flex-wrap gap-2">
          {quantFilters.map((filter) => (
            <div key={filter.label} className="rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-300">
              {filter.label}: <span className="text-slate-100">{filter.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 text-sm text-slate-400">
          Quant screening feature coming soon. Use the watchlist manager above to track specific symbols.
        </div>
      </div>

      <div className="card">
        <SectionHeader title="Narrative signals" subtitle="Optional Reddit clustering (cached)" />
        <div className="mt-4 grid gap-3">
          {narrativeClusters.map((cluster) => (
            <div
              key={cluster.symbol}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-100">{cluster.symbol}</p>
                <p className="text-xs text-slate-400">
                  Mentions {cluster.mentions} ({cluster.change}) · Sentiment {cluster.sentiment}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {cluster.themes.map((theme) => (
                  <span key={theme} className="rounded-full border border-slate-800 px-2 py-1 text-xs text-slate-300">
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <SectionHeader title="Idea detail" subtitle="Select a candidate to review" />
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
          <p>Chart placeholder (price + SMA50/200). Fundamentals and AI idea review appear here.</p>
        </div>
        <button className="mt-4 w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700">
          AI idea review
        </button>
      </div>
    </div>
  );
}
