# Trading Cockpit (Tauri + React)

A minimalist, local-first trading decision cockpit focused on discipline, risk, and journaled learning. No brokerage connectivity and no auto-trading.

## Quick start

### Development Mode

To avoid CORS issues when fetching data from Yahoo Finance, you need to run both the frontend and the backend proxy server.

**Option 1: Run both together (recommended)**
```bash
npm install
npm run dev:all
```

**Option 2: Run separately**

In terminal 1, start the backend proxy server:
```bash
npm run server
```

In terminal 2, start the frontend:
```bash
npm run dev
```

### Production Build

```bash
npm run build
```

## Environment Setup

Copy `.env.example` to `.env` and configure your API keys:

```bash
cp .env.example .env
```

The proxy server URL is configurable via `VITE_PROXY_URL` (defaults to `http://localhost:3001`).

## Features

### Backend Proxy Server
- **Purpose**: Resolves CORS issues when fetching data from Yahoo Finance API
- **Endpoints**:
  - `/api/chart/:symbol` - Proxies Yahoo Finance chart data (OHLCV)
  - `/api/quote/:symbol` - Proxies Yahoo Finance quote data
  - `/health` - Health check endpoint
- **Rate Limiting**: Built-in throttling (500ms minimum between requests) to prevent overwhelming Yahoo Finance
- **Port**: Runs on port 3001 by default (configurable via `PORT` environment variable)

### Industry Allocation Chart
- **Location**: Dashboard page
- **Purpose**: Visualizes portfolio breakdown by industry sector
- **Features**:
  - Interactive pie chart showing percentage allocation
  - Displays dollar value and position count per industry
  - Handles unknown/missing industry data gracefully
  - Updates automatically when portfolio changes

## Local data

- SQLite schema lives in `src/lib/db/migrations/001_init.sql`.
- Configure defaults in `src/settings/defaultSettings.json`.
- The app is designed to store data locally on disk; wire the SQLite adapter into Tauri for production.

## Refreshing data

- Use the **Refresh data** action on the Dashboard.
- Pipeline expectation:
  - Pull watchlist + positions + benchmarks.
  - Store OHLCV daily bars, refresh fundamentals weekly.
  - Compute SMA50/200, ATR14, RSI14, 1D/1W/1M returns, 52w distance, volume vs 20D average.

## Adding tickers

1. Add to watchlist with a thesis tag and time horizon.
2. Run a refresh to populate prices + fundamentals.

## Optional AI review

- Enable OpenAI in settings.
- The AI receives a snapshot JSON (no browsing), and outputs structured critiques only.
- Prompt templates live in `src/lib/aiPrompts.ts`.

## Files of interest

- UI pages live in `src/pages`.
- Rules engine in `src/lib/rules.ts`.
- SQLite schema in `src/lib/db/migrations/001_init.sql`.
- Backend proxy server in `server/index.js`.

