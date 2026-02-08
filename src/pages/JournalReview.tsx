import SectionHeader from '../components/SectionHeader';
import { journalEntries } from '../data/mock';

export default function JournalReview() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Journal & AI Review"
        subtitle="Process-focused logs, postmortems, and weekly review."
        action={
          <button className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-100 hover:bg-slate-700">
            New entry
          </button>
        }
      />

      <div className="card">
        <SectionHeader title="Journal entries" subtitle="Filter by symbol, date range, or type" />
        <div className="mt-4 space-y-3">
          {journalEntries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs uppercase text-slate-400">
                  {entry.type} · {entry.createdAt}
                </span>
                {entry.symbol ? <span className="text-xs text-slate-300">{entry.symbol}</span> : null}
              </div>
              <p className="mt-2 text-sm text-slate-100">{entry.thesis}</p>
              {entry.outcome ? <p className="text-xs text-slate-400">Outcome: {entry.outcome}</p> : null}
              <p className="mt-2 text-xs text-slate-400">Lesson: {entry.lesson}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="card">
          <SectionHeader title="Analytics" subtitle="Simple performance patterns" />
          <div className="mt-4 grid gap-2 text-sm text-slate-300">
            <div className="flex justify-between">
              <span>Win rate</span>
              <span className="text-emerald-200">54%</span>
            </div>
            <div className="flex justify-between">
              <span>Avg win / loss</span>
              <span>1.8x</span>
            </div>
            <div className="flex justify-between">
              <span>Best themes</span>
              <span>Growth, Hedge</span>
            </div>
            <div className="flex justify-between">
              <span>Worst themes</span>
              <span>Spec</span>
            </div>
          </div>
        </div>
        <div className="card">
          <SectionHeader title="Weekly AI review" subtitle="Structured critique" />
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <p>• Missing thesis on 1 position (PLTR).</p>
            <p>• Growth exposure 32.5% with high correlation.</p>
            <p>• Review invalidation levels for energy names.</p>
          </div>
          <button className="mt-4 w-full rounded-lg bg-cyan-500/20 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/30">
            Generate weekly review
          </button>
        </div>
      </div>
    </div>
  );
}
