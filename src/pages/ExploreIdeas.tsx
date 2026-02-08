import SectionHeader from '../components/SectionHeader';
import { watchlist } from '../data/mock';

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
  return (
    <div className="flex flex-col gap-6">
      <SectionHeader title="Explore / New Ideas" subtitle="Shortlist only. Cap candidates to 50." />

      <div className="card">
        <SectionHeader title="Quant screen" subtitle="Objective filters" />
        <div className="mt-4 flex flex-wrap gap-2">
          {quantFilters.map((filter) => (
            <div key={filter.label} className="rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-300">
              {filter.label}: <span className="text-slate-100">{filter.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <table className="table-grid">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Last</th>
                <th>ATR%</th>
                <th>SMA200</th>
                <th>Action</th>
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
                    <button className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800">
                      Add to watchlist
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
