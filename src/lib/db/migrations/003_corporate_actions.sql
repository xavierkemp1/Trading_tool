-- Corporate Actions Tracking Migration
-- Adds fields to track stock splits and other corporate actions

-- Add corporate action warning fields to symbols table
ALTER TABLE symbols ADD COLUMN corporate_action_warning TEXT;
ALTER TABLE symbols ADD COLUMN warning_created_at TEXT;

-- Create index for querying symbols with warnings
CREATE INDEX IF NOT EXISTS idx_symbols_warnings ON symbols(corporate_action_warning);
