-- Finlog database schema
-- Run this in Supabase SQL Editor (project: zzrdtnbndnwybywxuujt)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  type TEXT NOT NULL CHECK (type IN ('monthly', 'annual')),
  color TEXT NOT NULL DEFAULT '#6366f1' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  icon TEXT DEFAULT 'folder' CHECK (char_length(icon) <= 50),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  dedicated_amount NUMERIC(12, 2) CHECK (dedicated_amount IS NULL OR dedicated_amount >= 0),
  billing_month INTEGER CHECK (billing_month IS NULL OR billing_month BETWEEN 1 AND 12),
  billing_day INTEGER CHECK (billing_day IS NULL OR billing_day BETWEEN 1 AND 31),
  notes TEXT CHECK (char_length(notes) <= 1000),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE monthly_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL UNIQUE CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  total_received NUMERIC(12, 2) NOT NULL CHECK (total_received >= 0),
  notes TEXT CHECK (char_length(notes) <= 1000),
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE expense_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES monthly_periods(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  actual_amount NUMERIC(12, 2) CHECK (actual_amount IS NULL OR actual_amount >= 0),
  notes TEXT CHECK (char_length(notes) <= 500),
  logged_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(period_id, expense_id)
);

CREATE TABLE annual_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL UNIQUE CHECK (year BETWEEN 2020 AND 2100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE annual_expense_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annual_period_id UUID NOT NULL REFERENCES annual_periods(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  actual_amount NUMERIC(12, 2) CHECK (actual_amount IS NULL OR actual_amount >= 0),
  notes TEXT CHECK (char_length(notes) <= 500),
  paid_at DATE,
  UNIQUE(annual_period_id, expense_id)
);

CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rates JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE annual_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE annual_expense_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

INSERT INTO categories (name, type, color, icon, sort_order) VALUES
('House Expenses', 'monthly', '#3b82f6', 'home', 0),
('Personal (Fixed)', 'monthly', '#8b5cf6', 'lock', 1),
('Personal (Non-Fixed)', 'monthly', '#06b6d4', 'zap', 2),
('Family Contributions', 'monthly', '#f59e0b', 'heart', 3);
