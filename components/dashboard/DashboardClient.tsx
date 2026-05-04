'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { format, parse } from 'date-fns';
import { AlertCircle, Bell } from 'lucide-react';
import { formatMVR } from '@/lib/currency';
import { computePeriodSummary } from '@/lib/calculations';
import DeltaBadge from '@/components/shared/DeltaBadge';

const RechartsComponents = dynamic(() => import('./Charts'), { ssr: false });

type ViewMode = 'month' | 'year' | 'overall';

interface Period {
  id: string;
  period: string;
  total_received: number;
  is_locked: boolean;
  expense_logs?: { actual_amount: number | null }[];
}

interface ExpenseLog {
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
}

interface RecentActivity {
  id: string;
  actual_amount: number | null;
  logged_at: string;
  expenses: { name: string; dedicated_amount: number | null; categories: { name: string; color: string } | null } | null;
  monthly_periods: { period: string } | null;
}

interface UpcomingBill {
  id: string;
  name: string;
  billing_day: number;
  dedicated_amount: number | null;
  categoryName: string;
  categoryColor: string;
  daysUntil: number;
}

interface CategoryBudget {
  id: string;
  name: string;
  color: string;
  budget: number;
}

interface Props {
  currentPeriod: string;
  currentMonthPeriod: Period | null;
  currentMonthLogs: ExpenseLog[];
  allPeriods: Period[];
  recentPeriods: Period[];
  recentActivity: RecentActivity[];
  upcomingBills: UpcomingBill[];
  savingsTarget: number | null;
  categoryBudgets: CategoryBudget[];
  categoryAverages: Record<string, number>;
  prevMonthReceived: number | null;
  prevMonthSpent: number | null;
  prevMonthSaved: number | null;
  daysLeft: number;
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#4e4e6e' }}>
      {children}
    </p>
  );
}

