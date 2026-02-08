import SectionHeader from '../components/SectionHeader';
import { aiReviewSnippets, positions } from '../data/mock';

export default function CurrentInvestments() {
  const selected = positions[0];

  return (
    <div className="grid gap-6 xl:grid-cols-[3fr,2fr]">
      <div className="card">
        <SectionHeader title="Current Investments" subtitle="Active positions and discipline checks" />
        <table className="table-grid mt-4">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Pos %</th>
              <th>Qty</th>
              <th>Avg cost</th>
              <th>Last</th>
              <th>P/L $</th>
              <th>P/L %</th>
              <th>Trend</th>
              <th>ATR%</th>
              <th>Thesis</th>
              <th>Action</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <tr key={position.symbol}>
                <td className="font-semibold text-slate-100">{position.symbol}</td>
                <td>{position.portfolioPct.toFixed(1)}%</td>
                <td>{position.qty}</td>
                <td>${position.avgCost.toFixed(2)}</td>
                <td>${position.last.toFixed(2)}</td>
                <td className={position.pnl >= 0 ? 'text-emerald-200' : 'text-rose-200'}>
                  {position.pnl >= 0 ? '+' : ''}
                  {position.pnl.toFixed(0)}
                </td>
                <td className={position.pnlPct >= 0 ? 'text-emerald-200' : 'text-rose-200'}>
                  {position.pnlPct >= 0 ? '+' : ''}
                  {position.pnlPct.toFixed(1)}%
                </td>
                <td className="text-xs">
                  {position.aboveSma50 ? '▲50D' : '▼50D'} / {position.aboveSma200 ? '▲200D' : '▼200D'}
                </td>
                <td>{position.atrPct.toFixed(1)}%</td>
                <td className={position.thesis ? 'text-slate-300' : 'text-rose-200'}>
                  {position.thesis ? position.thesisTag : 'Missing'}
                </td>
                <td>
                  <span className={`badge badge-${position.actionBadge.toLowerCase()}`}>{position.actionBadge}</span>
                </td>
                <td className="text-xs text-slate-400">{position.flags.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-6">
        <div className="card">
          <SectionHeader title={`${selected.symbol} detail`} subtitle="Last 6 months with SMA50/200" />
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
            <p>Chart placeholder (close + SMA50/200 + volume optional).</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <div className="flex justify-between">
              <span>Market cap</span>
              <span>$2.2T</span>
            </div>
            <div className="flex justify-between">
              <span>Forward P/E</span>
              <span>31.4</span>
            </div>
            <div className="flex justify-between">
              <span>Revenue growth</span>
              <span>+44%</span>
            </div>
            <div className="flex justify-between">
              <span>Total debt</span>
              <span>$10.2B</span>
            </div>
          </div>
        </div>

        <div className="card">
          <SectionHeader title="Thesis & invalidation" />
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-xs uppercase text-slate-400">Thesis</p>
              <p className="text-slate-200">{selected.thesis || 'Add a thesis to enforce discipline.'}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-xs uppercase text-slate-400">Invalidation</p>
                <p className="text-slate-200">{selected.invalidation ? `$${selected.invalidation}` : '—'}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-xs uppercase text-slate-400">Target</p>
                <p className="text-slate-200">{selected.target ? `$${selected.target}` : '—'}</p>
              </div>
            </div>
            <button className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700">
              AI review this position
            </button>
            <p className="text-xs text-slate-400">{aiReviewSnippets[selected.actionBadge]}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
