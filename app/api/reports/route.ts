import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const periodId = req.nextUrl.searchParams.get('periodId');
  const idParsed = z.string().uuid().safeParse(periodId);
  if (!idParsed.success) {
    return NextResponse.json({ error: 'Invalid period ID' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: period } = await supabase
    .from('monthly_periods')
    .select('id, period, total_received, is_locked')
    .eq('id', idParsed.data)
    .single();

  if (!period) {
    return NextResponse.json({ error: 'Period not found' }, { status: 404 });
  }

  const { data: logs } = await supabase
    .from('expense_logs')
    .select('actual_amount, notes, expenses(name, dedicated_amount, categories(name))')
    .eq('period_id', idParsed.data);

  const rows = (logs ?? []).map((log) => {
    const expenseRaw = log.expenses as unknown;
    const expense = expenseRaw as { name: string; dedicated_amount: number | null; categories: { name: string } | null } | null;
    const dedicated = expense?.dedicated_amount ?? null;
    const actual = log.actual_amount;
    const delta = dedicated != null && actual != null ? dedicated - actual : null;
    return {
      category: expense?.categories?.name ?? 'Uncategorized',
      expense: expense?.name ?? 'Unknown',
      dedicated,
      actual,
      delta,
    };
  });

  return NextResponse.json({ period, rows });
}
