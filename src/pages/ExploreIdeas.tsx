import { useState, useEffect, useCallback } from 'react';
import SectionHeader from '../components/SectionHeader';
import WatchlistManager from '../components/WatchlistManager';
import { getAllWatchlist, getLatestPrice, getSymbol } from '../lib/db';
import { calculateIndicators } from '../lib/dataService';
import { fetchRedditSentiment, fetchRedditDeepDives, getLastDeepDiveFetchTimestamp, fetchRedditPostContent, type RedditSentiment, type RedditDeepDive } from '../lib/redditService';
import { fetchTwitterFeed, getLastFetchTimestamp, type Tweet } from '../lib/twitterService';
import { isRedditEnabled, isTwitterEnabled, getSettings } from '../lib/settingsService';
import { analyzeFileContent, analyzeRedditPost } from '../lib/openaiService';
import type { WatchlistItem } from '../lib/types';

const quantFilters = [
  { label: 'Above SMA200', value: 'On' },
  { label: '1M Rel Strength vs SPY', value: 'Top 30%' },
  { label: 'ATR% band', value: '2% - 6%' },
  { label: 'Rising volume', value: '2 of last 3 weeks' }
];

export default function ExploreIdeas() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [redditSentiment, setRedditSentiment] = useState<RedditSentiment[]>([]);
  const [redditLoading, setRedditLoading] = useState(false);
  const [redditError, setRedditError] = useState<string | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<string | null>(null);
  const [ideaReviewLoading, setIdeaReviewLoading] = useState(false);
  const [ideaReviewResult, setIdeaReviewResult] = useState<string | null>(null);
  const [ideaReviewError, setIdeaReviewError] = useState<string | null>(null);
  
  // File analysis state
  const [fileAnalysisSymbol, setFileAnalysisSymbol] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileAnalysisLoading, setFileAnalysisLoading] = useState(false);
  const [fileAnalysisResult, setFileAnalysisResult] = useState<string | null>(null);
  const [fileAnalysisError, setFileAnalysisError] = useState<string | null>(null);

  // Reddit deep dives state
  const [redditDeepDives, setRedditDeepDives] = useState<RedditDeepDive[]>([]);
  const [deepDivesLoading, setDeepDivesLoading] = useState(false);
  const [deepDivesError, setDeepDivesError] = useState<string | null>(null);
  const [deepDivesLastFetch, setDeepDivesLastFetch] = useState<number | null>(null);

  // Twitter feed state
  const [twitterFeed, setTwitterFeed] = useState<Tweet[]>([]);
  const [twitterLoading, setTwitterLoading] = useState(false);
  const [twitterError, setTwitterError] = useState<string | null>(null);
  const [twitterLastFetch, setTwitterLastFetch] = useState<number | null>(null);

  // Reddit post AI analysis state
  const [analyzingPost, setAnalyzingPost] = useState<string | null>(null);
  const [postAnalysisResult, setPostAnalysisResult] = useState<string | null>(null);
  const [postAnalysisError, setPostAnalysisError] = useState<string | null>(null);
  const [selectedPostForAnalysis, setSelectedPostForAnalysis] = useState<RedditDeepDive | null>(null);

  // Batch analysis state
  const [batchAnalysisLoading, setBatchAnalysisLoading] = useState(false);
  const [batchAnalysisResult, setBatchAnalysisResult] = useState<{
    summary: string;
    suggestedStocks: Array<{
      symbol: string;
      confidence: 'High' | 'Medium' | 'Low';
      reasoning: string;
    }>;
    emergingThemes: string[];
  } | null>(null);
  const [batchAnalysisError, setBatchAnalysisError] = useState<string | null>(null);

  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    try {
      const dbWatchlist = getAllWatchlist();
      const items: WatchlistItem[] = [];
      
      for (const entry of dbWatchlist) {
        const latestPrice = getLatestPrice(entry.symbol);
        const symbolInfo = getSymbol(entry.symbol);
        
        if (!latestPrice) {
          console.warn(`No price data for ${entry.symbol}`);
          continue;
        }
        
        let indicators;
        try {
          indicators = await calculateIndicators(entry.symbol);
        } catch (err) {
          console.warn(`Failed to calculate indicators for ${entry.symbol}:`, err);
          continue;
        }
        
        const aboveSma200 = indicators.sma200 ? latestPrice.close > indicators.sma200 : false;
        const atrPct = indicators.atr14 ? (indicators.atr14 / latestPrice.close) * 100 : 0;
        
        items.push({
          symbol: entry.symbol,
          name: symbolInfo?.name || entry.symbol,
          thesisTag: entry.thesis_tag || 'Other',
          timeHorizon: 'Months', // Default
          notes: entry.notes || '',
          last: latestPrice.close,
          aboveSma200,
          atrPct
        });
      }
      
      setWatchlist(items);
    } catch (err) {
      console.error('Failed to load watchlist:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWatchlist();
    loadRedditSentiment();
    loadRedditDeepDives();
    loadTwitterFeed();
  }, [loadWatchlist]);

  const loadRedditSentiment = async (forceRefresh = false) => {
    if (!isRedditEnabled()) {
      return;
    }

    setRedditLoading(true);
    setRedditError(null);

    try {
      // Get popular symbols from watchlist or use defaults
      const symbols = watchlist.length > 0 
        ? watchlist.slice(0, 10).map(w => w.symbol)
        : ['NVDA', 'AVGO', 'RTX', 'TSLA', 'AAPL', 'MSFT', 'GOOGL'];

      // Clear cache if force refresh is requested
      if (forceRefresh) {
        const { clearRedditCache } = await import('../lib/redditService');
        clearRedditCache();
      }

      const sentiment = await fetchRedditSentiment(symbols);
      setRedditSentiment(sentiment.filter(s => s.mentions > 0));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Reddit sentiment';
      setRedditError(message);
      console.error('Reddit sentiment fetch failed:', err);
    } finally {
      setRedditLoading(false);
    }
  };

  const loadRedditDeepDives = async (forceRefresh = false) => {
    if (!isRedditEnabled()) {
      return;
    }

    setDeepDivesLoading(true);
    setDeepDivesError(null);

    try {
      // Clear cache if force refresh is requested
      if (forceRefresh) {
        const { clearRedditCache } = await import('../lib/redditService');
        clearRedditCache();
      }

      const deepDives = await fetchRedditDeepDives(10);
      setRedditDeepDives(deepDives);
      setDeepDivesLastFetch(getLastDeepDiveFetchTimestamp());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Reddit deep dives';
      setDeepDivesError(message);
      console.error('Reddit deep dives fetch failed:', err);
    } finally {
      setDeepDivesLoading(false);
    }
  };

  const loadTwitterFeed = async (forceRefresh = false) => {
    if (!isTwitterEnabled()) {
      return;
    }

    const settings = getSettings();
    if (settings.twitter.followedAccounts.length === 0) {
      return;
    }

    setTwitterLoading(true);
    setTwitterError(null);

    try {
      // Clear cache if force refresh is requested
      if (forceRefresh) {
        const { clearTwitterCache } = await import('../lib/twitterService');
        clearTwitterCache();
      }

      const tweets = await fetchTwitterFeed(20);
      setTwitterFeed(tweets);
      setTwitterLastFetch(getLastFetchTimestamp(settings.twitter.followedAccounts));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Twitter feed';
      setTwitterError(message);
      console.error('Twitter feed fetch failed:', err);
    } finally {
      setTwitterLoading(false);
    }
  };

  const handleIdeaReview = async (symbol: string) => {
    setIdeaReviewLoading(true);
    setIdeaReviewError(null);
    setIdeaReviewResult(null);
    setSelectedIdea(symbol);

    try {
      const { generatePositionReview } = await import('../lib/openaiService');
      const result = await generatePositionReview(symbol);
      setIdeaReviewResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate review';
      setIdeaReviewError(message);
      console.error('AI review failed:', err);
    } finally {
      setIdeaReviewLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadedFiles([files[0]]); // Only take first file
      setFileAnalysisResult(null);
      setFileAnalysisError(null);
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const formatTimestamp = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    return formatRelativeTime(timestamp);
  };

  const handleAnalyzeFiles = async () => {
    if (uploadedFiles.length === 0) {
      setFileAnalysisError('Please upload a file');
      return;
    }

    setFileAnalysisLoading(true);
    setFileAnalysisError(null);
    setFileAnalysisResult(null);

    try {
      const file = uploadedFiles[0];
      const text = await readFileAsText(file);
      
      const result = await analyzeFileContent(
        text,
        file.name,
        file.type || 'unknown',
        fileAnalysisSymbol || undefined
      );
      
      setFileAnalysisResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze file';
      setFileAnalysisError(message);
      console.error('File analysis failed:', err);
    } finally {
      setFileAnalysisLoading(false);
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleAnalyzeRedditPost = async (post: RedditDeepDive) => {
    setAnalyzingPost(post.id);
    setPostAnalysisError(null);
    setPostAnalysisResult(null);
    setSelectedPostForAnalysis(post);

    try {
      // Fetch full post content
      const fullContent = await fetchRedditPostContent(post.url);
      
      // Analyze with AI
      const result = await analyzeRedditPost(
        post.title,
        fullContent,
        post.author,
        post.subreddit
      );
      
      setPostAnalysisResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze post';
      setPostAnalysisError(message);
      console.error('Reddit post analysis failed:', err);
    } finally {
      setAnalyzingPost(null);
    }
  };

  const handleClosePostAnalysis = () => {
    setPostAnalysisResult(null);
    setPostAnalysisError(null);
    setSelectedPostForAnalysis(null);
  };

  const handleBatchAnalysis = async () => {
    setBatchAnalysisLoading(true);
    setBatchAnalysisError(null);
    setBatchAnalysisResult(null);

    try {
      const { analyzeRedditBatch } = await import('../lib/redditService');
      const result = await analyzeRedditBatch(redditSentiment, redditDeepDives);
      setBatchAnalysisResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze Reddit data';
      setBatchAnalysisError(message);
      console.error('Batch analysis failed:', err);
    } finally {
      setBatchAnalysisLoading(false);
    }
  };

  const handleAddToWatchlist = async (symbol: string) => {
    try {
      const { addToWatchlist } = await import('../lib/dbOperations');
      addToWatchlist({
        symbol,
        thesis_tag: 'Other',
        notes: 'Added from Reddit batch analysis - AI suggested'
      });
      showSaveMessage(`${symbol} added to watchlist`);
      loadWatchlist();
    } catch (err) {
      console.error('Failed to add to watchlist:', err);
      showSaveMessage('Failed to add to watchlist', true);
    }
  };

  const showSaveMessage = (message: string, isError = false) => {
    // You might want to add a toast notification here
    console.log(isError ? `Error: ${message}` : message);
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader title="Explore / New Ideas" subtitle="Shortlist only. Cap candidates to 50." />

      <WatchlistManager onUpdate={loadWatchlist} />

      <div className="card">
        <SectionHeader title="Watchlist" subtitle="Your tracked ideas" />
        {loading ? (
          <div className="mt-4 text-sm text-slate-400">Loading watchlist...</div>
        ) : watchlist.length === 0 ? (
          <div className="mt-4 text-sm text-slate-400">No watchlist items yet. Add symbols above to track them.</div>
        ) : (
          <div className="mt-4">
            <table className="table-grid">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Last</th>
                  <th>ATR%</th>
                  <th>SMA200</th>
                  <th>Thesis</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((item) => (
                  <tr key={item.symbol}>
                    <td className="font-semibold text-slate-100">{item.symbol}</td>
                    <td>{item.name}</td>
                    <td>${item.last.toFixed(2)}</td>
                    <td>{item.atrPct.toFixed(1)}%</td>
                    <td>{item.aboveSma200 ? 'Above' : 'Below'}</td>
                    <td>
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                        {item.thesisTag}
                      </span>
                    </td>
                    <td className="text-xs text-slate-400">{item.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <SectionHeader title="Quant screen" subtitle="Objective filters" />
        <div className="mt-4 flex flex-wrap gap-2">
          {quantFilters.map((filter) => (
            <div key={filter.label} className="rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-300">
              {filter.label}: <span className="text-slate-100">{filter.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 text-sm text-slate-400">
          Quant screening feature coming soon. Use the watchlist manager above to track specific symbols.
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <SectionHeader title="Narrative signals" subtitle="Optional Reddit clustering (cached)" />
          {isRedditEnabled() && (
            <button
              onClick={() => loadRedditSentiment(true)}
              disabled={redditLoading}
              className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              {redditLoading ? 'Loading...' : 'Refresh'}
            </button>
          )}
        </div>
        
        {!isRedditEnabled() ? (
          <div className="mt-4 text-sm text-slate-400">
            Reddit sentiment is disabled. Enable it in settings to see narrative signals.
          </div>
        ) : redditError ? (
          <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
            {redditError}
          </div>
        ) : redditLoading ? (
          <div className="mt-4 text-sm text-slate-400">Loading Reddit sentiment...</div>
        ) : redditSentiment.length === 0 ? (
          <div className="mt-4 text-sm text-slate-400">No mentions found in recent posts.</div>
        ) : (
          <>
            <div className="mt-4 grid gap-3">
              {redditSentiment.map((cluster) => (
                <div
                  key={cluster.symbol}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 cursor-pointer hover:bg-slate-800/50"
                  onClick={() => handleIdeaReview(cluster.symbol)}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{cluster.symbol}</p>
                    <p className="text-xs text-slate-400">
                      Mentions {cluster.mentions} ({cluster.change}) · Sentiment {cluster.sentiment}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cluster.themes.map((theme) => (
                      <span key={theme} className="rounded-full border border-slate-800 px-2 py-1 text-xs text-slate-300">
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Batch AI Analysis Section */}
            <div className="mt-6">
              <button
                onClick={handleBatchAnalysis}
                disabled={batchAnalysisLoading || !getSettings().openai.enabled}
                className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 font-medium text-white hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {batchAnalysisLoading ? '🤖 Analyzing...' : '🤖 AI Market Analysis & Stock Suggestions'}
              </button>
              
              {!getSettings().openai.enabled && (
                <p className="mt-2 text-center text-xs text-slate-400">
                  Enable OpenAI integration in settings to use this feature
                </p>
              )}

              {batchAnalysisError && (
                <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                  {batchAnalysisError}
                </div>
              )}

              {batchAnalysisResult && (
                <div className="mt-4 space-y-4">
                  {/* Market Summary */}
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                    <h3 className="mb-2 text-sm font-semibold text-cyan-400">Market Sentiment Summary</h3>
                    <p className="text-sm text-slate-300">{batchAnalysisResult.summary}</p>
                  </div>
                  
                  {/* Suggested Stocks */}
                  {batchAnalysisResult.suggestedStocks.length > 0 && (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                      <h3 className="mb-3 text-sm font-semibold text-cyan-400">AI Suggested Stocks</h3>
                      <div className="space-y-3">
                        {batchAnalysisResult.suggestedStocks.map((stock) => (
                          <div key={stock.symbol} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-slate-100">{stock.symbol}</p>
                                <span className={`rounded-full px-2 py-0.5 text-xs ${
                                  stock.confidence === 'High' ? 'bg-green-500/20 text-green-300' :
                                  stock.confidence === 'Medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                  'bg-slate-500/20 text-slate-300'
                                }`}>
                                  {stock.confidence}
                                </span>
                              </div>
                              <p className="text-sm text-slate-400">{stock.reasoning}</p>
                            </div>
                            <button
                              onClick={() => handleAddToWatchlist(stock.symbol)}
                              className="ml-3 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/20"
                            >
                              Add to Watchlist
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Emerging Themes */}
                  {batchAnalysisResult.emergingThemes.length > 0 && (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                      <h3 className="mb-3 text-sm font-semibold text-cyan-400">Emerging Themes</h3>
                      <div className="flex flex-wrap gap-2">
                        {batchAnalysisResult.emergingThemes.map((theme) => (
                          <span key={theme} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Social Media Feeds Section */}
      <div className="card">
        <SectionHeader title="Social Media Feeds" subtitle="Market sentiment from Reddit and Twitter" />
        
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {/* Reddit Deep Dives Feed */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Reddit Stock Deep Dives</h3>
                <p className="text-xs text-slate-400">
                  Last updated: {formatTimestamp(deepDivesLastFetch)}
                </p>
              </div>
              {isRedditEnabled() && (
                <button
                  onClick={() => loadRedditDeepDives(true)}
                  disabled={deepDivesLoading}
                  className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                >
                  {deepDivesLoading ? 'Loading...' : 'Refresh'}
                </button>
              )}
            </div>

            <div className="space-y-3">
              {!isRedditEnabled() ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                  Reddit integration is disabled. Enable it in settings to see deep dives.
                </div>
              ) : deepDivesError ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                  {deepDivesError}
                </div>
              ) : deepDivesLoading ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                  Loading deep dives...
                </div>
              ) : redditDeepDives.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                  No deep dive posts found. Try refreshing.
                </div>
              ) : (
                redditDeepDives.map((post) => (
                  <div
                    key={post.id}
                    className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                  >
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block transition-colors hover:bg-slate-800/50"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium text-slate-100 line-clamp-2">
                          {post.title}
                        </h4>
                      </div>
                      <p className="mb-2 text-xs text-slate-400 line-clamp-2">
                        {post.preview}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>{post.author}</span>
                        <span>•</span>
                        <span>{post.subreddit}</span>
                        <span>•</span>
                        <span>↑ {post.upvotes}</span>
                        <span>•</span>
                        <span>💬 {post.comments}</span>
                        <span>•</span>
                        <span>{formatRelativeTime(post.created)}</span>
                      </div>
                    </a>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleAnalyzeRedditPost(post);
                      }}
                      disabled={analyzingPost === post.id}
                      className="mt-3 w-full rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {analyzingPost === post.id ? 'Analyzing...' : '🤖 Analyze with AI'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Twitter Feed */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Twitter Feed</h3>
                <p className="text-xs text-slate-400">
                  Last updated: {formatTimestamp(twitterLastFetch)}
                </p>
              </div>
              {isTwitterEnabled() && (
                <button
                  onClick={() => loadTwitterFeed(true)}
                  disabled={twitterLoading}
                  className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                >
                  {twitterLoading ? 'Loading...' : 'Refresh'}
                </button>
              )}
            </div>

            <div className="space-y-3">
              {!isTwitterEnabled() ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                  Twitter integration is disabled. Enable it in settings to see tweets.
                </div>
              ) : getSettings().twitter.followedAccounts.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                  No Twitter accounts configured. Add accounts in settings to see tweets.
                </div>
              ) : twitterError ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                  {twitterError}
                </div>
              ) : twitterLoading ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                  Loading tweets...
                </div>
              ) : twitterFeed.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                  No tweets found. Try refreshing or add more accounts in settings.
                </div>
              ) : (
                twitterFeed.map((tweet) => (
                  <a
                    key={tweet.id}
                    href={tweet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-slate-800 bg-slate-900/60 p-3 transition-colors hover:bg-slate-800/50"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-100">{tweet.author}</p>
                        <p className="text-xs text-slate-500">{tweet.authorHandle}</p>
                      </div>
                      <span className="text-xs text-slate-500">{formatRelativeTime(tweet.timestamp)}</span>
                    </div>
                    <p className="mb-2 text-sm text-slate-300">
                      {tweet.content}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>❤️ {tweet.likes}</span>
                      <span>🔄 {tweet.retweets}</span>
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHeader title="Idea detail" subtitle="Select a candidate to review" />
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
          <p>Chart placeholder (price + SMA50/200). Fundamentals and AI idea review appear here.</p>
          {selectedIdea && (
            <p className="mt-2 text-slate-200">Selected: {selectedIdea}</p>
          )}
        </div>
        <button 
          onClick={() => selectedIdea && handleIdeaReview(selectedIdea)}
          disabled={!selectedIdea || ideaReviewLoading}
          className="mt-4 w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700 disabled:opacity-50"
        >
          {ideaReviewLoading ? 'Generating...' : 'AI idea review'}
        </button>
        
        {ideaReviewError && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {ideaReviewError}
          </div>
        )}
        
        {ideaReviewResult && (
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-slate-400">AI Review</p>
              <button
                onClick={() => setIdeaReviewResult(null)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm text-slate-300">{ideaReviewResult}</div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <SectionHeader title="AI-Powered Stock Analysis" subtitle="Upload documents for AI analysis" />
        
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs uppercase text-slate-400 mb-2">
              Stock Symbol (Optional)
            </label>
            <input
              type="text"
              value={fileAnalysisSymbol}
              onChange={(e) => setFileAnalysisSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., AAPL"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-400">
              Specify a stock symbol if the document relates to a specific company
            </p>
          </div>

          <div>
            <label className="block text-xs uppercase text-slate-400 mb-2">
              Upload Files
            </label>
            <div className="relative">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".txt,.pdf,.doc,.docx,.csv"
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="flex items-center justify-center w-full rounded-lg border-2 border-dashed border-slate-700 bg-slate-800/50 px-6 py-8 cursor-pointer hover:border-cyan-500 hover:bg-slate-800 transition-colors"
              >
                <div className="text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-slate-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-slate-300">
                    <span className="font-semibold text-cyan-400">Click to upload</span> or drag and drop
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    PDF, TXT, DOC, DOCX, CSV files supported
                  </p>
                </div>
              </label>
            </div>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase text-slate-400">Uploaded Files</p>
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm text-slate-100">{file.name}</p>
                      <p className="text-xs text-slate-400">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="text-rose-400 hover:text-rose-300"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleAnalyzeFiles}
            disabled={uploadedFiles.length === 0 || fileAnalysisLoading}
            className="w-full rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {fileAnalysisLoading ? 'Analyzing...' : 'Analyze with AI'}
          </button>

          {fileAnalysisError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              {fileAnalysisError}
            </div>
          )}

          {fileAnalysisResult && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-slate-400">AI Analysis Results</p>
                <button
                  onClick={() => setFileAnalysisResult(null)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Close
                </button>
              </div>
              <div className="prose prose-invert prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-sm text-slate-300">{fileAnalysisResult}</div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* AI Analysis Modal */}
      {(postAnalysisResult || postAnalysisError) && selectedPostForAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 p-4">
              <div className="flex-1 pr-4">
                <h3 className="text-lg font-semibold text-slate-100">AI Analysis</h3>
                <p className="mt-1 text-xs text-slate-400 line-clamp-1">
                  {selectedPostForAnalysis.title}
                </p>
              </div>
              <button
                onClick={handleClosePostAnalysis}
                className="text-slate-400 hover:text-slate-200"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              {postAnalysisError ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {postAnalysisError}
                </div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-sm text-slate-300">
                    {postAnalysisResult}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
