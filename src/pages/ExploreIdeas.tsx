import { useState, useEffect, useCallback } from 'react';
import SectionHeader from '../components/SectionHeader';
import WatchlistManager from '../components/WatchlistManager';
import { getAllWatchlist, getLatestPrice, getSymbol } from '../lib/db';
import { calculateIndicators } from '../lib/dataService';
import { fetchRedditSentiment, type RedditSentiment } from '../lib/redditService';
import { isRedditEnabled } from '../lib/settingsService';
import { analyzeFileContent } from '../lib/openaiService';
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
  }, [loadWatchlist]);

  const loadRedditSentiment = async () => {
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
      setUploadedFiles(Array.from(files));
      setFileAnalysisResult(null);
      setFileAnalysisError(null);
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyzeFiles = async () => {
    if (uploadedFiles.length === 0) {
      setFileAnalysisError('Please upload at least one file');
      return;
    }

    setFileAnalysisLoading(true);
    setFileAnalysisError(null);
    setFileAnalysisResult(null);

    try {
      const file = uploadedFiles[0]; // Analyze first file for now
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
              onClick={loadRedditSentiment}
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
        )}
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
                multiple
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
    </div>
  );
}
