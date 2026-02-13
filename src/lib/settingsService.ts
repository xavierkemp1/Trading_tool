import defaultSettings from '../settings/defaultSettings.json';

export interface Settings {
  watchlistSymbols: string[];
  refreshSchedule: string;
  benchmarks: string[];
  actionBadgeRules: {
    smaShort: number;
    smaLong: number;
    atrMultipleForReduce: number;
    rsiOverbought: number;
    exitBelowSma200: boolean;
  };
  reddit: {
    enabled: boolean;
    sources: string[];
    cacheHours: number;
    minPostScore: number;
    minMentions: number;
    postsPerSubreddit: number;
    customPositiveKeywords: string[];
    customNegativeKeywords: string[];
    customThemes: Record<string, string[]>;
  };
  twitter: {
    enabled: boolean;
    followedAccounts: string[];
    cacheHours: number;
  };
  openai: {
    enabled: boolean;
    model: string;
  };
  riskBands: {
    maxPositionPct: number;
    maxThemePct: number;
  };
}

const STORAGE_KEY = 'trading_app_settings';

export function getSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const userSettings = JSON.parse(stored);
      // Merge with defaults to ensure all fields exist
      return {
        ...defaultSettings,
        ...userSettings,
        actionBadgeRules: {
          ...defaultSettings.actionBadgeRules,
          ...(userSettings.actionBadgeRules || {})
        },
        reddit: {
          ...defaultSettings.reddit,
          ...(userSettings.reddit || {})
        },
        twitter: {
          ...defaultSettings.twitter,
          ...(userSettings.twitter || {})
        },
        openai: {
          ...defaultSettings.openai,
          ...(userSettings.openai || {})
        },
        riskBands: {
          ...defaultSettings.riskBands,
          ...(userSettings.riskBands || {})
        }
      };
    }
  } catch (err) {
    console.error('Failed to load settings from localStorage:', err);
  }
  
  return defaultSettings;
}

export function updateSettings(settings: Partial<Settings>): void {
  try {
    const current = getSettings();
    const updated = {
      ...current,
      ...settings,
      actionBadgeRules: {
        ...current.actionBadgeRules,
        ...(settings.actionBadgeRules || {})
      },
      reddit: {
        ...current.reddit,
        ...(settings.reddit || {})
      },
      twitter: {
        ...current.twitter,
        ...(settings.twitter || {})
      },
      openai: {
        ...current.openai,
        ...(settings.openai || {})
      },
      riskBands: {
        ...current.riskBands,
        ...(settings.riskBands || {})
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save settings to localStorage:', err);
  }
}

export function isOpenAIEnabled(): boolean {
  const settings = getSettings();
  return settings.openai.enabled;
}

export function isRedditEnabled(): boolean {
  const settings = getSettings();
  return settings.reddit.enabled;
}

export function isTwitterEnabled(): boolean {
  const settings = getSettings();
  return settings.twitter.enabled;
}
