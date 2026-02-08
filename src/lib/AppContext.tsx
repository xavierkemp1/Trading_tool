import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { initDatabase } from './db';

interface AppContextType {
  dbInitialized: boolean;
  loading: boolean;
  lastRefresh: string | null;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setLastRefresh: (timestamp: string) => void;
  setError: (error: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [dbInitialized, setDbInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initialize() {
      try {
        await initDatabase();
        setDbInitialized(true);
        setLastRefresh(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize database');
      }
    }
    initialize();
  }, []);

  return (
    <AppContext.Provider
      value={{
        dbInitialized,
        loading,
        lastRefresh,
        error,
        setLoading,
        setLastRefresh,
        setError
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
