import SectionHeader from '../components/SectionHeader';
import StatPill from '../components/StatPill';
import { alerts, regimeSummary } from '../data/mock';

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Today View"
        subtitle="High-signal snapshot for manual trading decisions."
        action={
          <div className="flex gap-2">
            <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
              Refresh data
            </button>
            <button className="rounded-lg bg-cyan-500/20 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/30">
              Weekly AI review
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="card">
          <SectionHeader title="Market regime" subtitle="Simple, explainable model" />
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Regime</span>
              <span className="text-base font-semibold text-slate-100">{regimeSummary.mode}</span>
            </div>
            <p className="text-sm text-slate-300">{regimeSummary.explanation}</p>
            <div className="flex flex-wrap gap-2">
              <StatPill label="Breadth" value={`${regimeSummary.breadthPct}% above SMA50`} />
              <StatPill label="SPY trend" value={regimeSummary.spyAboveSma200 ? 'Above 200D' : 'Below 200D'} />
              <StatPill label="Volatility" value={regimeSummary.vixProxy} />
            </div>
          </div>
        </div>
        <div className="card">
          <SectionHeader title="Portfolio summary" />
          <div className="mt-4 grid gap-2">
            <StatPill label="Total value" value="$486,200" />
            <StatPill label="Daily change" value="+0.6%" tone="positive" />
            <StatPill label="Weekly change" value="-1.4%" tone="negative" />
            <StatPill label="Cash %" value="12.5%" />
            <StatPill label="Largest position" value="18.4% (NVDA)" />
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHeader title="Alerts" subtitle="Focus list capped at 10" />
        <div className="mt-4 space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
            >
              <div>
                <p className="text-sm font-semibold text-slate-100">{alert.symbol}</p>
                <p className="text-xs text-slate-400">{alert.message}</p>
              </div>
              <span
                className={`badge ${{
                  info: 'bg-cyan-500/20 text-cyan-200',
                  warn: 'bg-yellow-500/20 text-yellow-200',
                  danger: 'bg-rose-500/20 text-rose-200'
                }[alert.severity]}`}
              >
                {alert.severity.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
