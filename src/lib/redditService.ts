import { getSettings } from './settingsService';

export interface RedditSentiment {
  symbol: string;
  mentions: number;
  change: string;
  sentiment: 'Positive' | 'Negative' | 'Mixed' | 'Neutral';
  themes: string[];
}

export interface RedditDeepDive {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  upvotes: number;
  comments: number;
  preview: string;
  url: string;
  created: number;
}

interface RedditPost {
  data: {
    id?: string;
    title: string;
    selftext: string;
    score: number;
    num_comments: number;
    created_utc: number;
    author?: string;
  };
}

interface RedditListing {
  data: {
    children: RedditPost[];
  };
}

const CACHE_KEY_PREFIX = 'reddit_sentiment_';
const DEEP_DIVE_CACHE_KEY = 'reddit_deep_dives';
const DEEP_DIVE_SUBREDDITS = ['wallstreetbets', 'stocks', 'investing', 'stockmarket', 'SecurityAnalysis'];
const SUBREDDITS = ['wallstreetbets', 'stocks', 'options'];

/**
 * Get the proxy URL from environment or default
 */
function getProxyUrl(): string {
  return import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
}

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
  
  // Track previous mention counts for change calculation
  // Note: Using simulated baseline for demo purposes. In production, store actual historical data.
  const previousCounts = new Map<string, number>();
  symbols.forEach(s => {
    mentionCounts.set(s, 0);
    previousCounts.set(s, Math.floor(Math.random() * 20)); // Simulated baseline
    sentimentScores.set(s, { positive: 0, negative: 0, mixed: 0, neutral: 0 });
    symbolPosts.set(s, []);
  });
  
  // Fetch from each subreddit with retry logic
  for (const subreddit of SUBREDDITS) {
    let retries = 0;
    const maxRetries = 2;
    let success = false;
    
    while (retries <= maxRetries && !success) {
      try {
        const proxyUrl = getProxyUrl();
        const url = `${proxyUrl}/api/reddit?subreddit=${subreddit}&sort=top&limit=100&t=week`;
        const response = await fetch(url);
        
        if (!response.ok) {
          console.warn(`Failed to fetch from r/${subreddit}: ${response.status}`);
          
          // Rate limited - use exponential backoff
          if (response.status === 429 || response.status === 403) {
            const backoffTime = Math.min(5000 * Math.pow(2, retries), 15000);
            console.log(`Rate limited, waiting ${backoffTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            retries++;
            continue;
          }
          
          // Other errors - skip this subreddit
          break;
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
        
        success = true;
        
      } catch (err) {
        console.error(`Error fetching from r/${subreddit}:`, err);
        retries++;
        if (retries <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * retries));
        }
      }
    }
    
    // Longer delay between subreddits to avoid rate limits (increased from 1s to 2s)
    await new Promise(resolve => setTimeout(resolve, 2000));
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
      if (key.startsWith(CACHE_KEY_PREFIX) || key === DEEP_DIVE_CACHE_KEY) {
        localStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.error('Failed to clear Reddit cache:', err);
  }
}

function getCachedDeepDives(): RedditDeepDive[] | null {
  const settings = getSettings();
  
  try {
    const cached = localStorage.getItem(DEEP_DIVE_CACHE_KEY);
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    const cacheAge = Date.now() - data.timestamp;
    const maxAge = settings.reddit.cacheHours * 60 * 60 * 1000;
    
    if (cacheAge < maxAge) {
      return data.deepDives;
    }
  } catch (err) {
    console.error('Failed to read Reddit deep dive cache:', err);
  }
  
  return null;
}

function setCachedDeepDives(deepDives: RedditDeepDive[]): void {
  try {
    localStorage.setItem(DEEP_DIVE_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      deepDives
    }));
  } catch (err) {
    console.error('Failed to cache Reddit deep dives:', err);
  }
}

export async function fetchRedditDeepDives(maxPosts: number = 10): Promise<RedditDeepDive[]> {
  const settings = getSettings();
  
  if (!settings.reddit.enabled) {
    throw new Error('Reddit integration is disabled in settings');
  }
  
  // Check cache first
  const cached = getCachedDeepDives();
  if (cached) {
    return cached;
  }
  
  const deepDives: RedditDeepDive[] = [];
  
  // Fetch from each subreddit with retry logic
  for (const subreddit of DEEP_DIVE_SUBREDDITS) {
    let retries = 0;
    const maxRetries = 2;
    let success = false;
    
    while (retries <= maxRetries && !success) {
      try {
        const proxyUrl = getProxyUrl();
        const url = `${proxyUrl}/api/reddit?subreddit=${subreddit}&sort=hot&limit=20`;
        const response = await fetch(url);
        
        if (!response.ok) {
          console.warn(`Failed to fetch from r/${subreddit}: ${response.status}`);
          
          // Rate limited - use exponential backoff
          if (response.status === 429 || response.status === 403) {
            const backoffTime = Math.min(5000 * Math.pow(2, retries), 15000);
            console.log(`Rate limited, waiting ${backoffTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            retries++;
            continue;
          }
          
          // Other errors - skip this subreddit
          break;
        }
        
        const data: RedditListing = await response.json();
        
        for (const post of data.data.children) {
          const title = post.data.title.toLowerCase();
          const selftext = post.data.selftext.toLowerCase();
          
          // Filter for stock analysis posts (DD = Due Diligence, thesis, analysis, etc.)
          const isStockAnalysis = 
            title.includes('dd') || 
            title.includes('due diligence') ||
            title.includes('thesis') ||
            title.includes('analysis') ||
            title.includes('deep dive') ||
            selftext.includes('bull case') ||
            selftext.includes('bear case') ||
            (post.data.selftext.length > 500 && post.data.score > 50); // Long posts with good engagement
          
          if (isStockAnalysis) {
            // Create preview (first 200 chars of content)
            let preview = post.data.selftext.substring(0, 200);
            if (post.data.selftext.length > 200) {
              preview += '...';
            }
            if (!preview) {
              preview = 'Click to read full analysis on Reddit';
            }
            
            deepDives.push({
              id: `${subreddit}_${post.data.id || post.data.created_utc}`,
              title: post.data.title,
              author: `u/${post.data.author || 'deleted'}`,
              subreddit: `r/${subreddit}`,
              upvotes: post.data.score,
              comments: post.data.num_comments,
              preview,
              url: `https://www.reddit.com/r/${subreddit}/comments/${post.data.id || ''}`,
              created: post.data.created_utc * 1000 // Convert to milliseconds
            });
          }
        }
        
        success = true;
        
      } catch (err) {
        console.error(`Error fetching from r/${subreddit}:`, err);
        retries++;
        if (retries <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * retries));
        }
      }
    }
    
    // Longer delay between subreddits to avoid rate limits (increased from 1s to 2s)
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Sort by upvotes (most popular first)
  deepDives.sort((a, b) => b.upvotes - a.upvotes);
  
  // Limit to maxPosts
  const limitedDeepDives = deepDives.slice(0, maxPosts);
  
  // Cache results
  setCachedDeepDives(limitedDeepDives);
  
  return limitedDeepDives;
}

