import { useState, useEffect, useCallback } from 'react';
import SectionHeader from '../components/SectionHeader';
import PositionForm from '../components/PositionForm';
import { getAllPositions, getLatestPrice, getFundamentals, deletePosition, getSymbol, type Position } from '../lib/db';
import { calculateIndicators } from '../lib/dataService';
import { getActionBadge, getFlags, getRiskFlags, type RuleInputs } from '../lib/rules';
import { calculatePositionRisk } from '../lib/riskMetrics';
import { getSettings } from '../lib/settingsService';
import type { PositionSnapshot } from '../lib/types';
import defaultSettings from '../settings/defaultSettings.json';

export default function CurrentInvestments() {
  const [positions, setPositions] = useState<PositionSnapshot[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const loadPositions = useCallback(async () => {
    setLoading(true);
    try {
      const dbPositions = getAllPositions();
      const snapshots: PositionSnapshot[] = [];
      const settings = getSettings();
      
      let totalValue = 0;
      const positionValues: number[] = [];
      
      for (const position of dbPositions) {
        const latestPrice = getLatestPrice(position.symbol);
        const symbolInfo = getSymbol(position.symbol);
        
        if (!latestPrice) {
          console.warn(`No price data for ${position.symbol}`);
          continue;
        }
        
        const currentValue = latestPrice.close * position.qty;
        totalValue += currentValue;
        positionValues.push(currentValue);
        
        let indicators;
        try {
          indicators = await calculateIndicators(position.symbol);
        } catch (err) {
          console.warn(`Failed to calculate indicators for ${position.symbol}:`, err);
          continue;
        }
        
        const pnl = (latestPrice.close - position.avg_cost) * position.qty;
        const pnlPct = ((latestPrice.close - position.avg_cost) / position.avg_cost) * 100;
        
        const aboveSma50 = indicators.sma50 ? latestPrice.close > indicators.sma50 : false;
        const aboveSma200 = indicators.sma200 ? latestPrice.close > indicators.sma200 : false;
        const atrPct = indicators.atr14 ? (indicators.atr14 / latestPrice.close) * 100 : 0;
        
        let actionBadge: PositionSnapshot['actionBadge'] = 'HOLD';
        let flags: string[] = [];
        
        if (indicators.sma50 && indicators.sma200 && indicators.atr14) {
          const inputs: RuleInputs = {
            close: latestPrice.close,
            sma50: indicators.sma50,
            sma200: indicators.sma200,
            atr: indicators.atr14,
            rsi: indicators.rsi14,
            invalidation: position.invalidation,
            momentumPositive: aboveSma50
          };
          
          actionBadge = getActionBadge(inputs, defaultSettings.actionBadgeRules);
          flags = getFlags(inputs);
        }
        
        snapshots.push({
          symbol: position.symbol,
          name: symbolInfo?.name || position.symbol,
          qty: position.qty,
          avgCost: position.avg_cost,
          last: latestPrice.close,
          pnl,
          pnlPct,
          portfolioPct: 0, // Will calculate after we have total
          thesisTag: position.thesis_tag || 'Other',
          timeHorizon: position.time_horizon || 'Months',
          thesis: position.thesis,
          invalidation: position.invalidation,
          target: position.target,
          aboveSma50,
          aboveSma200,
          atrPct,
          rsi: indicators.rsi14,
          actionBadge,
          flags
        });
      }
      
      // Calculate portfolio percentages and risk metrics
      snapshots.forEach((snapshot, index) => {
        snapshot.portfolioPct = totalValue > 0 ? (positionValues[index] / totalValue) * 100 : 0;
        
        // Calculate risk for this position
        const position = dbPositions.find(p => p.symbol === snapshot.symbol);
        if (position) {
          const risk = calculatePositionRisk(
            position,
            snapshot.last,
            totalValue,
            snapshot.atrPct > 0 ? (snapshot.last * snapshot.atrPct) / 100 : undefined,
            settings.riskManagement.riskBasis
          );
          
          snapshot.riskDollars = risk.riskDollars;
          snapshot.riskPctOfPortfolio = risk.riskPctOfPortfolio;
          
          // Add risk flags
          const riskFlags = getRiskFlags(risk, settings);
          snapshot.flags = [...snapshot.flags, ...riskFlags];
        }
      });
      
      setPositions(snapshots);
      if (snapshots.length > 0 && !selectedSymbol) {
        setSelectedSymbol(snapshots[0].symbol);
      }
    } catch (err) {
      console.error('Failed to load positions:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol]);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  const handleAddPosition = () => {
    setEditingPosition(undefined);
    setShowForm(true);
  };

  const handleEditPosition = (symbol: string) => {
    const position = getAllPositions().find(p => p.symbol === symbol);
    setEditingPosition(position);
    setShowForm(true);
  };

  const handleDeletePosition = (symbol: string) => {
    if (confirm(`Delete position ${symbol}?`)) {
      deletePosition(symbol);
      loadPositions();
    }
  };

  const handleFormSave = () => {
    setShowForm(false);
    loadPositions();
  };

  const handleAIReview = async (symbol: string) => {
    setReviewLoading(true);
    setReviewError(null);
    setReviewResult(null);
    
    try {
      const { generatePositionReview } = await import('../lib/openaiService');
      const result = await generatePositionReview(symbol);
      setReviewResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate review';
      setReviewError(message);
      console.error('AI review failed:', err);
    } finally {
      setReviewLoading(false);
    }
  };

  const selected = positions.find(p => p.symbol === selectedSymbol);
  const fundamentals = selectedSymbol ? getFundamentals(selectedSymbol) : null;

  return (
    <>
      {showForm && (
        <PositionForm
          position={editingPosition}
          onSave={handleFormSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[3fr,2fr]">
        <div className="card">
          <SectionHeader 
            title="Current Investments" 
            subtitle="Active positions and discipline checks"
            action={
              <button
                onClick={handleAddPosition}
                className="rounded-lg bg-cyan-500 px-3 py-2 text-xs text-white hover:bg-cyan-600"
              >
                Add Position
              </button>
            }
          />
          {loading ? (
            <div className="mt-4 text-sm text-slate-400">Loading positions...</div>
          ) : positions.length === 0 ? (
            <div className="mt-4 text-sm text-slate-400">No positions yet. Click "Add Position" to get started.</div>
          ) : (
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
                  <th>Risk $</th>
                  <th>Risk %</th>
                  <th>Trend</th>
                  <th>ATR%</th>
                  <th>Thesis</th>
                  <th>Action</th>
                  <th>Flags</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <tr 
                    key={position.symbol}
                    className="cursor-pointer hover:bg-slate-800/50"
                    onClick={() => setSelectedSymbol(position.symbol)}
                  >
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
                    <td className="text-slate-300">
                      {position.riskDollars !== undefined 
                        ? `$${position.riskDollars.toFixed(0)}` 
                        : '—'}
                    </td>
                    <td className="text-slate-300">
                      {position.riskPctOfPortfolio !== undefined 
                        ? `${position.riskPctOfPortfolio.toFixed(2)}%` 
                        : '—'}
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
                    <td>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditPosition(position.symbol); }}
                          className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeletePosition(position.symbol); }}
                          className="rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-200"
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div className="flex flex-col gap-6">
            <div className="card">
              <SectionHeader title={`${selected.symbol} detail`} subtitle="Last 6 months with SMA50/200" />
              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                <p>Chart placeholder (close + SMA50/200 + volume optional).</p>
              </div>
              {fundamentals && (
                <div className="mt-4 grid gap-3 text-sm text-slate-300">
                  {fundamentals.market_cap && (
                    <div className="flex justify-between">
                      <span>Market cap</span>
                      <span>${(fundamentals.market_cap / 1e12).toFixed(2)}T</span>
                    </div>
                  )}
                  {fundamentals.forward_pe && (
                    <div className="flex justify-between">
                      <span>Forward P/E</span>
                      <span>{fundamentals.forward_pe.toFixed(1)}</span>
                    </div>
                  )}
                  {fundamentals.revenue_growth && (
                    <div className="flex justify-between">
                      <span>Revenue growth</span>
                      <span>{fundamentals.revenue_growth > 0 ? '+' : ''}{(fundamentals.revenue_growth * 100).toFixed(0)}%</span>
                    </div>
                  )}
                  {fundamentals.total_debt && (
                    <div className="flex justify-between">
                      <span>Total debt</span>
                      <span>${(fundamentals.total_debt / 1e9).toFixed(1)}B</span>
                    </div>
                  )}
                </div>
              )}
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
                <button 
                  onClick={() => handleAIReview(selected.symbol)}
                  disabled={reviewLoading}
                  className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700 disabled:opacity-50"
                >
                  {reviewLoading ? 'Generating...' : 'AI review this position'}
                </button>
                
                {reviewError && (
                  <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                    {reviewError}
                  </div>
                )}
                
                {reviewResult && (
                  <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase text-slate-400">AI Review</p>
                      <button
                        onClick={() => setReviewResult(null)}
                        className="text-xs text-slate-400 hover:text-slate-200"
                      >
                        Close
                      </button>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <div className="whitespace-pre-wrap text-xs text-slate-300">{reviewResult}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
