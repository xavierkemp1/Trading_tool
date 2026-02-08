interface StatPillProps {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative';
}

const toneStyles = {
  neutral: 'text-slate-100',
  positive: 'text-emerald-200',
  negative: 'text-rose-200'
};

export default function StatPill({ label, value, tone = 'neutral' }: StatPillProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
      <span className="text-xs uppercase text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${toneStyles[tone]}`}>{value}</span>
    </div>
  );
}
