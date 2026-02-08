import clsx from 'clsx';

const navItems = [
  'Dashboard',
  'Current Investments',
  'Explore / New Ideas',
  'Portfolio & Risk',
  'Journal & AI Review'
] as const;

interface SidebarProps {
  active: string;
  onNavigate: (label: string) => void;
}

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col gap-6 border-r border-slate-800 bg-slate-950 px-5 py-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Trading Cockpit</p>
        <h1 className="text-lg font-semibold text-slate-100">Manual Decision Desk</h1>
      </div>
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onNavigate(item)}
            className={clsx(
              'rounded-lg px-3 py-2 text-left text-sm transition',
              active === item
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
            )}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="mt-auto rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
        <p className="font-semibold text-slate-200">Local-first</p>
        <p>No brokerage links. All data stays on your machine.</p>
      </div>
    </aside>
  );
}
