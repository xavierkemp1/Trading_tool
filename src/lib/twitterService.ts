import { getSettings } from './settingsService';

export interface Tweet {
  id: string;
  author: string;
  authorHandle: string;
  content: string;
  timestamp: number;
  likes: number;
  retweets: number;
  url: string;
}

interface TwitterApiResponse {
  data?: Array<{
    id: string;
    text: string;
    author_id: string;
    created_at: string;
    public_metrics?: {
      like_count: number;
      retweet_count: number;
    };
  }>;
  includes?: {
    users?: Array<{
      id: string;
      name: string;
      username: string;
    }>;
  };
  meta?: {
    result_count: number;
  };
}

const CACHE_KEY_PREFIX = 'twitter_feed_';
const RATE_LIMIT_KEY = 'twitter_rate_limit';

// Rate limiting: Track requests per hour
interface RateLimitData {
  requests: number[];
  lastReset: number;
}

function getCacheKey(accounts: string[]): string {
  return `${CACHE_KEY_PREFIX}${accounts.sort().join('_')}`;
}

function getCachedTweets(accounts: string[]): Tweet[] | null {
  const settings = getSettings();
  const cacheKey = getCacheKey(accounts);
  
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    const cacheAge = Date.now() - data.timestamp;
    const maxAge = settings.twitter.cacheHours * 60 * 60 * 1000;
    
    if (cacheAge < maxAge) {
      return data.tweets;
    }
  } catch (err) {
    console.error('Failed to read Twitter cache:', err);
  }
  
  return null;
}

function setCachedTweets(accounts: string[], tweets: Tweet[]): void {
  const cacheKey = getCacheKey(accounts);
  
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      tweets
    }));
  } catch (err) {
    console.error('Failed to cache Twitter feed:', err);
  }
}

function checkRateLimit(): boolean {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    
    let rateLimitData: RateLimitData = stored 
      ? JSON.parse(stored)
      : { requests: [], lastReset: now };
    
    // Remove requests older than 1 hour
    rateLimitData.requests = rateLimitData.requests.filter(time => time > hourAgo);
    
    // twitterapi.io typically has limits around 500-1000 requests/hour for basic plans
    // Using conservative limit of 100 requests/hour
    const MAX_REQUESTS_PER_HOUR = 100;
    
    if (rateLimitData.requests.length >= MAX_REQUESTS_PER_HOUR) {
      return false; // Rate limit exceeded
    }
    
    // Add current request
    rateLimitData.requests.push(now);
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(rateLimitData));
    
    return true; // Rate limit OK
  } catch (err) {
    console.error('Failed to check rate limit:', err);
    return true; // Allow request on error
  }
}

export async function fetchTwitterFeed(maxTweets: number = 20): Promise<Tweet[]> {
  const settings = getSettings();
  
  if (!settings.twitter.enabled) {
    throw new Error('Twitter integration is disabled in settings');
  }
  
  const accounts = settings.twitter.followedAccounts || [];
  if (accounts.length === 0) {
    return [];
  }
  
  // Check cache first
  const cached = getCachedTweets(accounts);
  if (cached) {
    return cached;
  }
  
  // Check rate limit
  if (!checkRateLimit()) {
    throw new Error('Twitter API rate limit exceeded. Please try again later.');
  }
  
  const apiKey = import.meta.env.VITE_TWITTER_API_KEY;
  if (!apiKey) {
    throw new Error('Twitter API key not configured. Please set VITE_TWITTER_API_KEY in your environment.');
  }
  
  try {
    // For demo purposes, we'll simulate the API call
    // In production, you would call twitterapi.io endpoint
    
    // Example endpoint: https://api.twitterapi.io/v2/users/by/username/:username/tweets
    // This is a placeholder - actual implementation would need proper endpoint
    
    const tweets: Tweet[] = [];
    
    for (const account of accounts.slice(0, 5)) { // Limit to 5 accounts to avoid too many requests
      try {
        // In production, this would be:
        // const response = await fetch(`https://api.twitterapi.io/v2/users/by/username/${account}/tweets?max_results=5`, {
        //   headers: {
        //     'Authorization': `Bearer ${apiKey}`,
        //     'Content-Type': 'application/json'
        //   }
        // });
        
        // For now, create sample data structure
        // const data: TwitterApiResponse = await response.json();
        
        // Mock data for demonstration
        const mockTweet: Tweet = {
          id: `${account}_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          author: account.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          authorHandle: `@${account}`,
          content: `Latest market insights from ${account} - This is a sample tweet. Configure VITE_TWITTER_API_KEY to see real tweets.`,
          timestamp: Date.now() - Math.random() * 86400000, // Random time in last 24h
          likes: Math.floor(Math.random() * 1000),
          retweets: Math.floor(Math.random() * 100),
          url: `https://twitter.com/${account}/status/mock_${Date.now()}`
        };
        
        tweets.push(mockTweet);
        
        // Add delay between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (err) {
        console.error(`Failed to fetch tweets for @${account}:`, err);
      }
    }
    
    // Sort by timestamp (newest first)
    tweets.sort((a, b) => b.timestamp - a.timestamp);
    
    // Limit to maxTweets
    const limitedTweets = tweets.slice(0, maxTweets);
    
    // Cache results
    setCachedTweets(accounts, limitedTweets);
    
    return limitedTweets;
    
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch Twitter feed';
    throw new Error(message);
  }
}

export function clearTwitterCache(): void {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
    localStorage.removeItem(RATE_LIMIT_KEY);
  } catch (err) {
    console.error('Failed to clear Twitter cache:', err);
  }
}

export function getLastFetchTimestamp(accounts: string[]): number | null {
  const cacheKey = getCacheKey(accounts);
  
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    return data.timestamp;
  } catch (err) {
    return null;
  }
}
