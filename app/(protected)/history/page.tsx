import { requireAuth } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import HistoryClient from '@/components/history/HistoryClient';

export default async function HistoryPage() {
  await requireAuth();

  const supabase = createServerClient();

  const [{ data: logs }, { data: categories }, { data: periods }] = await Promise.all([
    supabase
      .from('expense_logs')
      .select('id, actual_amount, notes, logged_at, expense_id, period_id, expenses(name, dedicated_amount, categories(id, name, color)), monthly_periods(period)')
      .order('logged_at', { ascending: false })
      .limit(600),
    supabase
      .from('categories')
      .select('id, name, color')
      .eq('type', 'monthly')
      .order('sort_order'),
    supabase
      .from('monthly_periods')
      .select('id, period')
      .order('period', { ascending: false })
      .limit(36),
  ]);

  type HistoryLog = Parameters<typeof HistoryClient>[0]['logs'][number];

  return (
    <HistoryClient
      logs={(logs ?? []) as unknown as HistoryLog[]}
      categories={categories ?? []}
      periods={periods ?? []}
    />
  );
}
