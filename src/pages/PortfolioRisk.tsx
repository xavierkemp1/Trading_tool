import SectionHeader from '../components/SectionHeader';

const exposureRows = [
  { label: 'Energy', pct: 18.2 },
  { label: 'Growth', pct: 32.5 },
  { label: 'Defense', pct: 7.4 },
  { label: 'Hedge', pct: 11.8 },
  { label: 'Spec', pct: 9.1 }
];

const correlationRows = [
  { pair: 'NVDA / AVGO', value: 0.82 },
  { pair: 'NVDA / SMCI', value: 0.77 },
  { pair: 'XOM / CVX', value: 0.74 },
  { pair: 'GLD / TLT', value: -0.12 }
];

const scenarios = [
  { label: 'Market -10%', impact: '-7.4%' },
  { label: 'Oil -20%', impact: '-2.1%' },
  { label: 'Rates +1%', impact: '-3.3%' },
  { label: 'Gold -10%', impact: '-1.0%' }
];

export default function PortfolioRisk() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeader title="Portfolio & Risk" subtitle="Concentration, diversification, and stress tests" />

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="card">
          <SectionHeader title="Exposure breakdown" subtitle="By thesis tag / sector / currency" />
          <div className="mt-4 space-y-3">
            {exposureRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{row.label}</span>
                <span className="text-slate-100">{row.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-2 text-xs text-slate-400">
            <p>Diversification score: 0.23 (lower is more diversified).</p>
            <p>Top 5 positions = 54.8% of portfolio.</p>
          </div>
        </div>
        <div className="card">
          <SectionHeader title="Stress tests" subtitle="Approximate portfolio impact" />
          <div className="mt-4 space-y-3 text-sm">
            {scenarios.map((scenario) => (
              <div key={scenario.label} className="flex items-center justify-between">
                <span className="text-slate-300">{scenario.label}</span>
                <span className="text-rose-200">{scenario.impact}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHeader title="Correlation matrix" subtitle="90-180 day daily returns" />
        <div className="mt-4 grid gap-3">
          {correlationRows.map((row) => (
            <div key={row.pair} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
              <span className="text-sm text-slate-300">{row.pair}</span>
              <span className={`text-sm ${row.value > 0.7 ? 'text-amber-200' : 'text-slate-100'}`}>
                {row.value.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
