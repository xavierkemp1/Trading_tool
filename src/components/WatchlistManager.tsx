import { useState, FormEvent } from 'react';
import { addToWatchlist, deleteFromWatchlist, getAllWatchlist, type WatchlistEntry } from '../lib/db';
import { fetchCurrentPrice } from '../lib/dataService';
import type { ThesisTag } from '../lib/types';

const thesisTags: ThesisTag[] = ['Energy', 'Defense', 'Growth', 'Hedge', 'Spec', 'Other'];

interface WatchlistManagerProps {
  onUpdate: () => void;
}

export default function WatchlistManager({ onUpdate }: WatchlistManagerProps) {
  const [formData, setFormData] = useState({
    symbol: '',
    thesisTag: 'Other' as ThesisTag,
    notes: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>(getAllWatchlist());

  const refreshWatchlist = () => {
    setWatchlist(getAllWatchlist());
    onUpdate();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!formData.symbol) {
      setError('Symbol is required');
      return;
    }

    setLoading(true);

    try {
      // Validate symbol
      await fetchCurrentPrice(formData.symbol.toUpperCase());
      
      // Add to watchlist
      addToWatchlist({
        symbol: formData.symbol.toUpperCase(),
        thesis_tag: formData.thesisTag,
        notes: formData.notes || undefined
      });

      // Reset form
      setFormData({ symbol: '', thesisTag: 'Other', notes: '' });
      refreshWatchlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to watchlist');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = (symbol: string) => {
    try {
      deleteFromWatchlist(symbol);
      refreshWatchlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove from watchlist');
    }
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-slate-100">Watchlist Manager</h3>
      
      {error && (
        <div className="mt-4 rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs uppercase text-slate-400">Symbol *</label>
            <input
              type="text"
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              placeholder="AAPL"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase text-slate-400">Thesis Tag</label>
            <select
              value={formData.thesisTag}
              onChange={(e) => setFormData({ ...formData, thesisTag: e.target.value as ThesisTag })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              {thesisTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add to Watchlist'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase text-slate-400">Notes</label>
          <input
            type="text"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            placeholder="Optional notes about this idea"
          />
        </div>
      </form>

      {watchlist.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-slate-300">Current Watchlist ({watchlist.length})</h4>
          <div className="mt-3 space-y-2">
            {watchlist.map((item) => (
              <div
                key={item.symbol}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-100">{item.symbol}</span>
                    {item.thesis_tag && (
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                        {item.thesis_tag}
                      </span>
                    )}
                  </div>
                  {item.notes && (
                    <p className="mt-1 text-xs text-slate-400">{item.notes}</p>
                  )}
                </div>
                <button
                  onClick={() => handleRemove(item.symbol)}
                  className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
