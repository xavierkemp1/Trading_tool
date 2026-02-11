import { useState, useEffect } from 'react';
import SectionHeader from '../components/SectionHeader';
import { getAllPositions, getLatestPrice } from '../lib/db';
import type { ThesisTag } from '../lib/types';

export default function PortfolioRisk() {
  const [exposureRows, setExposureRows] = useState<{ label: string; pct: number; value: number }[]>([]);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [positionCount, setPositionCount] = useState(0);

  useEffect(() => {
    // Calculate real exposure breakdown from database positions
    const positions = getAllPositions();
    setPositionCount(positions.length);
    
    if (positions.length === 0) {
      setExposureRows([]);
      setTotalPortfolioValue(0);
      return;
    }

    const exposureMap = new Map<string, number>();
    let totalValue = 0;

    for (const position of positions) {
      const latestPrice = getLatestPrice(position.symbol);
      if (latestPrice) {
        const positionValue = latestPrice.close * position.qty;
        totalValue += positionValue;
        
        const tag = position.thesis_tag || 'Other';
        exposureMap.set(tag, (exposureMap.get(tag) || 0) + positionValue);
      }
    }

    setTotalPortfolioValue(totalValue);

    // Convert to percentage breakdown
    const breakdown = Array.from(exposureMap.entries())
      .map(([label, value]) => ({
        label,
        value,
        pct: totalValue > 0 ? (value / totalValue) * 100 : 0
      }))
      .sort((a, b) => b.pct - a.pct);

    setExposureRows(breakdown);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader title="Portfolio & Risk" subtitle="Concentration, diversification, and stress tests" />

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="card">
          <SectionHeader title="Exposure breakdown" subtitle="By thesis tag / sector / currency" />
          {exposureRows.length > 0 ? (
            <div className="mt-4 space-y-3">
              {exposureRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{row.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">${row.value.toLocaleString()}</span>
                    <span className="text-slate-100 font-semibold">{row.pct.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-400">
              No positions found. Add positions to see exposure breakdown.
            </div>
          )}
          {exposureRows.length > 0 && (
            <div className="mt-6 grid gap-2 text-xs text-slate-400">
              <p>Total portfolio value: ${totalPortfolioValue.toLocaleString()}</p>
              <p>Number of positions: {positionCount}</p>
              {positionCount > 0 && exposureRows.length > 0 && (
                <p>Top position: {exposureRows[0].label} at {exposureRows[0].pct.toFixed(1)}%</p>
              )}
            </div>
          )}
        </div>
        <div className="card">
          <SectionHeader title="Risk Metrics" subtitle="Portfolio concentration" />
          {exposureRows.length > 0 ? (
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Total Positions</span>
                <span className="text-slate-100">{positionCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Thesis Categories</span>
                <span className="text-slate-100">{exposureRows.length}</span>
              </div>
              {exposureRows.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Largest Exposure</span>
                  <span className="text-slate-100">{exposureRows[0].pct.toFixed(1)}%</span>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-400">
              No data available. Add positions to calculate risk metrics.
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <SectionHeader title="Correlation & Stress Tests" subtitle="Advanced analytics" />
        <div className="mt-4 text-sm text-slate-400">
          <p>Correlation matrix and stress testing features coming soon.</p>
          <p className="mt-2">These features require historical price data and advanced calculations.</p>
        </div>
      </div>
    </div>
  );
}
