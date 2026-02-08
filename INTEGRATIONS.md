# OpenAI and Reddit Integrations

This document describes the optional AI and sentiment analysis features.

## Features

### 1. OpenAI AI Reviews

**Location:** Dashboard, Current Investments, Explore Ideas pages

**Functions:**
- **Portfolio Review**: Analyzes your entire portfolio for concentration risks, regime fit, and action priorities
- **Position Review**: Deep dive into a specific position with thesis critique, risk assessment, and scenario planning

**Requirements:**
- Set environment variable: `VITE_OPENAI_API_KEY`
- Enable in settings: `openai.enabled = true`

**How to use:**
1. Enable OpenAI in settings or localStorage
2. Set your API key in `.env` file
3. Click "Weekly AI review" on Dashboard for portfolio analysis
4. Click "AI review this position" on Current Investments for position analysis
5. Click "AI idea review" on Explore Ideas for watchlist analysis

**Data Storage:**
All AI reviews are stored in the `ai_reviews` table for future reference.

### 2. Reddit Sentiment Analysis

**Location:** Explore Ideas page

**Features:**
- Tracks mentions from r/wallstreetbets, r/stocks, r/options
- Sentiment analysis (Positive/Negative/Mixed/Neutral)
- Theme extraction (e.g., "Earnings", "Short squeeze", "Technical")
- 6-hour caching to respect Reddit API limits

**Requirements:**
- Enable in settings: `reddit.enabled = true`
- No API key required (uses public Reddit JSON API)

**How to use:**
1. Enable Reddit in settings or localStorage
2. Visit Explore Ideas page
3. Sentiment data loads automatically
4. Click "Refresh" to update manually
5. Click on any sentiment card to review that symbol

**Caching:**
Results are cached in localStorage for 6 hours to minimize API calls.

## Configuration

### Settings (defaultSettings.json)

```json
{
  "openai": {
    "enabled": false,
    "model": "gpt-4o-mini"
  },
  "reddit": {
    "enabled": false,
    "sources": ["wallstreetbets", "stocks", "options"],
    "cacheHours": 6
  }
}
```

### Runtime Override

Settings can be overridden at runtime using localStorage:

```javascript
// Enable OpenAI
localStorage.setItem('trading_app_settings', JSON.stringify({
  openai: { enabled: true, model: 'gpt-4o-mini' }
}));

// Enable Reddit
localStorage.setItem('trading_app_settings', JSON.stringify({
  reddit: { enabled: true }
}));
```

## Security Notes

⚠️ **Important:** This is a client-side application. API keys are exposed in the browser.

For production use:
1. Implement a backend proxy for OpenAI API calls
2. Store API keys securely on the server
3. Add rate limiting and usage tracking
4. Implement proper authentication

## Error Handling

All integrations gracefully handle:
- Feature disabled (shows message to enable in settings)
- Missing API key (shows configuration instructions)
- Network failures (shows error with retry option)
- Rate limits (uses caching and delays)

## API Usage

### OpenAI
- Model: gpt-4o-mini (configurable)
- Max tokens: 1500 (position), 2000 (portfolio)
- Temperature: 0.7

### Reddit
- No authentication required
- Rate limit: 1 request per second per subreddit
- Limit: 100 posts per subreddit
- Timeframe: Last week

## Testing

To test the integrations:

1. **OpenAI Testing:**
   ```bash
   # Set API key
   echo "VITE_OPENAI_API_KEY=sk-..." > .env
   
   # Enable in browser console
   localStorage.setItem('trading_app_settings', JSON.stringify({
     openai: { enabled: true }
   }));
   ```

2. **Reddit Testing:**
   ```bash
   # Enable in browser console
   localStorage.setItem('trading_app_settings', JSON.stringify({
     reddit: { enabled: true }
   }));
   ```

## Troubleshooting

**OpenAI not working:**
- Check API key is set in `.env`
- Verify `openai.enabled = true` in settings
- Check browser console for errors
- Verify API key has credits

**Reddit not loading:**
- Verify `reddit.enabled = true` in settings
- Check browser console for CORS errors
- Clear localStorage cache if stale
- Check Reddit API status

**No data showing:**
- Ensure you have positions/watchlist items
- Check network tab for failed API calls
- Verify feature flags are enabled
- Check browser console for errors
