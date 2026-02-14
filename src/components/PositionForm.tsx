import { useState, FormEvent, useEffect, useRef } from 'react';
import { addPosition, updatePosition, getAllPositions, getAllWatchlist, getLatestPrice, type Position } from '../lib/db';
import { fetchCurrentPrice } from '../lib/dataService';
import type { ThesisTag, TimeHorizon } from '../lib/types';
import { getSettings } from '../lib/settingsService';

interface PositionFormProps {
  position?: Position;
  onSave: () => void;
  onCancel: () => void;
}

const thesisTags: ThesisTag[] = ['Energy', 'Defense', 'Growth', 'Hedge', 'Spec', 'Other'];
const timeHorizons: TimeHorizon[] = ['Days', 'Weeks', 'Months', 'Years'];

export default function PositionForm({ position, onSave, onCancel }: PositionFormProps) {
  const settings = getSettings();
  const [formData, setFormData] = useState({
    symbol: position?.symbol || '',
    qty: position?.qty || 0,
    avgCost: position?.avg_cost || 0,
    currency: position?.currency || 'USD',
    thesisTag: position?.thesis_tag || 'Other' as ThesisTag,
    timeHorizon: position?.time_horizon || 'Months' as TimeHorizon,
    thesis: position?.thesis || '',
    invalidation: position?.invalidation || undefined as number | undefined,
    target: position?.target || undefined as number | undefined,
    riskPct: settings.riskManagement.maxRiskPctPerPosition
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validatingSymbol, setValidatingSymbol] = useState(false);
  
  // Calculate portfolio value
  const portfolioValue = getAllPositions().reduce((total, pos) => {
    const latestPrice = getLatestPrice(pos.symbol);
    if (latestPrice) {
      return total + (latestPrice.close * pos.qty);
    }
    return total;
  }, 0);

  // Calculate risk metrics
  const riskPerShare = formData.avgCost && formData.invalidation 
    ? formData.avgCost - formData.invalidation 
    : 0;
  const maxRiskDollars = portfolioValue * (formData.riskPct / 100);
  const recommendedQty = riskPerShare > 0 ? Math.floor(maxRiskDollars / riskPerShare) : 0;
  const recommendedPositionValue = recommendedQty * formData.avgCost;
  const recommendedPositionPct = portfolioValue > 0 ? (recommendedPositionValue / portfolioValue) * 100 : 0;
  const currentPositionValue = formData.qty * formData.avgCost;
  const currentPositionPct = portfolioValue > 0 ? (currentPositionValue / portfolioValue) * 100 : 0;
  
  // Validation checks
  const hasInvalidation = formData.invalidation !== undefined && formData.invalidation > 0;
  const hasValidRiskPerShare = riskPerShare > 0;
  const canCalculateRisk = hasInvalidation && hasValidRiskPerShare;
  
  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Get all previously used symbols
  const getPreviousSymbols = (): string[] => {
    const symbols = new Set<string>();
    
    // Get symbols from positions
    const positions = getAllPositions();
    positions.forEach(p => symbols.add(p.symbol));
    
    // Get symbols from watchlist
    const watchlist = getAllWatchlist();
    watchlist.forEach(w => symbols.add(w.symbol));
    
    return Array.from(symbols).sort();
  };

  // Update suggestions based on input
  const updateSuggestions = (value: string) => {
    if (!value || position) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const upperValue = value.toUpperCase();
    const previousSymbols = getPreviousSymbols();
    const filtered = previousSymbols.filter(symbol => 
      symbol.startsWith(upperValue)
    );
    
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
    setSelectedSuggestionIndex(-1);
  };

  // Handle symbol input change
  const handleSymbolChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setFormData({ ...formData, symbol: upperValue });
    updateSuggestions(upperValue);
  };

  // Handle suggestion selection
  const selectSuggestion = (symbol: string) => {
    setFormData({ ...formData, symbol });
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (selectedSuggestionIndex >= 0) {
          e.preventDefault();
          selectSuggestion(suggestions[selectedSuggestionIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const validateSymbol = async (symbol: string) => {
    if (!symbol || position) return true; // Skip validation for edit mode
    
    setValidatingSymbol(true);
    setError(null);
    
    try {
      await fetchCurrentPrice(symbol);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      // Provide clearer error messages
      if (errorMessage.includes('Failed to fetch current price')) {
        setError(`Unable to validate symbol "${symbol}". This could be due to: Invalid or unknown ticker symbol, API service temporarily unavailable, or network connectivity issues. Please verify the symbol is correct and try again.`);
      } else {
        setError(`Error validating symbol: ${errorMessage}`);
      }
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

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Basic Information Section */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-slate-300">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-slate-400">Symbol *</label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={formData.symbol}
                    onChange={(e) => handleSymbolChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => updateSuggestions(formData.symbol)}
                    disabled={!!position}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                    placeholder="AAPL"
                    required
                    autoComplete="off"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-10 mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 shadow-lg max-h-48 overflow-y-auto"
                    >
                      {suggestions.map((symbol, index) => (
                        <div
                          key={symbol}
                          onClick={() => selectSuggestion(symbol)}
                          className={`px-3 py-2 text-sm cursor-pointer ${
                            index === selectedSuggestionIndex
                              ? 'bg-cyan-500/20 text-cyan-100'
                              : 'text-slate-100 hover:bg-slate-700'
                          }`}
                        >
                          {symbol}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
          </div>

          {/* Investment Strategy Section */}
          <div className="mt-8">
            <h3 className="mb-3 text-sm font-medium text-slate-300">Investment Strategy</h3>
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
          </div>

          {/* Price Targets Section */}
          <div className="mt-8">
            <h3 className="mb-3 text-sm font-medium text-slate-300">Price Targets</h3>
            <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

          {/* Risk Management Section */}
          <div className="mt-8">
            <h3 className="mb-3 text-sm font-medium text-slate-300">Risk Management</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-slate-400">Risk % for this trade</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.riskPct || ''}
                  onChange={(e) => setFormData({ ...formData, riskPct: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  placeholder="1.0"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Default from settings: {settings.riskManagement.maxRiskPctPerPosition}%
                </p>
              </div>

              {/* Risk Calculations */}
              {formData.avgCost > 0 && (
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase">Calculated Values</h4>
                  
                  {!hasInvalidation && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      ⚠️ Set invalidation price to calculate risk-based position sizing
                    </div>
                  )}
                  
                  {hasInvalidation && !hasValidRiskPerShare && (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                      ⚠️ Invalidation must be below entry price (avg cost) for long positions
                    </div>
                  )}
                  
                  <div className="grid gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Portfolio Value:</span>
                      <span className="font-medium text-slate-100">
                        ${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Risk per Share:</span>
                      <span className="font-medium text-slate-100">
                        ${riskPerShare.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Max Risk ($):</span>
                      <span className="font-medium text-slate-100">
                        ${maxRiskDollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    
                    {canCalculateRisk && (
                      <>
                        <div className="border-t border-slate-700 my-2"></div>
                        <div className="flex justify-between">
                          <span className="text-cyan-400 font-semibold">Recommended Qty:</span>
                          <span className="font-bold text-cyan-300">
                            {recommendedQty.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Recommended Position $:</span>
                          <span className="font-medium text-slate-100">
                            ${recommendedPositionValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Recommended % of Portfolio:</span>
                          <span className="font-medium text-slate-100">
                            {recommendedPositionPct.toFixed(2)}%
                          </span>
                        </div>
                      </>
                    )}
                    
                    {formData.qty > 0 && (
                      <>
                        <div className="border-t border-slate-700 my-2"></div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Current Position $:</span>
                          <span className="font-medium text-slate-100">
                            ${currentPositionValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Current % of Portfolio:</span>
                          <span className="font-medium text-slate-100">
                            {currentPositionPct.toFixed(2)}%
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes Section */}
          <div className="mt-8">
            <h3 className="mb-3 text-sm font-medium text-slate-300">Notes</h3>
            <div>
              <label className="block text-xs uppercase text-slate-400">Thesis</label>
              <textarea
                value={formData.thesis}
                onChange={(e) => setFormData({ ...formData, thesis: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                rows={5}
                placeholder="Why are you holding this position?"
              />
            </div>
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
