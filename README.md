# Trading Cockpit (Tauri + React)

A minimalist, local-first trading decision cockpit focused on discipline, risk, and journaled learning. No brokerage connectivity and no auto-trading.

## Quick start

```bash
npm install
npm run dev
```

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
