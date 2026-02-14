import { useEffect, useState, FormEvent } from 'react';
import SectionHeader from '../components/SectionHeader';
import { getAllJournalEntries, addJournalEntry, updateJournalEntry, deleteJournalEntry, type JournalEntry } from '../lib/db';
import type { ThesisTag } from '../lib/types';

const thesisTags: ThesisTag[] = ['Energy', 'Defense', 'Growth', 'Hedge', 'Spec', 'Other'];

export default function JournalReview() {
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  const [formData, setFormData] = useState({
    type: 'trade' as 'trade' | 'note' | 'postmortem',
    symbol: '',
    entryPrice: '',
    exitPrice: '',
    qty: '',
    plannedRiskPerShare: '',
    stopLoss: '',
    thesis: '',
    outcome: '',
    lesson: '',
    setupTag: '',
    thesisTag: 'Other' as ThesisTag,
    mfeR: '',
    maeR: '',
    holdingDays: ''
  });

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = () => {
    const entries = getAllJournalEntries();
    setJournalEntries(entries);
  };

  // Calculate R-multiple automatically
  const calculateRMultiple = (): number | null => {
    const entry = parseFloat(formData.entryPrice);
    const exit = parseFloat(formData.exitPrice);
    const riskPerShare = parseFloat(formData.plannedRiskPerShare);
    
    if (!isNaN(entry) && !isNaN(exit) && !isNaN(riskPerShare) && riskPerShare > 0) {
      const profitPerShare = exit - entry;
      return profitPerShare / riskPerShare;
    }
    return null;
  };

  // Calculate planned risk dollars
  const calculatePlannedRiskDollars = (): number | null => {
    const riskPerShare = parseFloat(formData.plannedRiskPerShare);
    const qty = parseFloat(formData.qty);
    
    if (!isNaN(riskPerShare) && !isNaN(qty) && riskPerShare > 0 && qty > 0) {
      return riskPerShare * qty;
    }
    return null;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    const rMultiple = calculateRMultiple();
    const plannedRiskDollars = calculatePlannedRiskDollars();
    
    const entryData: Omit<JournalEntry, 'id'> = {
      created_at: editingEntry?.created_at || new Date().toISOString(),
      type: formData.type,
      symbol: formData.symbol || undefined,
      entry_price: formData.entryPrice ? parseFloat(formData.entryPrice) : undefined,
      exit_price: formData.exitPrice ? parseFloat(formData.exitPrice) : undefined,
      qty: formData.qty ? parseFloat(formData.qty) : undefined,
      pnl: formData.exitPrice && formData.entryPrice && formData.qty 
        ? (parseFloat(formData.exitPrice) - parseFloat(formData.entryPrice)) * parseFloat(formData.qty) 
        : undefined,
      thesis: formData.thesis,
      invalidation: formData.stopLoss ? parseFloat(formData.stopLoss) : undefined,
      outcome: formData.outcome || undefined,
      lesson: formData.lesson,
      planned_risk_per_share: formData.plannedRiskPerShare ? parseFloat(formData.plannedRiskPerShare) : undefined,
      planned_risk_dollars: plannedRiskDollars || undefined,
      r_multiple: rMultiple || undefined,
      mfe_r: formData.mfeR ? parseFloat(formData.mfeR) : undefined,
      mae_r: formData.maeR ? parseFloat(formData.maeR) : undefined,
      holding_days: formData.holdingDays ? parseInt(formData.holdingDays) : undefined,
      setup_tag: formData.setupTag || undefined,
      thesis_tag: formData.thesisTag || undefined
    };

    if (editingEntry) {
      updateJournalEntry(editingEntry.id!, entryData);
    } else {
      addJournalEntry(entryData);
    }
    
    resetForm();
    loadEntries();
  };

  const resetForm = () => {
    setFormData({
      type: 'trade',
      symbol: '',
      entryPrice: '',
      exitPrice: '',
      qty: '',
      plannedRiskPerShare: '',
      stopLoss: '',
      thesis: '',
      outcome: '',
      lesson: '',
      setupTag: '',
      thesisTag: 'Other',
      mfeR: '',
      maeR: '',
      holdingDays: ''
    });
    setShowForm(false);
    setEditingEntry(null);
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setFormData({
      type: entry.type,
      symbol: entry.symbol || '',
      entryPrice: entry.entry_price?.toString() || '',
      exitPrice: entry.exit_price?.toString() || '',
      qty: entry.qty?.toString() || '',
      plannedRiskPerShare: entry.planned_risk_per_share?.toString() || '',
      stopLoss: entry.invalidation?.toString() || '',
      thesis: entry.thesis || '',
      outcome: entry.outcome || '',
      lesson: entry.lesson || '',
      setupTag: entry.setup_tag || '',
      thesisTag: (entry.thesis_tag as ThesisTag) || 'Other',
      mfeR: entry.mfe_r?.toString() || '',
      maeR: entry.mae_r?.toString() || '',
      holdingDays: entry.holding_days?.toString() || ''
    });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      deleteJournalEntry(id);
      loadEntries();
    }
  };

  // Calculate analytics
  const analytics = () => {
    const trades = journalEntries.filter(e => e.type === 'trade' && e.r_multiple !== undefined && e.r_multiple !== null);
    
    if (trades.length === 0) {
      return {
        winRate: 0,
        avgWinR: 0,
        avgLossR: 0,
        expectancy: 0,
        profitFactorBySetup: new Map<string, { wins: number, losses: number, profitFactor: number }>(),
        profitFactorByThesis: new Map<string, { wins: number, losses: number, profitFactor: number }>()
      };
    }

    const wins = trades.filter(t => (t.r_multiple || 0) > 0);
    const losses = trades.filter(t => (t.r_multiple || 0) < 0);
    
    const winRate = (wins.length / trades.length) * 100;
    const avgWinR = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.r_multiple || 0), 0) / wins.length : 0;
    const avgLossR = losses.length > 0 ? losses.reduce((sum, t) => sum + Math.abs(t.r_multiple || 0), 0) / losses.length : 0;
    const expectancy = (winRate / 100) * avgWinR - ((100 - winRate) / 100) * avgLossR;

    // Calculate profit factor by setup_tag
    const setupStats = new Map<string, { wins: number, losses: number }>();
    trades.forEach(t => {
      const tag = t.setup_tag || 'Untagged';
      if (!setupStats.has(tag)) {
        setupStats.set(tag, { wins: 0, losses: 0 });
      }
      const stats = setupStats.get(tag)!;
      if ((t.r_multiple || 0) > 0) {
        stats.wins += t.r_multiple || 0;
      } else {
        stats.losses += Math.abs(t.r_multiple || 0);
      }
    });

    const profitFactorBySetup = new Map<string, { wins: number, losses: number, profitFactor: number }>();
    setupStats.forEach((stats, tag) => {
      profitFactorBySetup.set(tag, {
        ...stats,
        profitFactor: stats.losses > 0 ? stats.wins / stats.losses : stats.wins
      });
    });

    // Calculate profit factor by thesis_tag
    const thesisStats = new Map<string, { wins: number, losses: number }>();
    trades.forEach(t => {
      const tag = t.thesis_tag || 'Untagged';
      if (!thesisStats.has(tag)) {
        thesisStats.set(tag, { wins: 0, losses: 0 });
      }
      const stats = thesisStats.get(tag)!;
      if ((t.r_multiple || 0) > 0) {
        stats.wins += t.r_multiple || 0;
      } else {
        stats.losses += Math.abs(t.r_multiple || 0);
      }
    });

    const profitFactorByThesis = new Map<string, { wins: number, losses: number, profitFactor: number }>();
    thesisStats.forEach((stats, tag) => {
      profitFactorByThesis.set(tag, {
        ...stats,
        profitFactor: stats.losses > 0 ? stats.wins / stats.losses : stats.wins
      });
    });

    return { winRate, avgWinR, avgLossR, expectancy, profitFactorBySetup, profitFactorByThesis };
  };

  const stats = analytics();
  const rMultiple = calculateRMultiple();
  const plannedRiskDollars = calculatePlannedRiskDollars();

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Journal & AI Review"
        subtitle="Process-focused logs, postmortems, and weekly review."
        action={
          <button 
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-100 hover:bg-slate-700"
          >
            {showForm ? 'Cancel' : 'New entry'}
          </button>
        }
      />

      {showForm && (
        <div className="card">
          <SectionHeader 
            title={editingEntry ? 'Edit Entry' : 'New Journal Entry'} 
            subtitle="Record your trade details and performance metrics" 
          />
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'trade' | 'note' | 'postmortem' })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="trade">Trade</option>
                  <option value="note">Note</option>
                  <option value="postmortem">Postmortem</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Symbol</label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                  placeholder="AAPL"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Thesis Tag</label>
                <select
                  value={formData.thesisTag}
                  onChange={(e) => setFormData({ ...formData, thesisTag: e.target.value as ThesisTag })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                >
                  {thesisTags.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Entry Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.entryPrice}
                  onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
                  placeholder="100.00"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Exit Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.exitPrice}
                  onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value })}
                  placeholder="105.00"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Quantity</label>
                <input
                  type="number"
                  step="1"
                  value={formData.qty}
                  onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                  placeholder="100"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Holding Days</label>
                <input
                  type="number"
                  step="1"
                  value={formData.holdingDays}
                  onChange={(e) => setFormData({ ...formData, holdingDays: e.target.value })}
                  placeholder="5"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Risk Per Share</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.plannedRiskPerShare}
                  onChange={(e) => setFormData({ ...formData, plannedRiskPerShare: e.target.value })}
                  placeholder="2.00"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                />
                <p className="mt-1 text-xs text-slate-500">Entry - Stop Loss</p>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">R-Multiple</label>
                <input
                  type="text"
                  value={rMultiple !== null ? rMultiple.toFixed(2) + 'R' : ''}
                  readOnly
                  placeholder="Auto-calculated"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
                <p className="mt-1 text-xs text-slate-500">Auto-calculated</p>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Risk Dollars</label>
                <input
                  type="text"
                  value={plannedRiskDollars !== null ? '$' + plannedRiskDollars.toFixed(2) : ''}
                  readOnly
                  placeholder="Auto-calculated"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
                <p className="mt-1 text-xs text-slate-500">Auto-calculated</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Setup Tag</label>
                <input
                  type="text"
                  value={formData.setupTag}
                  onChange={(e) => setFormData({ ...formData, setupTag: e.target.value })}
                  placeholder="e.g., Breakout, Pullback"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">MFE (R)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.mfeR}
                  onChange={(e) => setFormData({ ...formData, mfeR: e.target.value })}
                  placeholder="3.50"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                />
                <p className="mt-1 text-xs text-slate-500">Max Favorable Excursion</p>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">MAE (R)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.maeR}
                  onChange={(e) => setFormData({ ...formData, maeR: e.target.value })}
                  placeholder="-0.50"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                />
                <p className="mt-1 text-xs text-slate-500">Max Adverse Excursion</p>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Thesis</label>
              <textarea
                value={formData.thesis}
                onChange={(e) => setFormData({ ...formData, thesis: e.target.value })}
                rows={3}
                placeholder="What's the trading thesis?"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Outcome</label>
              <textarea
                value={formData.outcome}
                onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                rows={2}
                placeholder="What happened?"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Lesson</label>
              <textarea
                value={formData.lesson}
                onChange={(e) => setFormData({ ...formData, lesson: e.target.value })}
                rows={2}
                placeholder="What did you learn?"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                required
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm text-slate-100 hover:bg-cyan-500"
              >
                {editingEntry ? 'Update Entry' : 'Add Entry'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <SectionHeader title="Journal entries" subtitle="Filter by symbol, date range, or type" />
        <div className="mt-4 space-y-3">
          {journalEntries.length === 0 ? (
            <p className="text-sm text-slate-400">No journal entries yet. Click "New entry" to add one.</p>
          ) : (
            journalEntries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase text-slate-400">
                    {entry.type} · {new Date(entry.created_at).toLocaleDateString()}
                  </span>
                  {entry.symbol ? <span className="text-xs font-semibold text-slate-300">{entry.symbol}</span> : null}
                  {entry.thesis_tag ? (
                    <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">{entry.thesis_tag}</span>
                  ) : null}
                  {entry.setup_tag ? (
                    <span className="rounded bg-cyan-900/40 px-2 py-0.5 text-xs text-cyan-300">{entry.setup_tag}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {entry.r_multiple !== undefined && entry.r_multiple !== null ? (
                    <span className={`text-sm font-semibold ${entry.r_multiple > 0 ? 'text-emerald-400' : entry.r_multiple < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                      {entry.r_multiple > 0 ? '+' : ''}{entry.r_multiple.toFixed(2)}R
                    </span>
                  ) : null}
                  <button
                    onClick={() => handleEdit(entry)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id!)}
                    className="text-xs text-slate-400 hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              {(entry.entry_price || entry.exit_price || entry.qty) && (
                <div className="mt-2 flex gap-4 text-xs text-slate-400">
                  {entry.entry_price && <span>Entry: ${entry.entry_price.toFixed(2)}</span>}
                  {entry.exit_price && <span>Exit: ${entry.exit_price.toFixed(2)}</span>}
                  {entry.qty && <span>Qty: {entry.qty}</span>}
                  {entry.holding_days && <span>Days: {entry.holding_days}</span>}
                </div>
              )}

              <p className="mt-2 text-sm text-slate-100">{entry.thesis}</p>
              {entry.outcome ? <p className="mt-1 text-xs text-slate-400">Outcome: {entry.outcome}</p> : null}
              <p className="mt-2 text-xs text-slate-400">Lesson: {entry.lesson}</p>

              {(entry.mfe_r || entry.mae_r || entry.planned_risk_dollars) && (
                <div className="mt-2 flex gap-4 text-xs text-slate-500">
                  {entry.mfe_r && <span>MFE: {entry.mfe_r.toFixed(2)}R</span>}
                  {entry.mae_r && <span>MAE: {entry.mae_r.toFixed(2)}R</span>}
                  {entry.planned_risk_dollars && <span>Risk: ${entry.planned_risk_dollars.toFixed(2)}</span>}
                </div>
              )}
            </div>
          ))
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="card">
          <SectionHeader title="Performance Analytics" subtitle="Trading performance metrics by setup and thesis" />
          <div className="mt-4 space-y-4">
            <div className="grid gap-2 text-sm text-slate-300">
              <div className="flex justify-between">
                <span>Win rate</span>
                <span className={stats.winRate >= 50 ? 'text-emerald-200' : 'text-red-200'}>
                  {stats.winRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Average Win (R)</span>
                <span className="text-emerald-200">+{stats.avgWinR.toFixed(2)}R</span>
              </div>
              <div className="flex justify-between">
                <span>Average Loss (R)</span>
                <span className="text-red-200">-{stats.avgLossR.toFixed(2)}R</span>
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-2">
                <span className="font-semibold">Expectancy</span>
                <span className={`font-semibold ${stats.expectancy >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
                  {stats.expectancy >= 0 ? '+' : ''}{stats.expectancy.toFixed(2)}R
                </span>
              </div>
            </div>

            {stats.profitFactorBySetup.size > 0 && (
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-xs font-semibold text-slate-400 mb-2">Profit Factor by Setup</h4>
                <div className="space-y-1 text-sm">
                  {Array.from(stats.profitFactorBySetup.entries())
                    .sort((a, b) => b[1].profitFactor - a[1].profitFactor)
                    .map(([tag, data]) => (
                      <div key={tag} className="flex justify-between">
                        <span className="text-slate-300">{tag}</span>
                        <span className={data.profitFactor >= 1 ? 'text-emerald-200' : 'text-red-200'}>
                          {data.profitFactor.toFixed(2)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {stats.profitFactorByThesis.size > 0 && (
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-xs font-semibold text-slate-400 mb-2">Profit Factor by Thesis</h4>
                <div className="space-y-1 text-sm">
                  {Array.from(stats.profitFactorByThesis.entries())
                    .sort((a, b) => b[1].profitFactor - a[1].profitFactor)
                    .map(([tag, data]) => (
                      <div key={tag} className="flex justify-between">
                        <span className="text-slate-300">{tag}</span>
                        <span className={data.profitFactor >= 1 ? 'text-emerald-200' : 'text-red-200'}>
                          {data.profitFactor.toFixed(2)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
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
