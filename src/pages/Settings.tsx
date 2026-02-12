import { useState, useEffect } from 'react';
import SectionHeader from '../components/SectionHeader';
import { getSettings, updateSettings } from '../lib/settingsService';
import type { Settings as SettingsType } from '../lib/settingsService';

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType>(getSettings());
  const [newTwitterAccount, setNewTwitterAccount] = useState('');
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
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase text-slate-400">Monitored Subreddits</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {settings.reddit.sources.map((subreddit) => (
                  <span
                    key={subreddit}
                    className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300"
                  >
                    r/{subreddit}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Cache duration: {settings.reddit.cacheHours} hours
              </p>
            </div>
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
              Configure OpenAI API key in your <code className="rounded bg-slate-800 px-1 py-0.5">.env</code> file:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              <li>• VITE_OPENAI_API_KEY</li>
            </ul>
            <p className="mt-2 text-xs text-slate-400">
              Get API key at: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">https://platform.openai.com/api-keys</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
