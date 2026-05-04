'use client';

import { useState, useTransition } from 'react';
import { FileText, Download } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { formatMVR } from '@/lib/currency';
import { format, parse } from 'date-fns';
import dynamic from 'next/dynamic';

const PDFExport = dynamic(() => import('./PDFExport'), { ssr: false });

interface Period {
  id: string;
  period: string;
  total_received: number;
  is_locked: boolean;
}

interface ReportRow {
  category: string;
  expense: string;
  dedicated: number | null;
  actual: number | null;
  delta: number | null;
}

async function fetchReportData(periodId: string): Promise<{ period: Period; rows: ReportRow[] } | null> {
  const res = await fetch(`/api/reports?periodId=${periodId}`);
  if (!res.ok) return null;
  return res.json();
}

export default function ReportsClient({ periods }: { periods: Period[] }) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(periods[0]?.id ?? '');
  const [reportData, setReportData] = useState<{ period: Period; rows: ReportRow[] } | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);

  function handlePreview() {
    startTransition(async () => {
      const data = await fetchReportData(selectedPeriodId);
      setReportData(data);
    });
  }

  function exportCSV() {
    if (!reportData) return;
    const rows = [
      ['Category', 'Expense', 'Budget (MVR)', 'Actual (MVR)', 'Delta (MVR)'],
      ...reportData.rows.map((r) => [
        r.category,
        r.expense,
        r.dedicated?.toFixed(2) ?? '',
        r.actual?.toFixed(2) ?? '',
        r.delta?.toFixed(2) ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finlog-${reportData.period.period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-end gap-4">
        <div className="flex-1 max-w-xs">
          <label className="block text-xs text-[--color-text-secondary] mb-1.5">Period</label>
          <select
            value={selectedPeriodId}
            onChange={(e) => { setSelectedPeriodId(e.target.value); setReportData(null); }}
            className="w-full px-3 py-2 rounded-lg bg-[--color-bg-elevated] border border-[--color-bg-border] text-sm text-[--color-text-primary] focus:outline-none focus:ring-2 focus:ring-[--color-accent]"
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {format(parse(p.period, 'yyyy-MM', new Date()), 'MMMM yyyy')}
                {p.is_locked ? ' (Locked)' : ''}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handlePreview}
          disabled={!selectedPeriodId || isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[--color-accent] hover:bg-[--color-accent-hover] text-white text-sm font-medium transition-colors disabled:opacity-60"
        >
          <FileText size={15} />
          {isPending ? 'Loading…' : 'Preview'}
        </button>
      </div>

      {/* Preview table */}
      {reportData && (
        <div className="bg-[--color-bg-elevated] border border-[--color-bg-border] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[--color-bg-border]">
            <div>
              <h2 className="text-sm font-medium text-[--color-text-primary]">
                {format(parse(reportData.period.period, 'yyyy-MM', new Date()), 'MMMM yyyy')}
              </h2>
              <p className="text-xs text-[--color-text-muted] mt-0.5">
                Income: {formatMVR(reportData.period.total_received)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[--color-bg-border] text-xs text-[--color-text-secondary] hover:text-[--color-text-primary] transition-colors"
              >
                <Download size={13} />
                CSV
              </button>
              <PDFExport period={reportData.period} rows={reportData.rows} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--color-bg-border]">
                  {['Category', 'Expense', 'Budget', 'Actual', 'Delta'].map((h) => (
                    <th key={h} className="text-left px-4 py-2 text-xs text-[--color-text-muted] font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.rows.map((row, i) => (
                  <tr key={i} className="border-b border-[--color-bg-border]/30 last:border-0">
                    <td className="px-4 py-2.5 text-xs text-[--color-text-secondary]">{row.category}</td>
                    <td className="px-4 py-2.5 text-sm text-[--color-text-primary]">{row.expense}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[--color-text-muted]">
                      {row.dedicated != null ? formatMVR(row.dedicated) : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[--color-mvr]">
                      {row.actual != null ? formatMVR(row.actual) : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {row.delta != null ? (
                        <span className={row.delta >= 0 ? 'text-[--color-success]' : 'text-[--color-danger]'}>
                          {row.delta >= 0 ? '+' : ''}{formatMVR(row.delta)}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {periods.length === 0 && (
        <div className="text-center py-12 text-[--color-text-muted] text-sm">
          No periods found. Start a month in the Ledger to generate reports.
        </div>
      )}
    </div>
  );
}
