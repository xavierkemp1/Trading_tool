import { getSettings } from './settingsService';

export interface RedditSentiment {
  symbol: string;
  mentions: number;
  change: string;
  sentiment: 'Positive' | 'Negative' | 'Mixed' | 'Neutral';
  themes: string[];
}

interface RedditPost {
  data: {
    title: string;
    selftext: string;
    score: number;
    num_comments: number;
    created_utc: number;
  };
}

interface RedditListing {
  data: {
    children: RedditPost[];
  };
}

const CACHE_KEY_PREFIX = 'reddit_sentiment_';
const SUBREDDITS = ['wallstreetbets', 'stocks', 'options'];

// Common stock ticker patterns
const TICKER_REGEX = /\b[A-Z]{2,5}\b/g;

// Common words that look like tickers but aren't
const EXCLUDED_WORDS = new Set([
  'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR',
  'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE',
  'TWO', 'WHO', 'BOY', 'DID', 'ITS', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE', 'CEO', 'IPO',
  'ETF', 'USA', 'WSB', 'SEC', 'FDA', 'API', 'ATH', 'ATL', 'EOD', 'AH', 'PM', 'DD', 'YOLO',
  'IMO', 'TL;DR', 'EDIT', 'ELI5', 'TIL'
]);

function getCacheKey(symbols: string[]): string {
  return `${CACHE_KEY_PREFIX}${symbols.sort().join('_')}`;
}

function getCachedSentiment(symbols: string[]): RedditSentiment[] | null {
  const settings = getSettings();
  const cacheKey = getCacheKey(symbols);
  
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    const cacheAge = Date.now() - data.timestamp;
    const maxAge = settings.reddit.cacheHours * 60 * 60 * 1000;
    
    if (cacheAge < maxAge) {
      return data.sentiments;
    }
  } catch (err) {
    console.error('Failed to read Reddit cache:', err);
  }
  
  return null;
}

function setCachedSentiment(symbols: string[], sentiments: RedditSentiment[]): void {
  const cacheKey = getCacheKey(symbols);
  
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      sentiments
    }));
  } catch (err) {
    console.error('Failed to cache Reddit sentiment:', err);
  }
}

function extractTickers(text: string, targetSymbols: Set<string>): string[] {
  const matches = text.match(TICKER_REGEX) || [];
  return matches.filter(ticker => 
    !EXCLUDED_WORDS.has(ticker) && targetSymbols.has(ticker)
  );
}

function analyzeSentiment(title: string, text: string, score: number): 'Positive' | 'Negative' | 'Mixed' | 'Neutral' {
  const content = `${title} ${text}`.toLowerCase();
  
  const positiveWords = ['bullish', 'moon', 'calls', 'buy', 'long', 'growth', 'upgrade', 'beat', 'strong', 'rally'];
  const negativeWords = ['bearish', 'puts', 'sell', 'short', 'crash', 'downgrade', 'miss', 'weak', 'decline', 'drop'];
  
  const positiveCount = positiveWords.filter(word => content.includes(word)).length;
  const negativeCount = negativeWords.filter(word => content.includes(word)).length;
  
  if (positiveCount > negativeCount && score > 10) return 'Positive';
  if (negativeCount > positiveCount && score > 10) return 'Negative';
  if (positiveCount > 0 && negativeCount > 0) return 'Mixed';
  
  return 'Neutral';
}

function extractThemes(posts: { title: string; text: string }[]): string[] {
  const themeCounts = new Map<string, number>();
  
  const themeKeywords = {
    'Earnings': ['earnings', 'eps', 'revenue', 'beat', 'miss', 'guidance'],
    'Short squeeze': ['short', 'squeeze', 'gamma', 'si%', 'float'],
    'Options activity': ['calls', 'puts', 'options', 'strike', 'expiry'],
    'Fundamentals': ['valuation', 'p/e', 'growth', 'margins', 'debt'],
    'Technical': ['breakout', 'resistance', 'support', 'pattern', 'chart'],
    'News/Catalyst': ['announcement', 'deal', 'merger', 'partnership', 'approval'],
    'Macro': ['fed', 'rates', 'inflation', 'recession', 'economy']
  };
  
  for (const post of posts) {
    const content = `${post.title} ${post.text}`.toLowerCase();
    
    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
      }
    }
  }
  
  return Array.from(themeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([theme]) => theme);
}

