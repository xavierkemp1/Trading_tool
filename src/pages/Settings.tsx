import { useState, useEffect } from 'react';
import SectionHeader from '../components/SectionHeader';
import { getSettings, updateSettings } from '../lib/settingsService';
import type { Settings as SettingsType } from '../lib/settingsService';

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType>(getSettings());
  const [newTwitterAccount, setNewTwitterAccount] = useState('');
  const [newSubreddit, setNewSubreddit] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  const handleToggleReddit = () => {
    const updated = {
      ...settings,
      reddit: {
        ...settings.reddit,
        enabled: !settings.reddit.enabled
      }
    };
    setSettings(updated);
    updateSettings(updated);
    showSaveMessage('Reddit settings updated');
  };

  const handleToggleTwitter = () => {
    const updated = {
      ...settings,
      twitter: {
        ...settings.twitter,
        enabled: !settings.twitter.enabled
      }
    };
    setSettings(updated);
    updateSettings(updated);
    showSaveMessage('Twitter settings updated');
  };

  const handleAddTwitterAccount = () => {
    if (!newTwitterAccount.trim()) return;
    
    // Remove @ if user includes it
    const cleanAccount = newTwitterAccount.trim().replace('@', '');
    
    if (settings.twitter.followedAccounts.includes(cleanAccount)) {
      showSaveMessage('Account already added', true);
      return;
    }
    
    const updated = {
      ...settings,
      twitter: {
        ...settings.twitter,
        followedAccounts: [...settings.twitter.followedAccounts, cleanAccount]
      }
    };
    setSettings(updated);
    updateSettings(updated);
    setNewTwitterAccount('');
    showSaveMessage(`@${cleanAccount} added`);
  };

  const handleRemoveTwitterAccount = (account: string) => {
    const updated = {
      ...settings,
      twitter: {
        ...settings.twitter,
        followedAccounts: settings.twitter.followedAccounts.filter(a => a !== account)
      }
    };
    setSettings(updated);
    updateSettings(updated);
    showSaveMessage(`@${account} removed`);
  };

  const handleToggleOpenAI = () => {
    const updated = {
      ...settings,
      openai: {
        ...settings.openai,
        enabled: !settings.openai.enabled
      }
    };
    setSettings(updated);
    updateSettings(updated);
    showSaveMessage('OpenAI settings updated');
  };

  const handleAddSubreddit = () => {
    if (!newSubreddit.trim()) return;
    
    const cleanSubreddit = newSubreddit.trim().replace(/^r\//, '');
    
    if (settings.reddit.sources.includes(cleanSubreddit)) {
      showSaveMessage('Subreddit already added', true);
      return;
    }
    
    const updated = {
      ...settings,
      reddit: {
        ...settings.reddit,
        sources: [...settings.reddit.sources, cleanSubreddit]
      }
    };
    setSettings(updated);
    updateSettings(updated);
    setNewSubreddit('');
    showSaveMessage(`r/${cleanSubreddit} added`);
  };

  const handleRemoveSubreddit = (subreddit: string) => {
    const updated = {
      ...settings,
      reddit: {
        ...settings.reddit,
        sources: settings.reddit.sources.filter(s => s !== subreddit)
      }
    };
    setSettings(updated);
    updateSettings(updated);
    showSaveMessage(`r/${subreddit} removed`);
  };

  const handleCacheHoursChange = (hours: number) => {
    const updated = {
      ...settings,
      reddit: {
        ...settings.reddit,
        cacheHours: hours
      }
    };
    setSettings(updated);
    updateSettings(updated);
    showSaveMessage('Cache duration updated');
  };

  const handleMinPostScoreChange = (score: number) => {
    const updated = {
      ...settings,
      reddit: {
        ...settings.reddit,
        minPostScore: score
      }
    };
    setSettings(updated);
    updateSettings(updated);
    showSaveMessage('Min post score updated');
  };

  const handleMinMentionsChange = (mentions: number) => {
    const updated = {
      ...settings,
      reddit: {
        ...settings.reddit,
        minMentions: mentions
      }
    };
    setSettings(updated);
    updateSettings(updated);
    showSaveMessage('Min mentions updated');
  };

  const handlePostsPerSubredditChange = (posts: number) => {
    const updated = {
      ...settings,
      reddit: {
        ...settings.reddit,
        postsPerSubreddit: posts
      }
    };
    setSettings(updated);
    updateSettings(updated);
    showSaveMessage('Posts per subreddit updated');
  };

  const showSaveMessage = (message: string, isError = false) => {
    setSaveMessage(isError ? `Error: ${message}` : message);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader title="Settings" subtitle="Configure integrations and preferences" />

      {saveMessage && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          saveMessage.startsWith('Error') 
            ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
            : 'border-green-500/30 bg-green-500/10 text-green-200'
        }`}>
          {saveMessage}
        </div>
      )}

      {/* Reddit Integration */}
      <div className="card">
        <SectionHeader title="Reddit Integration" subtitle="Configure Reddit API access" />
        
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div>
              <p className="text-sm font-medium text-slate-100">Enable Reddit Integration</p>
              <p className="mt-1 text-xs text-slate-400">
                Fetch stock sentiment and deep dives from Reddit
              </p>
            </div>
            <button
              onClick={handleToggleReddit}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                settings.reddit.enabled ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  settings.reddit.enabled ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {settings.reddit.enabled && (
            <>
              {/* Subreddit Manager */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs uppercase text-slate-400 mb-3">Manage Subreddits</p>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newSubreddit}
                    onChange={(e) => setNewSubreddit(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubreddit()}
                    placeholder="e.g., SecurityAnalysis or r/investing"
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                  <button
                    onClick={handleAddSubreddit}
                    className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {settings.reddit.sources.map((subreddit) => (
                    <div
                      key={subreddit}
                      className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1"
                    >
                      <span className="text-xs text-slate-300">r/{subreddit}</span>
                      <button
                        onClick={() => handleRemoveSubreddit(subreddit)}
                        className="text-xs text-rose-400 hover:text-rose-300"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cache Duration */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase text-slate-400">Cache Duration</p>
                  <p className="text-sm font-medium text-slate-100">{settings.reddit.cacheHours} hours</p>
                </div>
                <input
                  type="range"
                  min="1"
                  max="24"
                  value={settings.reddit.cacheHours}
                  onChange={(e) => handleCacheHoursChange(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>1h</span>
                  <span>24h</span>
                </div>
              </div>

              {/* Filter Controls */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs uppercase text-slate-400 mb-3">Filters</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-300">Min Post Score</label>
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={settings.reddit.minPostScore}
                      onChange={(e) => handleMinPostScoreChange(Number(e.target.value))}
                      className="w-20 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-300">Min Mentions</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={settings.reddit.minMentions}
                      onChange={(e) => handleMinMentionsChange(Number(e.target.value))}
                      className="w-20 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-300">Posts Per Subreddit</label>
                    <select
                      value={settings.reddit.postsPerSubreddit}
                      onChange={(e) => handlePostsPerSubredditChange(Number(e.target.value))}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs font-medium text-slate-300">API Configuration</p>
            <p className="mt-2 text-xs text-slate-400">
              Configure Reddit API credentials in your <code className="rounded bg-slate-800 px-1 py-0.5">.env</code> file:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              <li>• VITE_REDDIT_CLIENT_ID</li>
              <li>• VITE_REDDIT_CLIENT_SECRET</li>
            </ul>
            <p className="mt-2 text-xs text-slate-400">
              Get credentials at: <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">https://www.reddit.com/prefs/apps</a>
            </p>
          </div>
        </div>
      </div>

      {/* Twitter Integration */}
      <div className="card">
        <SectionHeader title="Twitter Integration" subtitle="Follow accounts for market insights" />
        
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div>
              <p className="text-sm font-medium text-slate-100">Enable Twitter Integration</p>
              <p className="mt-1 text-xs text-slate-400">
                Fetch tweets from your followed accounts via twitterapi.io
              </p>
            </div>
            <button
              onClick={handleToggleTwitter}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                settings.twitter.enabled ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  settings.twitter.enabled ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {settings.twitter.enabled && (
            <>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs uppercase text-slate-400 mb-3">Add Twitter Account</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTwitterAccount}
                    onChange={(e) => setNewTwitterAccount(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTwitterAccount()}
                    placeholder="e.g., elonmusk or @jimcramer"
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                  <button
                    onClick={handleAddTwitterAccount}
                    className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs uppercase text-slate-400 mb-3">Followed Accounts</p>
                {settings.twitter.followedAccounts.length === 0 ? (
                  <p className="text-xs text-slate-400">No accounts added yet. Add accounts above to see their tweets.</p>
                ) : (
                  <div className="space-y-2">
                    {settings.twitter.followedAccounts.map((account) => (
                      <div
                        key={account}
                        className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2"
                      >
                        <span className="text-sm text-slate-200">@{account}</span>
                        <button
                          onClick={() => handleRemoveTwitterAccount(account)}
                          className="text-xs text-rose-400 hover:text-rose-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs text-slate-400">
                  Cache duration: {settings.twitter.cacheHours} hour(s)
                </p>
              </div>
            </>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs font-medium text-slate-300">API Configuration</p>
            <p className="mt-2 text-xs text-slate-400">
              Configure Twitter API key in your <code className="rounded bg-slate-800 px-1 py-0.5">.env</code> file:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              <li>• VITE_TWITTER_API_KEY</li>
            </ul>
            <p className="mt-2 text-xs text-slate-400">
              Get API key at: <a href="https://twitterapi.io" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">https://twitterapi.io</a>
            </p>
          </div>
        </div>
      </div>

      {/* OpenAI Integration */}
      <div className="card">
        <SectionHeader title="OpenAI Integration" subtitle="AI-powered analysis and reviews" />
        
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div>
              <p className="text-sm font-medium text-slate-100">Enable OpenAI Integration</p>
              <p className="mt-1 text-xs text-slate-400">
                Use AI for position reviews and file analysis
              </p>
            </div>
            <button
              onClick={handleToggleOpenAI}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                settings.openai.enabled ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  settings.openai.enabled ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {settings.openai.enabled && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase text-slate-400">Model</p>
              <p className="mt-2 text-sm text-slate-200">{settings.openai.model}</p>
            </div>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs font-medium text-slate-300">API Configuration</p>
            <p className="mt-2 text-xs text-slate-400">
              Configure OpenAI API key in your server environment variables (NOT as VITE_ variable):
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              <li>• <code className="rounded bg-slate-800 px-1 py-0.5">OPENAI_API_KEY</code> (server-side only for security)</li>
            </ul>
            <p className="mt-2 text-xs text-slate-400">
              Get API key at: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">https://platform.openai.com/api-keys</a>
            </p>
            <p className="mt-2 text-xs text-amber-400">
              ⚠️ Make sure the proxy server is running (<code className="rounded bg-slate-800 px-1 py-0.5">npm run server</code>) for AI features to work.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
