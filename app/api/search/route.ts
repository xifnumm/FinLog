import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import { format, parse } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!q) return NextResponse.json({ expenses: [], categories: [], periods: [] });

  const supabase = createServerClient();
  const pattern = `%${q}%`;

  const [expenses, categories, periods] = await Promise.all([
    supabase
      .from('expenses')
      .select('id, name, categories(name, color, type)')
      .ilike('name', pattern)
      .eq('is_active', true)
      .limit(6),
    supabase
      .from('categories')
      .select('id, name, color, type')
      .ilike('name', pattern)
      .limit(5),
    supabase
      .from('monthly_periods')
      .select('id, period, total_received')
      .ilike('period', pattern)
      .order('period', { ascending: false })
      .limit(5),
  ]);

  return NextResponse.json({
    expenses: expenses.data ?? [],
    categories: categories.data ?? [],
    periods: (periods.data ?? []).map((p) => ({
      ...p,
      label: format(parse(p.period, 'yyyy-MM', new Date()), 'MMMM yyyy'),
    })),
  });
}