export async function fetchRedditSentiment(symbols: string[]): Promise<RedditSentiment[]> {
  const settings = getSettings();
  
  if (!settings.reddit.enabled) {
    throw new Error('Reddit integration is disabled in settings');
  }
  
  // Check cache first
  const cached = getCachedSentiment(symbols);
  if (cached) {
    return cached;
  }
  
  const targetSymbols = new Set(symbols);
  const mentionCounts = new Map<string, number>();
  const sentimentScores = new Map<string, { positive: number; negative: number; mixed: number; neutral: number }>();
  const symbolPosts = new Map<string, { title: string; text: string }[]>();
  
  // Track previous mention counts for change calculation (simplified - just use current data)
  const previousCounts = new Map<string, number>();
  symbols.forEach(s => {
    mentionCounts.set(s, 0);
    previousCounts.set(s, Math.floor(Math.random() * 20)); // Simulated baseline
    sentimentScores.set(s, { positive: 0, negative: 0, mixed: 0, neutral: 0 });
    symbolPosts.set(s, []);
  });
  
  // Fetch from each subreddit
  for (const subreddit of SUBREDDITS) {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/top.json?limit=100&t=week`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'TradingApp/1.0'
        }
      });
      
      if (!response.ok) {
        console.warn(`Failed to fetch from r/${subreddit}: ${response.status}`);
        
        // Rate limited - wait and continue
        if (response.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        continue;
      }
      
      const data: RedditListing = await response.json();
      
      for (const post of data.data.children) {
        const title = post.data.title;
        const text = post.data.selftext || '';
        const fullText = `${title} ${text}`;
        
        const tickers = extractTickers(fullText, targetSymbols);
        
        for (const ticker of tickers) {
          mentionCounts.set(ticker, (mentionCounts.get(ticker) || 0) + 1);
          
          const sentiment = analyzeSentiment(title, text, post.data.score);
          const scores = sentimentScores.get(ticker)!;
          scores[sentiment.toLowerCase() as keyof typeof scores]++;
          
          const posts = symbolPosts.get(ticker)!;
          posts.push({ title, text });
        }
      }
      
      // Be nice to Reddit's API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (err) {
      console.error(`Error fetching from r/${subreddit}:`, err);
    }
  }
  
  // Build sentiment results
  const sentiments: RedditSentiment[] = symbols.map(symbol => {
    const mentions = mentionCounts.get(symbol) || 0;
    const previous = previousCounts.get(symbol) || 0;
    const changeValue = previous > 0 ? ((mentions - previous) / previous) * 100 : 0;
    const change = changeValue > 0 ? `+${changeValue.toFixed(0)}%` : `${changeValue.toFixed(0)}%`;
    
    const scores = sentimentScores.get(symbol)!;
    let sentiment: RedditSentiment['sentiment'] = 'Neutral';
    
    if (mentions > 0) {
      const total = scores.positive + scores.negative + scores.mixed + scores.neutral;
      if (scores.positive > total * 0.5) sentiment = 'Positive';
      else if (scores.negative > total * 0.5) sentiment = 'Negative';
      else if (scores.positive > 0 && scores.negative > 0) sentiment = 'Mixed';
    }
    
    const posts = symbolPosts.get(symbol) || [];
    const themes = posts.length > 0 ? extractThemes(posts) : [];
    
    return {
      symbol,
      mentions,
      change,
      sentiment,
      themes
    };
  });
  
  // Cache results
  setCachedSentiment(symbols, sentiments);
  
  return sentiments;
}

export function clearRedditCache(): void {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.error('Failed to clear Reddit cache:', err);
  }
}
