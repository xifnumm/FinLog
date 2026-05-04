'use client';

import { useState, useMemo } from 'react';
import { format, parse } from 'date-fns';
import { Search, X, FileText } from 'lucide-react';
import { formatMVR } from '@/lib/currency';
import DeltaBadge from '@/components/shared/DeltaBadge';
import PageHeader from '@/components/shared/PageHeader';

interface Log {
  id: string;
  expense_id: string;
  period_id: string;
  actual_amount: number | null;
  notes: string | null;
  logged_at: string;
  expenses: { name: string; dedicated_amount: number | null; categories: { id: string; name: string; color: string } | null } | null;
  monthly_periods: { period: string } | null;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Period {
  id: string;
  period: string;
}

const PAGE_SIZE = 50;

export default function HistoryClient({
  logs,
  categories,
  periods,
}: {
  logs: Log[];
  categories: Category[];
  periods: Period[];
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return logs.filter((l) => {
      if (q && !l.expenses?.name.toLowerCase().includes(q)) return false;
      if (categoryFilter && l.expenses?.categories?.id !== categoryFilter) return false;
      if (periodFilter && l.monthly_periods?.period !== periodFilter) return false;
      return true;
    });
  }, [logs, search, categoryFilter, periodFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function reset() {
    setSearch('');
    setCategoryFilter('');
    setPeriodFilter('');
    setPage(0);
  }

  const hasFilter = !!search || !!categoryFilter || !!periodFilter;

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto animate-fade-in">
      <PageHeader
        title="History"
        subtitle={`${logs.length} total entries`}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#4e4e6e' }} />
          <input
            type="text"
            placeholder="Search expense…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-8 pr-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 transition-colors"
            style={{
              backgroundColor: '#0a0a18',
              borderColor: '#22223a',
              color: '#ededf8',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#22223a')}
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors"
          style={{ backgroundColor: '#0a0a18', borderColor: '#22223a', color: categoryFilter ? '#ededf8' : '#4e4e6e' }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={periodFilter}
          onChange={(e) => { setPeriodFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors"
          style={{ backgroundColor: '#0a0a18', borderColor: '#22223a', color: periodFilter ? '#ededf8' : '#4e4e6e' }}
        >
          <option value="">All periods</option>
          {periods.map((p) => (
            <option key={p.id} value={p.period}>
              {format(parse(p.period, 'yyyy-MM', new Date()), 'MMM yyyy')}
            </option>
          ))}
        </select>

        {hasFilter && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ color: '#8080a8' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ededf8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#8080a8'; }}
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: '#121228', borderColor: '#22223a' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #22223a' }}>
                {['Period', 'Expense', 'Category', 'Budget', 'Actual', 'Delta', 'Notes'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2.5 text-xs font-medium"
                    style={{ color: '#4e4e6e' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: '#4e4e6e' }}>
                    {hasFilter ? 'No entries match your filters.' : 'No expense history yet.'}
                  </td>
                </tr>
              )}
              {visible.map((log) => {
                const delta =
                  log.expenses?.dedicated_amount != null && log.actual_amount != null
                    ? log.expenses.dedicated_amount - log.actual_amount
                    : null;
                return (
                  <tr
                    key={log.id}
                    style={{ borderBottom: '1px solid rgba(34,34,58,0.5)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(12,12,27,0.5)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                  >
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: '#4e4e6e', whiteSpace: 'nowrap' }}>
                      {log.monthly_periods?.period
                        ? format(parse(log.monthly_periods.period, 'yyyy-MM', new Date()), 'MMM yyyy')
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: '#ededf8' }}>
                      {log.expenses?.name ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {log.expenses?.categories ? (
                        <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: log.expenses.categories.color }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: log.expenses.categories.color }} />
                          {log.expenses.categories.name}
                        </span>
                      ) : <span style={{ color: '#4e4e6e' }}>—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: '#4e4e6e' }}>
                      {log.expenses?.dedicated_amount != null ? formatMVR(log.expenses.dedicated_amount) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: '#34d399' }}>
                      {log.actual_amount != null ? formatMVR(log.actual_amount) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <DeltaBadge delta={delta} />
                    </td>
                    <td className="px-4 py-2.5 max-w-[180px]">
                      {log.notes ? (
                        <span className="text-xs truncate block" style={{ color: '#8080a8' }} title={log.notes}>
                          {log.notes}
                        </span>
                      ) : (
                        <span style={{ color: '#22223a' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-3 text-xs"
            style={{ borderTop: '1px solid #22223a', color: '#4e4e6e' }}
          >
            <span>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const pg = totalPages <= 7 ? i : i; // simplified for now
                return (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className="w-7 h-7 rounded flex items-center justify-center text-xs transition-colors"
                    style={{
                      backgroundColor: page === i ? '#6366f1' : 'transparent',
                      color: page === i ? 'white' : '#8080a8',
                    }}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {filtered.length === 0 && !hasFilter && (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#121228' }}>
            <FileText size={20} style={{ color: '#4e4e6e' }} />
          </div>
          <p className="text-sm" style={{ color: '#4e4e6e' }}>No expense history yet. Start logging in the Ledger.</p>
        </div>
      )}
    </div>
  );
}
