import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { getAllPositions, getLatestPrice, getSymbol } from '../lib/db';

interface IndustryAllocation {
  industry: string;
  value: number;
  percentage: number;
  count: number;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#84cc16', // lime
];

export default function IndustryPieChart() {
  const industryData = useMemo(() => {
    const positions = getAllPositions();
    
    if (positions.length === 0) {
      return [];
    }
    
    // Aggregate data by industry
    const industryMap = new Map<string, { value: number; count: number }>();
    let totalValue = 0;
    
    for (const position of positions) {
      const symbol = getSymbol(position.symbol);
      const latestPrice = getLatestPrice(position.symbol);
      
      if (!latestPrice) {
        continue;
      }
      
      const positionValue = latestPrice.close * position.qty;
      totalValue += positionValue;
      
      // Get industry, default to "Unknown" if not available
      const industry = symbol?.industry || 'Unknown';
      
      const existing = industryMap.get(industry) || { value: 0, count: 0 };
      industryMap.set(industry, {
        value: existing.value + positionValue,
        count: existing.count + 1
      });
    }
    
    // Convert to array and calculate percentages
    const result: IndustryAllocation[] = Array.from(industryMap.entries())
      .map(([industry, data]) => ({
        industry,
        value: data.value,
        percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
        count: data.count
      }))
      .sort((a, b) => b.value - a.value); // Sort by value descending
    
    return result;
  }, [getAllPositions().length]); // Update when number of positions changes

  if (industryData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-slate-400">
        No industry data available. Add positions with industry information.
      </div>
    );
  }

  const renderCustomLabel = (entry: any) => {
    const percentage = entry.percentage;
    if (percentage < 5) return ''; // Hide label for small slices
    return `${percentage.toFixed(1)}%`;
  };

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={industryData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            nameKey="industry"
          >
            {industryData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              color: '#f1f5f9'
            }}
            formatter={(value: number, name: string, props: any) => {
              const item = props.payload;
              return [
                <div key="tooltip" className="space-y-1">
                  <div className="font-semibold">${value.toLocaleString()}</div>
                  <div className="text-xs text-slate-400">
                    {item.percentage.toFixed(2)}% of portfolio
                  </div>
                  <div className="text-xs text-slate-400">
                    {item.count} position{item.count !== 1 ? 's' : ''}
                  </div>
                </div>,
                ''
              ];
            }}
            labelFormatter={(label) => label}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry: any) => {
              // Use entry.value to get the industry name
              const industryName = entry.value;
              const item = industryData.find(d => d.industry === industryName);
              return (
                <span className="text-xs text-slate-300">
                  {industryName} ({item?.percentage.toFixed(1)}%)
                </span>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