export function getLastDeepDiveFetchTimestamp(): number | null {
  try {
    const cached = localStorage.getItem(DEEP_DIVE_CACHE_KEY);
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    return data.timestamp;
  } catch (err) {
    return null;
  }
}

/**
 * Fetch full Reddit post content for AI analysis
 */
export async function fetchRedditPostContent(postUrl: string): Promise<string> {
  try {
    // Extract post ID from URL (format: /r/subreddit/comments/POST_ID/...)
    const urlParts = postUrl.split('/');
    const commentsIndex = urlParts.indexOf('comments');
    if (commentsIndex === -1 || commentsIndex + 1 >= urlParts.length) {
      throw new Error('Invalid Reddit post URL');
    }
    
    const postId = urlParts[commentsIndex + 1];
    const subreddit = urlParts[commentsIndex - 1];
    
    // Fetch post data via proxy
    const proxyUrl = getProxyUrl();
    const url = `${proxyUrl}/api/reddit?subreddit=${subreddit}&sort=hot&limit=100`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch post: ${response.status}`);
    }
    
    const data: RedditListing = await response.json();
    
    // Find the specific post
    const post = data.data.children.find(p => p.data.id === postId);
    if (!post) {
      throw new Error('Post not found');
    }
    
    // Return full post content
    return `Title: ${post.data.title}\n\nAuthor: u/${post.data.author || 'deleted'}\n\nContent:\n${post.data.selftext || '(No text content)'}`;
  } catch (err) {
    console.error('Error fetching Reddit post content:', err);
    throw new Error('Failed to fetch post content for analysis');
  }
}