function TrendBadge({
  current,
  previous,
  inverse = false,
}: {
  current: number;
  previous: number | null;
  inverse?: boolean;
}) {
  if (previous === null || previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 0.5) return null;
  const positive = inverse ? pct <= 0 : pct >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums"
      style={{
        backgroundColor: positive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
        color: positive ? '#22c55e' : '#ef4444',
      }}
    >
      {pct >= 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function KPICard({
  label,
  value,
  sub,
  trend,
  accent,
  dim = false,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: React.ReactNode;
  accent?: string;
  dim?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-3"
      style={{
        backgroundColor: '#121228',
        borderColor: '#22223a',
        borderTop: `2px solid ${accent ?? '#22223a'}`,
      }}
    >
      <div className="flex items-center justify-between">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: '#4e4e6e' }}
        >
          {label}
        </p>
        {trend}
      </div>
      <p
        className="text-2xl font-mono font-semibold tabular-nums leading-none"
        style={{ color: dim ? '#8080a8' : (accent ?? '#ededf8') }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs leading-snug" style={{ color: '#8080a8' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function CategoryCard({ cat, spent }: { cat: CategoryBudget; spent: number }) {
  const hasBudget = cat.budget > 0;
  const pct = hasBudget ? Math.min(120, (spent / cat.budget) * 100) : 0;
  const overBudget = hasBudget && spent > cat.budget;
  const nearBudget = !overBudget && hasBudget && pct >= 80;
  const barColor = overBudget ? '#ef4444' : nearBudget ? '#f59e0b' : cat.color;
  const amountColor = overBudget ? '#ef4444' : nearBudget ? '#f59e0b' : '#ededf8';

  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-2.5"
      style={{
        backgroundColor: '#0d0d1e',
        borderColor: '#22223a',
        borderLeft: `2px solid ${cat.color}`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
        <span className="text-xs font-medium flex-1 truncate" style={{ color: '#ededf8' }}>{cat.name}</span>
        {overBudget && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
            style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
          >
            OVER
          </span>
        )}
        {nearBudget && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
            style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
          >
            {Math.round(pct)}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#22223a' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, pct)}%`, background: barColor }}
        />
      </div>

      {/* Amounts */}
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-sm font-mono font-semibold tabular-nums" style={{ color: amountColor }}>
          {formatMVR(spent)}
        </span>
        <span className="text-[10px] font-mono" style={{ color: '#4e4e6e' }}>
          {hasBudget ? `/ ${formatMVR(cat.budget)}` : 'no budget'}
        </span>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function DashboardClient({
  currentPeriod,
  currentMonthPeriod,
  currentMonthLogs,
  allPeriods,
  recentPeriods,
  recentActivity,
  upcomingBills,
  savingsTarget,
  categoryBudgets,
  categoryAverages,
  prevMonthReceived,
  prevMonthSpent,
  prevMonthSaved,
  daysLeft,
}: Props) {
  const [mode, setMode] = useState<ViewMode>('month');

  const currentYear = parseInt(currentPeriod.split('-')[0]);
  const ytdPeriods = allPeriods.filter((p) => p.period.startsWith(currentYear.toString()));

  // ── Month computations ──────────────────────────────────────────────────────
  const monthExpenses = currentMonthLogs.map((l) => ({
    id: l.expense_id,
    name: l.expenses?.name ?? '',
    dedicated_amount: l.expenses?.dedicated_amount ?? null,
    actual_amount: l.actual_amount,
  }));
  const monthSummary = currentMonthPeriod
    ? computePeriodSummary(currentMonthPeriod.total_received, monthExpenses)
    : null;

  const monthReceived = monthSummary?.totalReceived ?? 0;
  const monthSpent = monthSummary?.totalLogged ?? 0;
  const monthSaved = monthSummary?.totalSaved ?? 0;
  const savingsRate = monthReceived > 0 ? (monthSaved / monthReceived) * 100 : 0;

  const totalBudgeted = categoryBudgets.reduce((s, c) => s + c.budget, 0);
  const safeToSpend = currentMonthPeriod
    ? currentMonthPeriod.total_received - totalBudgeted - (savingsTarget ?? 0)
    : null;

  // Savings target sub-label
  const savedSub =
    savingsTarget !== null
      ? monthSaved >= savingsTarget
        ? `Target met · ${savingsRate.toFixed(1)}% savings rate`
        : `${formatMVR(savingsTarget - monthSaved)} short of ${formatMVR(savingsTarget)} target`
      : savingsRate > 0
      ? `${savingsRate.toFixed(1)}% savings rate`
      : undefined;

  // Category spend map
  const catSpend = currentMonthLogs.reduce<Record<string, number>>((acc, log) => {
    const catId = log.expenses?.categories?.id ?? '';
    if (catId) acc[catId] = (acc[catId] ?? 0) + (log.actual_amount ?? 0);
    return acc;
  }, {});

  const visibleCategoryBudgets = categoryBudgets.filter(
    (c) => c.budget > 0 || (catSpend[c.id] ?? 0) > 0,
  );

  // Spending anomalies
  const anomalies = visibleCategoryBudgets.filter((cat) => {
    const avg = categoryAverages[cat.id];
    const current = catSpend[cat.id] ?? 0;
    return avg != null && avg > 0 && current > avg * 1.5 && current > 100;
  });

  // ── Year computations ───────────────────────────────────────────────────────
  const ytdReceived = ytdPeriods.reduce((s, p) => s + p.total_received, 0);
  const ytdSpent = ytdPeriods.reduce(
    (s, p) => s + (p.expense_logs ?? []).reduce((ss, l) => ss + (l.actual_amount ?? 0), 0),
    0,
  );
  const ytdSaved = ytdReceived - ytdSpent;
  const ytdSavingsRate = ytdReceived > 0 ? (ytdSaved / ytdReceived) * 100 : 0;
  const avgMonthlySavings = ytdPeriods.length > 0 ? ytdSaved / ytdPeriods.length : 0;

  // Best / worst savings month this year
  type MonthStat = { period: string; savings: number };
  const ytdMonthStats: MonthStat[] = ytdPeriods.map((p) => {
    const spent = (p.expense_logs ?? []).reduce((s, l) => s + (l.actual_amount ?? 0), 0);
    return { period: p.period, savings: p.total_received - spent };
  });
  const bestMonth = ytdMonthStats.length > 0
    ? ytdMonthStats.reduce((a, b) => (b.savings > a.savings ? b : a))
    : null;

  // ── Overall computations ────────────────────────────────────────────────────
  const allReceived = allPeriods.reduce((s, p) => s + p.total_received, 0);
  const allSpent = allPeriods.reduce(
    (s, p) => s + (p.expense_logs ?? []).reduce((ss, l) => ss + (l.actual_amount ?? 0), 0),
    0,
  );
  const allSaved = allReceived - allSpent;
  const overallSavingsRate = allReceived > 0 ? (allSaved / allReceived) * 100 : 0;

  // ── Chart data ──────────────────────────────────────────────────────────────
  const monthChartData = Object.entries(
    currentMonthLogs.reduce<Record<string, number>>((acc, log) => {
      const catName = log.expenses?.categories?.name ?? 'Other';
      acc[catName] = (acc[catName] ?? 0) + (log.actual_amount ?? 0);
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));

  const monthBarData = currentMonthLogs
    .filter((l) => l.expenses?.dedicated_amount != null)
    .map((l) => ({
      name: l.expenses!.name,
      dedicated: l.expenses!.dedicated_amount!,
      actual: l.actual_amount ?? 0,
    }));

  const yearLineData = Array.from({ length: 12 }, (_, i) => {
    const mo = String(i + 1).padStart(2, '0');
    const pStr = `${currentYear}-${mo}`;
    const p = allPeriods.find((x) => x.period === pStr);
    const spent = (p?.expense_logs ?? []).reduce((s, l) => s + (l.actual_amount ?? 0), 0);
    return {
      name: format(parse(pStr, 'yyyy-MM', new Date()), 'MMM'),
      received: p?.total_received ?? 0,
      spent,
    };
  });

  const last12BarData = recentPeriods.map((p) => ({
    name: format(parse(p.period, 'yyyy-MM', new Date()), 'MMM yy'),
    spent: (p.expense_logs ?? []).reduce((s, l) => s + (l.actual_amount ?? 0), 0),
  }));

  const cumulativeSavingsData = allPeriods.reduce<{ name: string; savings: number }[]>((acc, p) => {
    const spent = (p.expense_logs ?? []).reduce((s, l) => s + (l.actual_amount ?? 0), 0);
    const prev = acc[acc.length - 1]?.savings ?? 0;
    acc.push({
      name: format(parse(p.period, 'yyyy-MM', new Date()), 'MMM yy'),
      savings: prev + (p.total_received - spent),
    });
    return acc;
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="px-6 py-8 max-w-6xl mx-auto animate-fade-in space-y-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: '#ededf8' }}>Dashboard</h1>
        <div
          className="flex gap-0.5 p-1 rounded-xl border"
          style={{ backgroundColor: '#0d0d1e', borderColor: '#22223a' }}
        >
          {([['month', 'This Month'], ['year', 'This Year'], ['overall', 'Overall']] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
              style={{
                backgroundColor: mode === m ? '#6366f1' : 'transparent',
                color: mode === m ? 'white' : '#8080a8',
              }}
              onMouseEnter={(e) => { if (mode !== m) e.currentTarget.style.color = '#ededf8'; }}
              onMouseLeave={(e) => { if (mode !== m) e.currentTarget.style.color = '#8080a8'; }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════ MONTH MODE ══════════════════ */}
      {mode === 'month' && (
        <>
          {/* ── Primary KPIs ── */}
          <section>
            <SectionLabel>This Month</SectionLabel>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                label="Income"
                value={formatMVR(monthReceived)}
                sub={prevMonthReceived ? `vs ${formatMVR(prevMonthReceived)} last month` : undefined}
                trend={<TrendBadge current={monthReceived} previous={prevMonthReceived} />}
                accent="#6366f1"
              />
              <KPICard
                label="Spent"
                value={formatMVR(monthSpent)}
                sub={monthReceived > 0 ? `${((monthSpent / monthReceived) * 100).toFixed(1)}% of income` : undefined}
                trend={<TrendBadge current={monthSpent} previous={prevMonthSpent} inverse />}
                accent={monthSpent > monthReceived * 0.9 ? '#ef4444' : '#f59e0b'}
              />
              <KPICard
                label="Saved"
                value={formatMVR(monthSaved)}
                sub={savedSub}
                trend={<TrendBadge current={monthSaved} previous={prevMonthSaved} />}
                accent={
                  savingsTarget !== null
                    ? monthSaved >= savingsTarget ? '#22c55e' : '#ef4444'
                    : monthSaved >= 0 ? '#22c55e' : '#ef4444'
                }
              />
              {totalBudgeted > 0 && safeToSpend !== null && (
                <KPICard
                  label="Safe to Spend"
                  value={formatMVR(safeToSpend)}
                  sub={`unallocated · ${daysLeft} days left`}
                  accent={safeToSpend >= 0 ? '#34d399' : '#ef4444'}
                  dim={safeToSpend === 0}
                />
              )}
            </div>
          </section>

          {/* ── Alerts row (anomalies + upcoming bills side-by-side when both present) ── */}
          {(anomalies.length > 0 || upcomingBills.length > 0) && (
            <section>
              <SectionLabel>Alerts</SectionLabel>
              <div className={`grid gap-4 ${anomalies.length > 0 && upcomingBills.length > 0 ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>

                {anomalies.length > 0 && (
                  <div
                    className="rounded-xl border overflow-hidden"
                    style={{ backgroundColor: '#121228', borderColor: '#22223a', borderLeft: '2px solid #ef4444' }}
                  >
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ borderColor: '#22223a' }}>
                      <AlertCircle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                      <p className="text-xs font-semibold" style={{ color: '#ededf8' }}>Spending Anomalies</p>
                      <span className="ml-auto text-[10px]" style={{ color: '#4e4e6e' }}>vs 3-month avg</span>
                    </div>
                    {anomalies.map((cat) => {
                      const avg = categoryAverages[cat.id] ?? 0;
                      const current = catSpend[cat.id] ?? 0;
                      const pctOver = avg > 0 ? Math.round((current / avg - 1) * 100) : 0;
                      return (
                        <div
                          key={cat.id}
                          className="flex items-center gap-3 px-4 py-3"
                          style={{ borderBottom: '1px solid rgba(34,34,58,0.4)' }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                          <span className="text-sm flex-1" style={{ color: '#ededf8' }}>{cat.name}</span>
                          <div className="text-right">
                            <span className="text-xs font-mono font-semibold" style={{ color: '#ef4444' }}>
                              +{pctOver}%
                            </span>
                            <p className="text-[10px] font-mono mt-0.5" style={{ color: '#4e4e6e' }}>
                              {formatMVR(current)} vs avg {formatMVR(avg)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {upcomingBills.length > 0 && (
                  <div
                    className="rounded-xl border overflow-hidden"
                    style={{ backgroundColor: '#121228', borderColor: '#22223a', borderLeft: '2px solid #f59e0b' }}
                  >
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ borderColor: '#22223a' }}>
                      <Bell size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                      <p className="text-xs font-semibold" style={{ color: '#ededf8' }}>Upcoming Bills</p>
                      <span className="ml-auto text-[10px]" style={{ color: '#4e4e6e' }}>next 7 days</span>
                    </div>
                    {upcomingBills.map((bill) => (
                      <div
                        key={bill.id}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{ borderBottom: '1px solid rgba(34,34,58,0.4)' }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: bill.categoryColor }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={{ color: '#ededf8' }}>{bill.name}</p>
                          <p className="text-[10px]" style={{ color: '#4e4e6e' }}>{bill.categoryName}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-mono font-semibold" style={{ color: '#f59e0b' }}>
                            {bill.dedicated_amount != null ? formatMVR(bill.dedicated_amount) : '—'}
                          </p>
                          <p className="text-[10px] mt-0.5" style={{ color: '#4e4e6e' }}>
                            {bill.daysUntil === 0 ? 'Today' : bill.daysUntil === 1 ? 'Tomorrow' : `In ${bill.daysUntil} days`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Category breakdown (card grid) ── */}
          {visibleCategoryBudgets.length > 0 && (
            <section>
              <SectionLabel>Budget by Category</SectionLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {visibleCategoryBudgets.map((cat) => (
                  <CategoryCard key={cat.id} cat={cat} spent={catSpend[cat.id] ?? 0} />
                ))}
              </div>
            </section>
          )}

          {/* ── Charts ── */}
          <section>
            <SectionLabel>Breakdown</SectionLabel>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RechartsComponents
                mode={mode}
                monthChartData={monthChartData}
                monthBarData={monthBarData}
                yearLineData={yearLineData}
                last12BarData={last12BarData}
                cumulativeSavingsData={cumulativeSavingsData}
              />
            </div>
          </section>

          {/* ── Recent Activity ── */}
          <ActivityTable recentActivity={recentActivity} />
        </>
      )}

      {/* ══════════════════ YEAR MODE ══════════════════ */}
      {mode === 'year' && (
        <>
          <section>
            <SectionLabel>Year to Date · {currentYear}</SectionLabel>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard label="YTD Income" value={formatMVR(ytdReceived)} accent="#6366f1" />
              <KPICard
                label="YTD Spent"
                value={formatMVR(ytdSpent)}
                sub={ytdReceived > 0 ? `${((ytdSpent / ytdReceived) * 100).toFixed(1)}% of income` : undefined}
                accent="#f59e0b"
              />
              <KPICard
                label="YTD Saved"
                value={formatMVR(ytdSaved)}
                sub={`${ytdSavingsRate.toFixed(1)}% savings rate`}
                accent={ytdSaved >= 0 ? '#22c55e' : '#ef4444'}
              />
              <KPICard
                label="Avg. Monthly Savings"
                value={formatMVR(avgMonthlySavings)}
                sub={bestMonth
                  ? `Best: ${format(parse(bestMonth.period, 'yyyy-MM', new Date()), 'MMM')} · ${formatMVR(bestMonth.savings)}`
                  : `over ${ytdPeriods.length} months`}
                accent="#818cf8"
              />
            </div>
          </section>

          <section>
            <SectionLabel>Monthly Trend</SectionLabel>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RechartsComponents
                mode={mode}
                monthChartData={monthChartData}
                monthBarData={monthBarData}
                yearLineData={yearLineData}
                last12BarData={last12BarData}
                cumulativeSavingsData={cumulativeSavingsData}
              />
            </div>
          </section>

          <ActivityTable recentActivity={recentActivity} />
        </>
      )}

      {/* ══════════════════ OVERALL MODE ══════════════════ */}
      {mode === 'overall' && (
        <>
          <section>
            <SectionLabel>All Time</SectionLabel>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard label="Total Income" value={formatMVR(allReceived)} accent="#6366f1" />
              <KPICard label="Total Spent" value={formatMVR(allSpent)} accent="#f59e0b" />
              <KPICard
                label="Total Saved"
                value={formatMVR(allSaved)}
                sub={`${overallSavingsRate.toFixed(1)}% lifetime savings rate`}
                accent={allSaved >= 0 ? '#22c55e' : '#ef4444'}
              />
              <KPICard
                label="Months Tracked"
                value={String(allPeriods.length)}
                sub={allPeriods.length > 0
                  ? `since ${format(parse(allPeriods[0].period, 'yyyy-MM', new Date()), 'MMM yyyy')}`
                  : undefined}
                accent="#34d399"
              />
            </div>
          </section>

          <section>
            <SectionLabel>Historical</SectionLabel>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RechartsComponents
                mode={mode}
                monthChartData={monthChartData}
                monthBarData={monthBarData}
                yearLineData={yearLineData}
                last12BarData={last12BarData}
                cumulativeSavingsData={cumulativeSavingsData}
              />
            </div>
          </section>

          <ActivityTable recentActivity={recentActivity} />
        </>
      )}
    </div>
  );
}

// ─── Activity table (shared across modes) ─────────────────────────────────────

function ActivityTable({ recentActivity }: { recentActivity: RecentActivity[] }) {
  return (
    <section>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#4e4e6e' }}>
        Recent Activity
      </p>
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: '#121228', borderColor: '#22223a' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #22223a' }}>
                {['Expense', 'Category', 'Budget', 'Actual', 'Delta', 'Period'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: '#4e4e6e' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentActivity.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: '#4e4e6e' }}>
                    No activity yet
                  </td>
                </tr>
              )}
              {recentActivity.map((a) => {
                const delta =
                  a.expenses?.dedicated_amount != null && a.actual_amount != null
                    ? a.expenses.dedicated_amount - a.actual_amount
                    : null;
                return (
                  <tr
                    key={a.id}
                    style={{ borderBottom: '1px solid rgba(34,34,58,0.4)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(13,13,30,0.6)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                  >
                    <td className="px-4 py-2.5" style={{ color: '#ededf8' }}>{a.expenses?.name ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {a.expenses?.categories ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs"
                          style={{ color: a.expenses.categories.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.expenses.categories.color }} />
                          {a.expenses.categories.name}
                        </span>
                      ) : <span style={{ color: '#4e4e6e' }}>—</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: '#4e4e6e' }}>
                      {a.expenses?.dedicated_amount != null ? formatMVR(a.expenses.dedicated_amount) : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: '#34d399' }}>
                      {a.actual_amount != null ? formatMVR(a.actual_amount) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <DeltaBadge delta={delta} />
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#4e4e6e' }}>
                      {a.monthly_periods?.period ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
