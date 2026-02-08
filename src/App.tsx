import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import CurrentInvestments from './pages/CurrentInvestments';
import ExploreIdeas from './pages/ExploreIdeas';
import PortfolioRisk from './pages/PortfolioRisk';
import JournalReview from './pages/JournalReview';

const pages = {
  Dashboard: Dashboard,
  'Current Investments': CurrentInvestments,
  'Explore / New Ideas': ExploreIdeas,
  'Portfolio & Risk': PortfolioRisk,
  'Journal & AI Review': JournalReview
} as const;

type PageKey = keyof typeof pages;

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>('Dashboard');
  const ActiveComponent = pages[activePage];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      <Sidebar active={activePage} onNavigate={(value) => setActivePage(value as PageKey)} />
      <main className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Manual trading cockpit</p>
              <h1 className="text-2xl font-semibold text-slate-100">{activePage}</h1>
            </div>
            <div className="text-xs text-slate-400">Local data · Last refresh 08:32</div>
          </div>
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
}
