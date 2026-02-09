import { useState, FormEvent } from 'react';
import { addPosition, updatePosition, type Position } from '../lib/db';
import { fetchCurrentPrice } from '../lib/dataService';
import type { ThesisTag, TimeHorizon } from '../lib/types';

interface PositionFormProps {
  position?: Position;
  onSave: () => void;
  onCancel: () => void;
}

const thesisTags: ThesisTag[] = ['Energy', 'Defense', 'Growth', 'Hedge', 'Spec', 'Other'];
const timeHorizons: TimeHorizon[] = ['Days', 'Weeks', 'Months', 'Years'];

export default function PositionForm({ position, onSave, onCancel }: PositionFormProps) {
  const [formData, setFormData] = useState({
    symbol: position?.symbol || '',
    qty: position?.qty || 0,
    avgCost: position?.avg_cost || 0,
    currency: position?.currency || 'USD',
    thesisTag: position?.thesis_tag || 'Other' as ThesisTag,
    timeHorizon: position?.time_horizon || 'Months' as TimeHorizon,
    thesis: position?.thesis || '',
    invalidation: position?.invalidation || undefined as number | undefined,
    target: position?.target || undefined as number | undefined
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validatingSymbol, setValidatingSymbol] = useState(false);

  const validateSymbol = async (symbol: string) => {
    if (!symbol || position) return true; // Skip validation for edit mode
    
    setValidatingSymbol(true);
    setError(null);
    
    try {
      await fetchCurrentPrice(symbol);
      return true;
    } catch (err) {
      setError(`Invalid symbol: ${symbol}`);
      return false;
    } finally {
      setValidatingSymbol(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!formData.symbol || formData.qty <= 0 || formData.avgCost <= 0) {
      setError('Symbol, quantity, and average cost are required');
      return;
    }

    // Validate symbol if adding new position
    if (!position) {
      const isValid = await validateSymbol(formData.symbol.toUpperCase());
      if (!isValid) return;
    }

    setLoading(true);

    try {
      const positionData: Omit<Position, 'created_at' | 'updated_at'> = {
        symbol: formData.symbol.toUpperCase(),
        qty: formData.qty,
        avg_cost: formData.avgCost,
        currency: formData.currency,
        thesis_tag: formData.thesisTag,
        time_horizon: formData.timeHorizon,
        thesis: formData.thesis || undefined,
        invalidation: formData.invalidation,
        target: formData.target
      };

      if (position) {
        updatePosition(positionData.symbol, positionData);
      } else {
        addPosition(positionData);
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save position');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold text-slate-100">
          {position ? 'Edit Position' : 'Add Position'}
        </h2>
        
        {error && (
          <div className="mt-4 rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs uppercase text-slate-400">Symbol *</label>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                disabled={!!position}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                placeholder="AAPL"
                required
              />
            </div>

            <div>
              <label className="block text-xs uppercase text-slate-400">Currency</label>
              <input
                type="text"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                placeholder="USD"
              />
            </div>

            <div>
              <label className="block text-xs uppercase text-slate-400">Quantity *</label>
              <input
                type="number"
                step="any"
                value={formData.qty || ''}
                onChange={(e) => setFormData({ ...formData, qty: parseFloat(e.target.value) || 0 })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                placeholder="100"
                required
              />
            </div>

            <div>
              <label className="block text-xs uppercase text-slate-400">Average Cost *</label>
              <input
                type="number"
                step="0.01"
                value={formData.avgCost || ''}
                onChange={(e) => setFormData({ ...formData, avgCost: parseFloat(e.target.value) || 0 })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                placeholder="150.00"
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

            <div>
              <label className="block text-xs uppercase text-slate-400">Time Horizon</label>
              <select
                value={formData.timeHorizon}
                onChange={(e) => setFormData({ ...formData, timeHorizon: e.target.value as TimeHorizon })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                {timeHorizons.map(horizon => (
                  <option key={horizon} value={horizon}>{horizon}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase text-slate-400">Invalidation Price</label>
              <input
                type="number"
                step="0.01"
                value={formData.invalidation || ''}
                onChange={(e) => setFormData({ ...formData, invalidation: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                placeholder="100.00"
              />
            </div>

            <div>
              <label className="block text-xs uppercase text-slate-400">Target Price</label>
              <input
                type="number"
                step="0.01"
                value={formData.target || ''}
                onChange={(e) => setFormData({ ...formData, target: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                placeholder="200.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase text-slate-400">Thesis</label>
            <textarea
              value={formData.thesis}
              onChange={(e) => setFormData({ ...formData, thesis: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              rows={3}
              placeholder="Why are you holding this position?"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading || validatingSymbol}
              className="flex-1 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50"
            >
              {loading ? 'Saving...' : validatingSymbol ? 'Validating...' : position ? 'Update Position' : 'Add Position'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
