import { requireAuth } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import { format, parse, subMonths } from 'date-fns';
import LedgerClient from '@/components/ledger/LedgerClient';

interface LedgerPageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function LedgerPage({ searchParams }: LedgerPageProps) {
  await requireAuth();

  const params = await searchParams;
  const currentPeriod = format(new Date(), 'yyyy-MM');
  const requested = params.month ?? currentPeriod;
  const period = requested > currentPeriod ? currentPeriod : requested;
  const periodMonth = parseInt(period.split('-')[1]);
  const periodYear = parseInt(period.split('-')[0]);

  const supabase = createServerClient();

  const { data: periodRow } = await supabase
    .from('monthly_periods')
    .select('*')
    .eq('period', period)
    .single();

  const prevPeriodStr = format(subMonths(parse(period, 'yyyy-MM', new Date()), 1), 'yyyy-MM');
  const { data: prevPeriod } = await supabase
    .from('monthly_periods')
    .select('id')
    .eq('period', prevPeriodStr)
    .single();

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, color, icon, type, sort_order, expenses(id, name, dedicated_amount, billing_day, sort_order, is_active)')
    .eq('type', 'monthly')
    .order('sort_order');

  const monthlyCategories = (categories ?? []).map((c) => ({
    ...c,
    expenses: (c.expenses ?? []).filter((e: { is_active?: boolean }) => e.is_active !== false),
  }));

  const expenseLogs: Record<string, { actual_amount: number | null; notes: string | null }> = {};
  if (periodRow) {
    const { data: logs } = await supabase
      .from('expense_logs')
      .select('expense_id, actual_amount, notes')
      .eq('period_id', periodRow.id);
    for (const log of logs ?? []) {
      expenseLogs[log.expense_id] = { actual_amount: log.actual_amount, notes: log.notes };
    }
  }

  const { data: annualCats } = await supabase
    .from('categories')
    .select('id, name, color, expenses(id, name, dedicated_amount, billing_month)')
    .eq('type', 'annual');

  type RawAnnualExp = { id: string; name: string; dedicated_amount: number | null; billing_month: number | null };
  const annualExpenses = (annualCats ?? []).flatMap((c) =>
    (c.expenses as RawAnnualExp[] ?? [])
      .filter((e) => e.billing_month === periodMonth)
      .map((e) => ({ ...e, categoryName: c.name as string, categoryColor: c.color as string })),
  );

  const annualLogs: Record<string, { actual_amount: number | null }> = {};
  if (annualExpenses.length > 0) {
    const { data: ap } = await supabase
      .from('annual_periods')
      .select('id')
      .eq('year', periodYear)
      .single();
    if (ap) {
      const { data: al } = await supabase
        .from('annual_expense_logs')
        .select('expense_id, actual_amount')
        .eq('annual_period_id', ap.id);
      for (const l of al ?? []) {
        annualLogs[l.expense_id] = { actual_amount: l.actual_amount };
      }
    }
  }

  // Income entries for this period
  type IncomeEntry = { id: string; source: string; amount: number; notes: string | null; created_at: string };
  let incomeEntries: IncomeEntry[] = [];
  if (periodRow) {
    const { data: entries } = await supabase
      .from('income_entries')
      .select('id, source, amount, notes, created_at')
      .eq('period_id', periodRow.id)
      .order('created_at');
    incomeEntries = (entries ?? []) as IncomeEntry[];
  }

  return (
    <LedgerClient
      period={period}
      currentPeriod={currentPeriod}
      periodRow={periodRow ?? null}
      categories={monthlyCategories}
      annualExpenses={annualExpenses}
      annualLogs={annualLogs}
      expenseLogs={expenseLogs}
      previousPeriodId={prevPeriod?.id ?? null}
      incomeEntries={incomeEntries}
    />
  );
}
