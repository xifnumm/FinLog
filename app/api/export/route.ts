import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  const [categories, expenses, periods, logs, annualPeriods, annualLogs] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('expenses').select('*').order('sort_order'),
    supabase.from('monthly_periods').select('*').order('period'),
    supabase.from('expense_logs').select('*').order('logged_at'),
    supabase.from('annual_periods').select('*').order('year'),
    supabase.from('annual_expense_logs').select('*'),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    categories: categories.data ?? [],
    expenses: expenses.data ?? [],
    monthly_periods: periods.data ?? [],
    expense_logs: logs.data ?? [],
    annual_periods: annualPeriods.data ?? [],
    annual_expense_logs: annualLogs.data ?? [],
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="finlog-export-${new Date().toISOString().split('T')[0]}.json"`,
    },
  });
}
