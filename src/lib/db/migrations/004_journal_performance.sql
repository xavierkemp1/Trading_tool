-- Journal Performance Tracking Migration
-- Adds fields to track trading performance metrics

-- Add performance tracking fields to journal_entries table
ALTER TABLE journal_entries ADD COLUMN planned_risk_per_share REAL;
ALTER TABLE journal_entries ADD COLUMN planned_risk_dollars REAL;
ALTER TABLE journal_entries ADD COLUMN r_multiple REAL;
ALTER TABLE journal_entries ADD COLUMN mfe_r REAL;
ALTER TABLE journal_entries ADD COLUMN mae_r REAL;
ALTER TABLE journal_entries ADD COLUMN holding_days INTEGER;
ALTER TABLE journal_entries ADD COLUMN setup_tag TEXT;
ALTER TABLE journal_entries ADD COLUMN thesis_tag TEXT;

-- Create index for querying by setup_tag and thesis_tag
CREATE INDEX IF NOT EXISTS idx_journal_setup_tag ON journal_entries(setup_tag);
CREATE INDEX IF NOT EXISTS idx_journal_thesis_tag ON journal_entries(thesis_tag);
