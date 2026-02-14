-- Data Quality Tracking Migration
-- Adds fields to track data freshness and quality

-- Add data quality tracking to symbols table
ALTER TABLE symbols ADD COLUMN last_price_update TEXT;
ALTER TABLE symbols ADD COLUMN last_fundamentals_update TEXT;
ALTER TABLE symbols ADD COLUMN data_quality TEXT DEFAULT 'ok';
ALTER TABLE symbols ADD COLUMN last_error TEXT;

-- Create index for quality checks
CREATE INDEX IF NOT EXISTS idx_symbols_quality ON symbols(data_quality);
