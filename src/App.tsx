import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import CurrentInvestments from './pages/CurrentInvestments';
import ExploreIdeas from './pages/ExploreIdeas';
import PortfolioRisk from './pages/PortfolioRisk';
import JournalReview from './pages/JournalReview';
import { AppProvider, useApp } from './lib/AppContext';

const pages = {
  Dashboard: Dashboard,
  'Current Investments': CurrentInvestments,
  'Explore / New Ideas': ExploreIdeas,
  'Portfolio & Risk': PortfolioRisk,
  'Journal & AI Review': JournalReview
} as const;

type PageKey = keyof typeof pages;

function AppContent() {
  const [activePage, setActivePage] = useState<PageKey>('Dashboard');
  const { dbInitialized, loading, lastRefresh, error } = useApp();
  const ActiveComponent = pages[activePage];

  if (!dbInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mb-4 text-lg text-slate-100">Initializing database...</div>
          {error && (
            <div className="mt-4 rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

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
            <div className="text-xs text-slate-400">
              Local data · Last refresh {lastRefresh || '—'}
              {loading && <span className="ml-2 text-cyan-400">Updating...</span>}
            </div>
          </div>
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
