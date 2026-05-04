import { requireAuth } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import { format, subMonths, getDaysInMonth } from 'date-fns';
import DashboardClient from '@/components/dashboard/DashboardClient';

export default async function DashboardPage() {
  await requireAuth();

  const supabase = createServerClient();
  const now = new Date();
  const currentPeriod = format(now, 'yyyy-MM');
  const currentYear = now.getFullYear();
  const todayDay = now.getDate();
  const daysLeft = getDaysInMonth(now) - todayDay;

  // Current month period
  const { data: currentMonthPeriod } = await supabase
    .from('monthly_periods')
    .select('*')
    .eq('period', currentPeriod)
    .single();

  // Current month expense logs
  let currentMonthLogs: Array<{
    id: string;
    expense_id: string;
    actual_amount: number | null;
    notes: string | null;
    logged_at: string;
    expenses: {
      id: string;
      name: string;
      dedicated_amount: number | null;
      categories: { id: string; name: string; color: string } | null;
    } | null;
  }> = [];

  if (currentMonthPeriod) {
    const { data } = await supabase
      .from('expense_logs')
      .select('*, expenses(*, categories(id, name, color))')
      .eq('period_id', currentMonthPeriod.id)
      .order('logged_at', { ascending: false });
    currentMonthLogs = data ?? [];
  }

  // Previous month — for MoM trend badges
  const prevPeriodStr = format(subMonths(now, 1), 'yyyy-MM');
  const { data: prevMonthPeriod } = await supabase
    .from('monthly_periods')
    .select('*, expense_logs(actual_amount)')
    .eq('period', prevPeriodStr)
    .single();

  // All periods for YTD / overall / charts
  const { data: allPeriods } = await supabase
    .from('monthly_periods')
    .select('*')
    .order('period', { ascending: true });

  // Last 12 months for chart
  const last12Start = format(subMonths(now, 11), 'yyyy-MM');
  const { data: recentPeriods } = await supabase
    .from('monthly_periods')
    .select('*, expense_logs(actual_amount)')
    .gte('period', last12Start)
    .order('period', { ascending: true });

  // Recent activity
  const { data: recentActivity } = await supabase
    .from('expense_logs')
    .select('*, expenses(name, dedicated_amount, categories(name, color)), monthly_periods(period)')
    .order('logged_at', { ascending: false })
    .limit(10);

  // Upcoming billing alerts
  const { data: billingRaw } = await supabase
    .from('expenses')
    .select('id, name, dedicated_amount, billing_day, categories(name, color, type)')
    .not('billing_day', 'is', null)
    .eq('is_active', true);

  type RawCategory = { type: string; name: string; color: string };
  type UpcomingBill = {
    id: string; name: string; billing_day: number;
    dedicated_amount: number | null; categoryName: string; categoryColor: string; daysUntil: number;
  };

  const upcomingBills: UpcomingBill[] = (billingRaw ?? [])
    .filter((e) => {
      const cat = (e.categories as unknown as RawCategory | RawCategory[] | null);
      const catObj = Array.isArray(cat) ? cat[0] : cat;
      if (catObj?.type !== 'monthly') return false;
      const d = (e.billing_day as number) - todayDay;
      return d >= 0 && d <= 7;
    })
    .map((e) => {
      const cat = (e.categories as unknown as RawCategory | RawCategory[] | null);
      const catObj = Array.isArray(cat) ? cat[0] : cat;
      return {
        id: e.id, name: e.name,
        billing_day: e.billing_day as number,
        dedicated_amount: e.dedicated_amount as number | null,
        categoryName: catObj?.name ?? '',
        categoryColor: catObj?.color ?? '#6366f1',
        daysUntil: (e.billing_day as number) - todayDay,
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  // Category budgets
  const { data: monthlyCategories } = await supabase
    .from('categories')
    .select('id, name, color, sort_order, expenses(dedicated_amount, is_active)')
    .eq('type', 'monthly')
    .order('sort_order');

  type CatWithExpenses = {
    id: string; name: string; color: string;
    expenses: { dedicated_amount: number | null; is_active: boolean | null }[];
  };

  const categoryBudgets = ((monthlyCategories ?? []) as unknown as CatWithExpenses[]).map((c) => ({
    id: c.id, name: c.name, color: c.color,
    budget: (c.expenses ?? [])
      .filter((e) => e.is_active !== false)
      .reduce((s, e) => s + (e.dedicated_amount ?? 0), 0),
  }));

  // Savings target
  const { data: profile } = await supabase
    .from('user_profile')
    .select('monthly_savings_target')
    .limit(1)
    .single();
  const savingsTarget = (profile?.monthly_savings_target as number | null) ?? null;

  // 3-month spending averages per category for anomaly detection
  const prev3Start = format(subMonths(now, 3), 'yyyy-MM');
  const { data: prev3Periods } = await supabase
    .from('monthly_periods')
    .select('id')
    .gte('period', prev3Start)
    .lt('period', currentPeriod);

  const categoryAverages: Record<string, number> = {};
  const numPrev = prev3Periods?.length ?? 0;
  if (numPrev > 0) {
    const { data: prev3Logs } = await supabase
      .from('expense_logs')
      .select('actual_amount, expenses(categories(id))')
      .in('period_id', prev3Periods!.map((p) => p.id));
    const catTotals: Record<string, number> = {};
    for (const log of prev3Logs ?? []) {
      const catId = (log.expenses as unknown as { categories: { id: string } | null } | null)?.categories?.id;
      if (catId) catTotals[catId] = (catTotals[catId] ?? 0) + (log.actual_amount ?? 0);
    }
    for (const [catId, total] of Object.entries(catTotals)) {
      categoryAverages[catId] = total / numPrev;
    }
  }

  // Derive prevMonthSummary for MoM badges
  const prevMonthSpent = prevMonthPeriod
    ? (prevMonthPeriod.expense_logs ?? []).reduce((s: number, l: { actual_amount: number | null }) => s + (l.actual_amount ?? 0), 0)
    : null;
  const prevMonthSaved = prevMonthPeriod && prevMonthSpent !== null
    ? prevMonthPeriod.total_received - prevMonthSpent
    : null;

  return (
    <DashboardClient
      currentPeriod={currentPeriod}
      currentMonthPeriod={currentMonthPeriod ?? null}
      currentMonthLogs={currentMonthLogs}
      allPeriods={allPeriods ?? []}
      recentPeriods={recentPeriods ?? []}
      recentActivity={recentActivity ?? []}
      upcomingBills={upcomingBills}
      savingsTarget={savingsTarget}
      categoryBudgets={categoryBudgets}
      categoryAverages={categoryAverages}
      prevMonthReceived={prevMonthPeriod?.total_received ?? null}
      prevMonthSpent={prevMonthSpent}
      prevMonthSaved={prevMonthSaved}
      daysLeft={daysLeft}
    />
  );
}
