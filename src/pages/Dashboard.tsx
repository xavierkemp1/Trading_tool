import { useState, useEffect, useCallback, useRef } from 'react';
import SectionHeader from '../components/SectionHeader';
import StatPill from '../components/StatPill';
import IndustryPieChart from '../components/IndustryPieChart';
import { useApp } from '../lib/AppContext';
import { getAllPositions, getLatestPrice, getSymbol } from '../lib/db';
import { refreshAllData, calculateIndicators, type RefreshProgress } from '../lib/dataService';
import { getActionBadge, getFlags, type RuleInputs } from '../lib/rules';
import { exportDbBytes, exportJson, importDbBytes, importJson } from '../lib/exportImport';
import type { AlertItem, RegimeSummary } from '../lib/types';
import defaultSettings from '../settings/defaultSettings.json';

export default function Dashboard() {
  const { setLoading, setLastRefresh } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{
    current: string;
    completed: number;
    total: number;
    stage: string;
  } | null>(null);
  const [regimeSummary, setRegimeSummary] = useState<RegimeSummary | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [portfolioChange, setPortfolioChange] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const positions = getAllPositions();
      
      // Calculate portfolio value and change
      let totalValue = 0;
      let totalCost = 0;
      const positionAlerts: AlertItem[] = [];
      
      for (const position of positions) {
        const latestPrice = getLatestPrice(position.symbol);
        if (latestPrice) {
          const positionValue = latestPrice.close * position.qty;
          const positionCost = position.avg_cost * position.qty;
          totalValue += positionValue;
          totalCost += positionCost;
          
          // Generate alerts using rules
          try {
            const indicators = await calculateIndicators(position.symbol);
            if (indicators.sma50 && indicators.sma200 && indicators.atr14) {
              const inputs: RuleInputs = {
                close: latestPrice.close,
                sma50: indicators.sma50,
                sma200: indicators.sma200,
                atr: indicators.atr14,
                rsi: indicators.rsi14,
                invalidation: position.invalidation,
                momentumPositive: latestPrice.close > indicators.sma50
              };
              
              const badge = getActionBadge(inputs);
              const flags = getFlags(inputs);
              
              if (badge === 'EXIT' || badge === 'REDUCE') {
                positionAlerts.push({
                  id: `${position.symbol}-action`,
                  symbol: position.symbol,
                  message: `Action: ${badge}${flags.length > 0 ? ' - ' + flags.join(', ') : ''}`,
                  severity: badge === 'EXIT' ? 'danger' : 'warn'
                });
              }
              
              if (position.invalidation && latestPrice.close < position.invalidation) {
                positionAlerts.push({
                  id: `${position.symbol}-invalidation`,
                  symbol: position.symbol,
                  message: 'Below invalidation price',
                  severity: 'danger'
                });
              }
            }
          } catch (err) {
            console.warn(`Failed to calculate indicators for ${position.symbol}:`, err);
          }
        }
      }
      
      setPortfolioValue(totalValue);
      setPortfolioChange(totalValue - totalCost);
      setAlerts(positionAlerts.slice(0, 10)); // Cap at 10
      
      // Calculate regime based on benchmarks
      const benchmarks = defaultSettings.benchmarks;
      let aboveSma200Count = 0;
      
      for (const symbol of benchmarks) {
        try {
          const indicators = await calculateIndicators(symbol);
          const latestPrice = getLatestPrice(symbol);
          
          if (indicators.sma200 && latestPrice && latestPrice.close > indicators.sma200) {
            aboveSma200Count++;
          }
        } catch (err) {
          console.warn(`Failed to calculate regime for ${symbol}:`, err);
        }
      }
      
      const breadthPct = Math.round((aboveSma200Count / benchmarks.length) * 100);
      const spyLatest = getLatestPrice('SPY');
      let spyAboveSma200 = false;
      
      try {
        const spyIndicators = await calculateIndicators('SPY');
        if (spyIndicators.sma200 && spyLatest) {
          spyAboveSma200 = spyLatest.close > spyIndicators.sma200;
        }
      } catch (err) {
        console.warn('Failed to calculate SPY indicators:', err);
      }
      
      const mode = breadthPct >= 70 ? 'Risk-on' : breadthPct <= 30 ? 'Risk-off' : 'Neutral';
      
      setRegimeSummary({
        mode,
        explanation: mode === 'Risk-on' 
          ? 'Markets trending higher, consider adding to positions'
          : mode === 'Risk-off'
          ? 'Markets under pressure, consider reducing exposure'
          : 'Mixed signals, maintain current positions',
        breadthPct,
        spyAboveSma200,
        vixProxy: 'Normal' // Placeholder - would need VIX data
      });
      
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setLoading(true);
    
    try {
      const positions = getAllPositions();
      const symbols = [
        ...defaultSettings.benchmarks,
        ...positions.map(p => p.symbol)
      ];
      
      const uniqueSymbols = [...new Set(symbols)];
      
      // Track progress
      let completed = 0;
      setRefreshProgress({
        current: '',
        completed: 0,
        total: uniqueSymbols.length,
        stage: 'Starting...'
      });
      
      const onProgress = (progress: RefreshProgress) => {
        if (progress.stage === 'success' || progress.stage === 'failed') {
          completed++;
        }
        
        const stageText = 
          progress.stage === 'queued' ? 'Queued' :
          progress.stage === 'fetching_prices' ? 'Fetching prices' :
          progress.stage === 'fetching_fundamentals' ? 'Fetching fundamentals' :
          progress.stage === 'success' ? 'Complete' :
          progress.stage === 'failed' ? 'Failed' : 'Processing';
        
        setRefreshProgress({
          current: progress.symbol,
          completed,
          total: uniqueSymbols.length,
          stage: stageText
        });
      };
      
      await refreshAllData(uniqueSymbols, onProgress);
      await loadData();
      setLastRefresh(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      
      // Clear progress after a brief delay
      setTimeout(() => setRefreshProgress(null), 2000);
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAIReview = async () => {
    setReviewLoading(true);
    setReviewError(null);
    
    try {
      const { generatePortfolioReview } = await import('../lib/openaiService');
      const result = await generatePortfolioReview();
      setReviewResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate review';
      setReviewError(message);
      console.error('AI review failed:', err);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleCloseReview = () => {
    setReviewResult(null);
    setReviewError(null);
  };

  const handleExportDb = () => {
    try {
      exportDbBytes();
      setExportMessage('Database exported successfully!');
      setTimeout(() => setExportMessage(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setExportMessage(`Error: ${message}`);
      setTimeout(() => setExportMessage(null), 5000);
    }
  };

  const handleExportJson = async () => {
    try {
      await exportJson();
      setExportMessage('JSON exported successfully!');
      setTimeout(() => setExportMessage(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setExportMessage(`Error: ${message}`);
      setTimeout(() => setExportMessage(null), 5000);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirmMessage = `This will replace ALL existing data with the imported backup. This action cannot be undone. Are you sure?`;
    if (!confirm(confirmMessage)) {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    try {
      setImportMessage('Importing...');
      
      if (file.name.endsWith('.json')) {
        await importJson(file);
        setImportMessage('JSON imported successfully! Reloading...');
      } else if (file.name.endsWith('.sqlite') || file.name.endsWith('.db')) {
        await importDbBytes(file);
        setImportMessage('Database imported successfully! Reloading...');
      } else {
        throw new Error('Invalid file type. Please upload a .sqlite, .db, or .json file');
      }

      // Reload the page after successful import
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      setImportMessage(`Error: ${message}`);
      setTimeout(() => setImportMessage(null), 5000);
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Today View"
        subtitle="High-signal snapshot for manual trading decisions."
        action={
          <div className="flex gap-2">
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh data'}
            </button>
            <button 
              onClick={handleAIReview}
              disabled={reviewLoading}
              className="rounded-lg bg-cyan-500/20 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50"
            >
              {reviewLoading ? 'Generating...' : 'Weekly AI review'}
            </button>
          </div>
        }
      />

      {/* Refresh Progress Indicator */}
      {refreshProgress && (
        <div className="card bg-slate-900/80 border-cyan-500/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></div>
              <span className="text-sm font-semibold text-cyan-200">
                Refreshing data ({refreshProgress.completed}/{refreshProgress.total})
              </span>
            </div>
            <span className="text-xs text-slate-400">
              {Math.round((refreshProgress.completed / refreshProgress.total) * 100)}%
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
            <div 
              className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(refreshProgress.completed / refreshProgress.total) * 100}%` }}
            ></div>
          </div>
          <div className="text-xs text-slate-400">
            {refreshProgress.current && (
              <span>
                <span className="text-cyan-300 font-medium">{refreshProgress.current}</span>
                {' - '}
                <span>{refreshProgress.stage}</span>
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="card">
          <SectionHeader title="Market regime" subtitle="Simple, explainable model" />
          {regimeSummary ? (
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
          ) : (
            <div className="mt-4 text-sm text-slate-400">Loading regime data...</div>
          )}
        </div>
        <div className="card">
          <SectionHeader title="Portfolio summary" />
          <div className="mt-4 grid gap-2">
            <StatPill label="Total value" value={portfolioValue > 0 ? `$${portfolioValue.toLocaleString()}` : '—'} />
            <StatPill label="Total gain/loss" value={portfolioChange !== 0 ? `${portfolioChange >= 0 ? '+' : ''}$${portfolioChange.toLocaleString()}` : '—'} />
            <StatPill label="Positions" value={`${getAllPositions().length}`} />
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHeader title="Alerts" subtitle="Focus list capped at 10" />
        {alerts.length > 0 ? (
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
        ) : (
          <div className="mt-4 text-sm text-slate-400">No alerts. All positions look good.</div>
        )}
      </div>

      <div className="card">
        <SectionHeader title="Industry Allocation" subtitle="Portfolio breakdown by industry sector" />
        <div className="mt-4">
          <IndustryPieChart />
        </div>
      </div>

      <div className="card">
        <SectionHeader title="Current Positions" subtitle="Real-time portfolio holdings" />
        {getAllPositions().length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400">Symbol</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-400">Quantity</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-400">Avg Cost</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-400">Current Price</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-400">Value</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-400">Gain/Loss</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-400">%</th>
                </tr>
              </thead>
              <tbody>
                {getAllPositions().map((position) => {
                  const latestPrice = getLatestPrice(position.symbol);
                  if (!latestPrice) return null;
                  
                  const currentPrice = latestPrice.close;
                  const value = currentPrice * position.qty;
                  const gainLoss = (currentPrice - position.avg_cost) * position.qty;
                  const gainLossPct = ((currentPrice - position.avg_cost) / position.avg_cost) * 100;
                  
                  return (
                    <tr key={position.symbol} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-3 py-2 font-semibold text-slate-100">{position.symbol}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{position.qty}</td>
                      <td className="px-3 py-2 text-right text-slate-300">${position.avg_cost.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-slate-300">${currentPrice.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-slate-300">${value.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${gainLoss >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                        {gainLoss >= 0 ? '+' : ''}${gainLoss.toFixed(2)}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${gainLossPct >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                        {gainLossPct >= 0 ? '+' : ''}{gainLossPct.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 text-sm text-slate-400">No positions found. Add positions in the Current Investments page.</div>
        )}
      </div>

      <div className="card">
        <SectionHeader title="Backup & Restore" subtitle="Export and import your database" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-slate-300 mb-2">Export</p>
            <div className="flex gap-2">
              <button
                onClick={handleExportDb}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
              >
                Export SQLite DB
              </button>
              <button
                onClick={handleExportJson}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
              >
                Export JSON
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-300 mb-2">Import</p>
            <div className="flex gap-2">
              <button
                onClick={handleImportClick}
                className="rounded-lg border border-rose-700 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/10"
              >
                Import Backup
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".sqlite,.db,.json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              ⚠️ Import will replace all existing data
            </p>
          </div>
        </div>
        {(exportMessage || importMessage) && (
          <div className={`mt-4 rounded-lg border p-3 text-xs ${
            exportMessage?.startsWith('Error') || importMessage?.startsWith('Error')
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}>
            {exportMessage || importMessage}
          </div>
        )}
      </div>

      {(reviewResult || reviewError) && (
        <div className="card">
          <div className="flex items-center justify-between">
            <SectionHeader title="AI Portfolio Review" />
            <button
              onClick={handleCloseReview}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Close
            </button>
          </div>
          {reviewError ? (
            <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {reviewError}
            </div>
          ) : (
            <div className="mt-4 prose prose-invert prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm text-slate-300">{reviewResult}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
