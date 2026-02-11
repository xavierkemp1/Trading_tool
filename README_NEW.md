# Trading Tool - Quick Start Guide

## Overview
A manual trading cockpit application that helps traders make disciplined decisions through:
- Manual position tracking with thesis documentation
- Real-time market data from multiple APIs
- Technical indicator calculations (SMA, ATR, RSI)
- Action badge system based on rules engine
- Optional AI-powered portfolio reviews
- Optional Reddit sentiment analysis

## Key Features
✅ **No Automatic Trading** - Manual decisions only  
✅ **Multiple Data Sources** - Cascading API failover (yfinance → Alpha Vantage → Massive API)  
✅ **Browser-Based Database** - SQLite via sql.js, persists in localStorage  
✅ **Risk Management Focus** - Invalidation levels, position sizing, thesis documentation  
✅ **Optional AI Integration** - OpenAI-powered portfolio analysis  
✅ **Optional Sentiment** - Reddit social sentiment tracking  

## Installation

### 1. Clone and Install
```bash
git clone https://github.com/xavierkemp1/Trading_tool.git
cd Trading_tool
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
```

Edit `.env` file:
```bash
# Optional - for backup data sources (yfinance works without keys)
VITE_ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
VITE_MASSIVE_API_KEY=your_massive_key

# Optional - for AI reviews
VITE_OPENAI_API_KEY=your_openai_key
```

**Getting API Keys:**
- [Alpha Vantage](https://www.alphavantage.co/support/#api-key) - Free tier: 25 requests/day
- [Polygon.io](https://polygon.io/) - Free tier: 5 calls/minute (Use this key for Massive API)
- [OpenAI](https://platform.openai.com/api-keys) - Pay per use

### 3. Build and Run
```bash
# Development mode
npm run dev

# Production build
npm run build
npm run preview
```

## Usage Guide

### Adding a Position
1. Go to "Current Investments" page
2. Click "Add Position" button
3. Fill in the form:
   - Symbol (e.g., AAPL)
   - Quantity
   - Average Cost
   - Thesis (why you bought it)
   - Invalidation Price (exit level)
   - Target Price (profit goal)
4. Save - symbol will be validated via API

### Managing Watchlist
1. Go to "Explore / New Ideas" page
2. Use the watchlist manager to add symbols
3. Add notes and thesis tags
4. Data refreshes automatically

### Refreshing Market Data
1. Click "Refresh data" on Dashboard
2. Fetches latest prices for all positions + watchlist + benchmarks
3. Calculates indicators: SMA50, SMA200, ATR14, RSI14
4. Updates action badges: HOLD, WATCH, REDUCE, EXIT
5. Updates market regime summary

### Using AI Reviews (Optional)
1. Enable OpenAI in settings (requires API key)
2. On Dashboard: "Weekly AI review" for full portfolio
3. On Current Investments: "AI review this position" for single position
4. Reviews stored in database for history

### Viewing Reddit Sentiment (Optional)
1. Enable Reddit in settings (no API key needed)
2. Go to "Explore / New Ideas"
3. See "Narrative signals" section
4. Data cached for 6 hours

## Architecture

### Data Flow
```
User Action → UI Component → Database Operations → SQLite (browser)
                    ↓
            Data Service → API Call (with failover)
                    ↓
            Store in Database → Update UI
```

### API Failover Sequence
```
1. Try yfinance (Yahoo Finance) - Free, unlimited
   ↓ (if fails)
2. Try Alpha Vantage - 25 requests/day
   ↓ (if fails)
3. Try Massive API - 5 calls/minute
   ↓ (if fails)
4. Show error, continue with other symbols
```

### Database Schema
- `symbols` - Company metadata
- `positions` - User holdings
- `watchlist` - Tracked symbols
- `prices` - OHLCV historical data
- `fundamentals` - Company metrics
- `ai_reviews` - Stored AI analysis
- `journal_entries` - Trading logs

## Technical Stack
- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS
- **Database**: SQL.js (SQLite for browser)
- **Data Fetching**: Native fetch API
- **State Management**: React Context

## File Structure
```
src/
├── components/        # Reusable UI components
│   ├── PositionForm.tsx
│   ├── WatchlistManager.tsx
│   └── ...
├── pages/            # Main application pages
│   ├── Dashboard.tsx
│   ├── CurrentInvestments.tsx
│   ├── ExploreIdeas.tsx
│   └── ...
├── lib/              # Core business logic
│   ├── database.ts          # SQLite wrapper
│   ├── dbOperations.ts      # CRUD operations
│   ├── dataService.ts       # API integration
│   ├── openaiService.ts     # AI reviews
│   ├── redditService.ts     # Sentiment analysis
│   ├── settingsService.ts   # Configuration
│   ├── indicators.ts        # Technical indicators
│   ├── rules.ts             # Action badge rules
│   └── types.ts             # TypeScript types
└── settings/         # Default configuration
    └── defaultSettings.json
```

## Configuration

### Settings (defaultSettings.json)
```json
{
  "benchmarks": ["SPY", "QQQ", "GLD"],
  "actionBadgeRules": {
    "smaShort": 50,
    "smaLong": 200,
    "atrMultipleForReduce": 2,
    "rsiOverbought": 70
  },
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

Settings can be overridden at runtime via localStorage.

## Known Issues

### SQL.js WASM Loading in Dev Mode
The SQL.js WASM file may have loading issues in Vite dev mode due to browser security policies.

**Workaround**: Use production build for testing:
```bash
npm run build
npm run preview
```

The issue is documented in `IMPLEMENTATION.md` with potential solutions.

## Troubleshooting

### "Database initialization failed"
- Check browser console for specific error
- Try clearing browser cache and localStorage
- Use production build (`npm run build`)
- Ensure `public/sql-wasm.wasm` exists

### "API rate limit exceeded"
- yfinance: No rate limit
- Alpha Vantage: 25/day - wait or use different key
- Massive API: 5/minute - wait a minute
- System automatically fails over to next API

### "Symbol not found"
- Verify ticker symbol is correct
- Try a well-known symbol (e.g., AAPL, MSFT)
- Market may be closed or symbol delisted

## Contributing
This is a personal trading tool. Feel free to fork and customize for your needs.

## License
MIT License - See LICENSE file

## Disclaimer
This tool is for informational and educational purposes only. It does not provide financial advice. Always do your own research and consult with a qualified financial advisor before making investment decisions.

## Support
For issues, questions, or suggestions:
- Review `IMPLEMENTATION.md` for detailed technical documentation
- Check `src/lib/db/README.md` for database usage
- See `INTEGRATIONS.md` for API integration details

## Acknowledgments
- Market data from Yahoo Finance, Alpha Vantage, and Massive API
- Optional AI powered by OpenAI
- Sentiment data from Reddit
- Built with React, Vite, and Tailwind CSS
