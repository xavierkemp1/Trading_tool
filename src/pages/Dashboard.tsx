import { useState, useEffect, useCallback } from 'react';
import SectionHeader from '../components/SectionHeader';
import StatPill from '../components/StatPill';
import { useApp } from '../lib/AppContext';
import { getAllPositions, getLatestPrice, getSymbol } from '../lib/db';
import { refreshAllData, calculateIndicators } from '../lib/dataService';
import { getActionBadge, getFlags, type RuleInputs } from '../lib/rules';
import type { AlertItem, RegimeSummary } from '../lib/types';
import defaultSettings from '../settings/defaultSettings.json';

export default function Dashboard() {
  const { setLoading, setLastRefresh } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [regimeSummary, setRegimeSummary] = useState<RegimeSummary | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [portfolioChange, setPortfolioChange] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const positions = getAllPositions();
      
      // Calculate portfolio value
      let totalValue = 0;
      const positionAlerts: AlertItem[] = [];
      
      for (const position of positions) {
        const latestPrice = getLatestPrice(position.symbol);
        if (latestPrice) {
          const positionValue = latestPrice.close * position.qty;
          totalValue += positionValue;
          
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
      
      await refreshAllData([...new Set(symbols)]);
      await loadData();
      setLastRefresh(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const handleAIReview = () => {
    alert('AI review feature coming soon!');
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
              className="rounded-lg bg-cyan-500/20 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/30"
            >
              Weekly AI review
            </button>
          </div>
        }
      />

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
    </div>
  );
}
