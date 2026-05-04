'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Lock, Unlock, Check, Loader2, ChevronDown,
  TrendingUp, TrendingDown, Minus, Pencil, MessageSquare, ClipboardCopy,
  Plus, Trash2, DollarSign,
} from 'lucide-react';
import { format, parse, subMonths, addMonths } from 'date-fns';
import {
  createMonthlyPeriod, updateMonthlyPeriodLock, updateMonthlyPeriod, copyPreviousMonthLogs,
} from '@/app/actions/periods';
import { upsertExpenseLog } from '@/app/actions/expenses';
import { createIncomeEntry, deleteIncomeEntry } from '@/app/actions/income';
import { formatMVR } from '@/lib/currency';
import { computeDelta } from '@/lib/calculations';

interface Expense {
  id: string;
  name: string;
  dedicated_amount: number | null;
  billing_day: number | null;
  sort_order: number;
}

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  expenses: Expense[];
}

interface AnnualExpense {
  id: string;
  name: string;
  dedicated_amount: number | null;
  billing_month: number | null;
  categoryName: string;
  categoryColor: string;
}

interface MonthlyPeriod {
  id: string;
  period: string;
  total_received: number;
  notes: string | null;
  is_locked: boolean;
}

interface IncomeEntry {
  id: string;
  source: string;
  amount: number;
  notes: string | null;
  created_at: string;
}

interface Props {
  period: string;
  currentPeriod: string;
  periodRow: MonthlyPeriod | null;
  categories: Category[];
  annualExpenses: AnnualExpense[];
  annualLogs: Record<string, { actual_amount: number | null }>;
  expenseLogs: Record<string, { actual_amount: number | null; notes: string | null }>;
  previousPeriodId: string | null;
  incomeEntries: IncomeEntry[];
}

type SaveState = 'idle' | 'saving' | 'saved';

const saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const noteTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export default function LedgerClient({
  period, currentPeriod, periodRow, categories, annualExpenses, annualLogs,
  expenseLogs, previousPeriodId, incomeEntries: initialIncomeEntries,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [logValues, setLogValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const [id, log] of Object.entries(expenseLogs)) {
      if (log.actual_amount != null) v[id] = log.actual_amount.toString();
    }
    return v;
  });
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(categories.map((c) => c.id)));

  const [noteValues, setNoteValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const [id, log] of Object.entries(expenseLogs)) {
      if (log.notes) v[id] = log.notes;
    }
    return v;
  });
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const [income, setIncome] = useState('');
  const [incomeNotes, setIncomeNotes] = useState('');
  const [incomeError, setIncomeError] = useState('');

  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeEditValue, setIncomeEditValue] = useState('');
  const [incomeEditError, setIncomeEditError] = useState('');

  const [editingPeriodNotes, setEditingPeriodNotes] = useState(false);
  const [periodNotesValue, setPeriodNotesValue] = useState(periodRow?.notes ?? '');

  const [copying, setCopying] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [copyError, setCopyError] = useState('');

  // Income entries local state
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>(initialIncomeEntries);
  const [showIncomeEntries, setShowIncomeEntries] = useState(false);
  const [addingEntry, setAddingEntry] = useState(false);
  const [entrySource, setEntrySource] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [entryError, setEntryError] = useState('');
  const [deletingEntry, setDeletingEntry] = useState<string | null>(null);

  const periodDate = parse(period, 'yyyy-MM', new Date());
  const prevPeriod = format(subMonths(periodDate, 1), 'yyyy-MM');
  const nextPeriod = format(addMonths(periodDate, 1), 'yyyy-MM');
  const canGoForward = nextPeriod <= currentPeriod;
  const displayMonth = format(periodDate, 'MMMM yyyy');
  const prevMonthDisplay = format(subMonths(periodDate, 1), 'MMMM yyyy');
  const locked = periodRow?.is_locked ?? false;

  const totalLogged = categories.flatMap((c) => c.expenses).reduce((sum, e) => {
    const v = logValues[e.id];
    return sum + (v ? parseFloat(v) || 0 : (expenseLogs[e.id]?.actual_amount ?? 0));
  }, 0);
  const totalReceived = periodRow?.total_received ?? 0;
  const remaining = totalReceived - totalLogged;
  const progressPct = totalReceived > 0 ? Math.min(100, (totalLogged / totalReceived) * 100) : 0;

  function navigate(p: string) { router.push(`/ledger?month=${p}`); }

  function handleAmountChange(expenseId: string, periodId: string, value: string) {
    setLogValues((prev) => ({ ...prev, [expenseId]: value }));
    setSaveStates((prev) => ({ ...prev, [expenseId]: 'saving' }));
    clearTimeout(saveTimers[expenseId]);
    saveTimers[expenseId] = setTimeout(async () => {
      const amount = value === '' ? null : parseFloat(value);
      if (value !== '' && (isNaN(amount!) || amount! < 0)) return;
      const note = noteValues[expenseId] || undefined;
      await upsertExpenseLog(periodId, expenseId, amount, note);
      setSaveStates((prev) => ({ ...prev, [expenseId]: 'saved' }));
      setTimeout(() => setSaveStates((prev) => ({ ...prev, [expenseId]: 'idle' })), 1500);
    }, 800);
  }

  function handleNoteChange(expenseId: string, periodId: string, value: string) {
    setNoteValues((prev) => ({ ...prev, [expenseId]: value }));
    clearTimeout(noteTimers[expenseId]);
    noteTimers[expenseId] = setTimeout(async () => {
      const rawAmount = logValues[expenseId];
      const amount =
        rawAmount !== undefined
          ? rawAmount === '' ? null : parseFloat(rawAmount) || null
          : expenseLogs[expenseId]?.actual_amount ?? null;
      await upsertExpenseLog(periodId, expenseId, amount, value || undefined);
    }, 800);
  }

  async function handleCreatePeriod() {
    const amount = parseFloat(income);
    if (!amount || amount < 0) { setIncomeError('Enter a valid amount'); return; }
    setIncomeError('');
    startTransition(async () => {
      const result = await createMonthlyPeriod(period, amount, incomeNotes || undefined);
      if (result.error) setIncomeError(result.error);
      else router.refresh();
    });
  }

  async function handleLockToggle() {
    if (!periodRow) return;
    startTransition(async () => {
      await updateMonthlyPeriodLock(periodRow.id, !locked);
      router.refresh();
    });
  }

  function handleOpenIncomeEdit() {
    setIncomeEditValue(periodRow!.total_received.toString());
    setIncomeEditError('');
    setEditingIncome(true);
  }

  async function handleSaveIncome() {
    const amount = parseFloat(incomeEditValue);
    if (!amount || amount < 0) { setIncomeEditError('Enter a valid amount'); return; }
    setIncomeEditError('');
    startTransition(async () => {
      const result = await updateMonthlyPeriod(periodRow!.id, { total_received: amount });
      if (result.error) setIncomeEditError(result.error);
      else { setEditingIncome(false); router.refresh(); }
    });
  }

  async function handleSavePeriodNotes() {
    setEditingPeriodNotes(false);
    if (!periodRow || periodNotesValue === (periodRow.notes ?? '')) return;
    await updateMonthlyPeriod(periodRow.id, { notes: periodNotesValue || null });
    router.refresh();
  }

  async function handleCopyPrevMonth() {
    if (!periodRow || !previousPeriodId) return;
    setCopyError('');
    setCopying(true);
    const result = await copyPreviousMonthLogs(periodRow.id, previousPeriodId);
    setCopying(false);
    if (result.error) { setCopyError(result.error); return; }
    const newLogValues = { ...logValues };
    const newNoteValues = { ...noteValues };
    for (const log of result.logs ?? []) {
      if (log.actual_amount != null && !newLogValues[log.expense_id]) {
        newLogValues[log.expense_id] = log.actual_amount.toString();
      }
      if (log.notes && !newNoteValues[log.expense_id]) {
        newNoteValues[log.expense_id] = log.notes;
      }
    }
    setLogValues(newLogValues);
    setNoteValues(newNoteValues);
    setCopyDone(true);
  }

  async function handleAddIncomeEntry() {
    if (!periodRow) return;
    const src = entrySource.trim();
    const amt = parseFloat(entryAmount);
    if (!src) { setEntryError('Source name is required'); return; }
    if (!amt || amt <= 0) { setEntryError('Enter a valid amount'); return; }
    setEntryError('');
    const res = await createIncomeEntry(periodRow.id, src, amt, entryNotes || undefined);
    if (res.error) { setEntryError(res.error); return; }
    if (res.data) {
      setIncomeEntries((prev) => [...prev, res.data as IncomeEntry]);
    }
    setEntrySource('');
    setEntryAmount('');
    setEntryNotes('');
    setAddingEntry(false);
  }

  async function handleDeleteIncomeEntry(id: string) {
    setDeletingEntry(id);
    await deleteIncomeEntry(id);
    setIncomeEntries((prev) => prev.filter((e) => e.id !== id));
    setDeletingEntry(null);
  }

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto">
      {/* Month nav header */}
      <div className="flex-shrink-0 px-6 pt-8 pb-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(prevPeriod)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: '#4e4e6e' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#121228'; e.currentTarget.style.color = '#ededf8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = '#4e4e6e'; }}
            >
              <ChevronLeft size={16} />
            </button>
            <h1 className="text-xl font-semibold px-2 min-w-[160px] text-center" style={{ color: '#ededf8' }}>
              {displayMonth}
            </h1>
            <button
              onClick={() => canGoForward && navigate(nextPeriod)}
              disabled={!canGoForward}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
              style={{ color: '#4e4e6e' }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.backgroundColor = '#121228'; e.currentTarget.style.color = '#ededf8'; }}}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = '#4e4e6e'; }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {periodRow && (
            <div className="flex items-center gap-2">
              {!locked && !editingIncome && (
                <button
                  onClick={handleOpenIncomeEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                  style={{ backgroundColor: '#121228', borderColor: '#22223a', color: '#8080a8' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ededf8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#8080a8'; }}
                >
                  <Pencil size={11} />
                  Edit income
                </button>
              )}
              <button
                onClick={handleLockToggle}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                style={
                  locked
                    ? { backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)', color: '#f59e0b' }
                    : { backgroundColor: '#121228', borderColor: '#22223a', color: '#8080a8' }
                }
                onMouseEnter={(e) => { if (!locked) e.currentTarget.style.color = '#ededf8'; }}
                onMouseLeave={(e) => { if (!locked) e.currentTarget.style.color = '#8080a8'; }}
              >
                {locked ? <Lock size={12} /> : <Unlock size={12} />}
                {locked ? 'Locked' : 'Lock month'}
              </button>
            </div>
          )}
        </div>

        {/* Edit income form */}
        {editingIncome && periodRow && (
          <div
            className="rounded-xl border p-4 mb-3 space-y-3"
            style={{ backgroundColor: '#121228', borderColor: '#22223a' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8080a8' }}>Edit Income</p>
            <div className="flex gap-2 items-start">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono" style={{ color: '#4e4e6e' }}>MVR</span>
                <input
                  type="number"
                  min="0"
                  autoFocus
                  value={incomeEditValue}
                  onChange={(e) => setIncomeEditValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveIncome()}
                  className="w-full pl-12 pr-3 py-2.5 rounded-lg border text-sm font-mono focus:outline-none transition-colors"
                  style={{ backgroundColor: '#0a0a18', borderColor: '#22223a', color: '#ededf8' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#22223a')}
                  placeholder="0.00"
                />
              </div>
              <button
                onClick={handleSaveIncome}
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#6366f1', color: 'white' }}
              >
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Save
              </button>
              <button
                onClick={() => setEditingIncome(false)}
                className="px-4 py-2.5 rounded-lg text-sm transition-colors border"
                style={{ backgroundColor: '#0a0a18', borderColor: '#22223a', color: '#8080a8' }}
              >
                Cancel
              </button>
            </div>
            {incomeEditError && <p className="text-xs" style={{ color: '#ef4444' }}>{incomeEditError}</p>}
          </div>
        )}

        {/* Summary cards */}
        {periodRow && !editingIncome && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Received', value: totalReceived, color: '#ededf8', accent: '#6366f130' },
                { label: 'Logged', value: totalLogged, color: '#f59e0b', accent: '#f59e0b30' },
                {
                  label: 'Remaining',
                  value: remaining,
                  color: remaining >= 0 ? '#22c55e' : '#ef4444',
                  accent: remaining >= 0 ? '#22c55e30' : '#ef444430',
                },
              ].map(({ label, value, color, accent }) => (
                <div
                  key={label}
                  className="rounded-xl border px-4 py-3"
                  style={{ backgroundColor: '#121228', borderColor: '#22223a', borderTop: `2px solid ${accent}` }}
                >
                  <p className="text-xs mb-1" style={{ color: '#4e4e6e' }}>{label}</p>
                  <p className="text-base font-mono tabular-nums font-semibold" style={{ color }}>
                    {formatMVR(value)}
                  </p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs" style={{ color: '#4e4e6e' }}>Spending progress</span>
                <span className="text-xs font-mono" style={{ color: '#8080a8' }}>{progressPct.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#22223a' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    background: progressPct >= 100 ? '#ef4444' : progressPct >= 80 ? '#f59e0b' : '#6366f1',
                  }}
                />
              </div>
            </div>

            {/* Period notes */}
            <div>
              {editingPeriodNotes ? (
                <textarea
                  autoFocus
                  rows={2}
                  value={periodNotesValue}
                  onChange={(e) => setPeriodNotesValue(e.target.value)}
                  onBlur={handleSavePeriodNotes}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setEditingPeriodNotes(false); setPeriodNotesValue(periodRow.notes ?? ''); } }}
                  className="w-full px-3 py-2 rounded-lg text-xs resize-none focus:outline-none transition-colors"
                  style={{ backgroundColor: '#0a0a18', border: '1px solid #6366f1', color: '#8080a8' }}
                  placeholder="Add a note for this month…"
                />
              ) : (
                <button
                  onClick={() => setEditingPeriodNotes(true)}
                  className="text-xs text-left w-full px-1 py-0.5 rounded transition-colors"
                  style={{ color: '#4e4e6e' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#8080a8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#4e4e6e'; }}
                >
                  {periodNotesValue || '+ Add a note for this month'}
                </button>
              )}
            </div>

            {/* Income entries */}
            <div
              className="rounded-xl border overflow-hidden"
              style={{ backgroundColor: '#0a0a18', borderColor: '#22223a' }}
            >
              <button
                onClick={() => setShowIncomeEntries(!showIncomeEntries)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors"
                style={{ color: '#4e4e6e' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#8080a8'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#4e4e6e'; }}
              >
                <DollarSign size={11} />
                <span>Income breakdown</span>
                {incomeEntries.length > 0 && (
                  <span
                    className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                    style={{ backgroundColor: '#1a1a32', color: '#8080a8' }}
                  >
                    {incomeEntries.length}
                  </span>
                )}
                <ChevronDown
                  size={11}
                  className={`ml-auto transition-transform duration-150 ${showIncomeEntries ? 'rotate-180' : ''}`}
                />
              </button>

              {showIncomeEntries && (
                <div style={{ borderTop: '1px solid #22223a' }}>
                  {incomeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 px-3 py-2"
                      style={{ borderBottom: '1px solid rgba(34,34,58,0.5)' }}
                    >
                      <span className="text-xs flex-1" style={{ color: '#ededf8' }}>{entry.source}</span>
                      {entry.notes && <span className="text-xs" style={{ color: '#4e4e6e' }}>{entry.notes}</span>}
                      <span className="text-xs font-mono" style={{ color: '#34d399' }}>{formatMVR(Number(entry.amount))}</span>
                      {!locked && (
                        <button
                          onClick={() => handleDeleteIncomeEntry(entry.id)}
                          disabled={deletingEntry === entry.id}
                          className="w-5 h-5 flex items-center justify-center rounded transition-colors disabled:opacity-40"
                          style={{ color: '#4e4e6e' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#4e4e6e'; }}
                        >
                          {deletingEntry === entry.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                        </button>
                      )}
                    </div>
                  ))}

                  {!locked && !addingEntry && (
                    <button
                      onClick={() => setAddingEntry(true)}
                      className="w-full flex items-center gap-1.5 px-3 py-2 text-xs transition-colors"
                      style={{ color: '#4e4e6e' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#6366f1'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#4e4e6e'; }}
                    >
                      <Plus size={10} />
                      Add income source
                    </button>
                  )}

                  {addingEntry && (
                    <div className="px-3 py-3 space-y-2" style={{ borderTop: '1px solid rgba(34,34,58,0.5)' }}>
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={entrySource}
                          onChange={(e) => setEntrySource(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none transition-colors"
                          style={{ backgroundColor: '#07070f', borderColor: '#22223a', color: '#ededf8' }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                          onBlur={(e) => (e.currentTarget.style.borderColor = '#22223a')}
                          placeholder="Source (e.g. Salary)"
                        />
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono" style={{ color: '#4e4e6e' }}>MVR</span>
                          <input
                            type="number"
                            min="0"
                            value={entryAmount}
                            onChange={(e) => setEntryAmount(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddIncomeEntry()}
                            className="w-28 pl-10 pr-2 py-1.5 rounded-lg border text-xs font-mono focus:outline-none transition-colors"
                            style={{ backgroundColor: '#07070f', borderColor: '#22223a', color: '#ededf8' }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                            onBlur={(e) => (e.currentTarget.style.borderColor = '#22223a')}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      {entryError && <p className="text-[10px]" style={{ color: '#ef4444' }}>{entryError}</p>}
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleAddIncomeEntry}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                          style={{ backgroundColor: '#6366f1', color: 'white' }}
                        >
                          <Check size={10} />
                          Add
                        </button>
                        <button
                          onClick={() => { setAddingEntry(false); setEntryError(''); }}
                          className="px-2.5 py-1 rounded-lg text-xs transition-colors"
                          style={{ color: '#4e4e6e' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* Income prompt */}
        {!periodRow && (
          <div className="max-w-sm mx-auto mt-8">
            <div
              className="rounded-2xl border p-6"
              style={{ backgroundColor: '#121228', borderColor: '#22223a' }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: 'rgba(99,102,241,0.15)' }}
              >
                <TrendingUp size={18} style={{ color: '#6366f1' }} />
              </div>
              <h2 className="text-base font-semibold mb-1" style={{ color: '#ededf8' }}>
                Start {displayMonth}
              </h2>
              <p className="text-sm mb-5" style={{ color: '#8080a8' }}>
                Enter your income to begin tracking expenses for this month.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#8080a8' }}>
                    Income received (MVR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono" style={{ color: '#4e4e6e' }}>MVR</span>
                    <input
                      type="number"
                      min="0"
                      value={income}
                      onChange={(e) => setIncome(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreatePeriod()}
                      className="w-full pl-12 pr-3 py-2.5 rounded-lg border text-sm font-mono focus:outline-none transition-colors"
                      style={{ backgroundColor: '#0a0a18', borderColor: '#22223a', color: '#ededf8' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#22223a')}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#8080a8' }}>Notes (optional)</label>
                  <input
                    value={incomeNotes}
                    onChange={(e) => setIncomeNotes(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
                    style={{ backgroundColor: '#0a0a18', borderColor: '#22223a', color: '#ededf8' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#22223a')}
                    placeholder="Optional notes"
                  />
                </div>
                {incomeError && <p className="text-xs" style={{ color: '#ef4444' }}>{incomeError}</p>}
                <button
                  onClick={handleCreatePeriod}
                  disabled={isPending || !income}
                  className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#6366f1', color: 'white' }}
                  onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#818cf8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#6366f1'; }}
                >
                  {isPending ? 'Starting…' : 'Start month'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Period exists */}
        {periodRow && (
          <div className="space-y-3">
            {locked && (
              <div
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm"
                style={{ backgroundColor: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}
              >
                <Lock size={13} />
                This month is locked. Unlock it to make changes.
              </div>
            )}

            {previousPeriodId && !locked && !copyDone && (
              <div
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl border"
                style={{ backgroundColor: '#0a0a18', borderColor: '#22223a' }}
              >
                <ClipboardCopy size={13} style={{ color: '#4e4e6e', flexShrink: 0 }} />
                <span className="text-xs flex-1" style={{ color: '#4e4e6e' }}>
                  Pre-fill amounts from {prevMonthDisplay}
                </span>
                {copyError && <span className="text-xs" style={{ color: '#ef4444' }}>{copyError}</span>}
                <button
                  onClick={handleCopyPrevMonth}
                  disabled={copying}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#121228', borderColor: '#22223a', color: '#8080a8' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ededf8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#8080a8'; }}
                >
                  {copying ? <Loader2 size={11} className="animate-spin" /> : null}
                  {copying ? 'Copying…' : 'Fill from last month'}
                </button>
              </div>
            )}

            {categories.map((cat) => (
              <CategoryBlock
                key={cat.id}
                cat={cat}
                periodId={periodRow.id}
                locked={locked}
                logValues={logValues}
                saveStates={saveStates}
                noteValues={noteValues}
                expandedNotes={expandedNotes}
                expanded={expandedCats.has(cat.id)}
                onToggle={() =>
                  setExpandedCats((prev) => {
                    const n = new Set(prev);
                    n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id);
                    return n;
                  })
                }
                onAmountChange={(id, val) => handleAmountChange(id, periodRow.id, val)}
                onNoteToggle={(id) =>
                  setExpandedNotes((prev) => {
                    const n = new Set(prev);
                    n.has(id) ? n.delete(id) : n.add(id);
                    return n;
                  })
                }
                onNoteChange={(id, val) => handleNoteChange(id, periodRow.id, val)}
              />
            ))}

            {annualExpenses.length > 0 && (
              <div
                className="rounded-xl border overflow-hidden"
                style={{ backgroundColor: '#121228', borderColor: '#22223a' }}
              >
                <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#22223a' }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                  <span className="text-sm font-medium" style={{ color: '#ededf8' }}>Annual — billed this month</span>
                </div>
                {annualExpenses.map((exp) => {
                  const log = annualLogs[exp.id];
                  return (
                    <div key={exp.id} className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: '1px solid rgba(34,34,58,0.4)' }}>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm" style={{ color: '#ededf8' }}>{exp.name}</span>
                        <span
                          className="ml-2 text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}
                        >
                          Annual
                        </span>
                        <p className="text-xs mt-0.5" style={{ color: '#4e4e6e' }}>{exp.categoryName}</p>
                      </div>
                      <span className="text-xs font-mono" style={{ color: '#4e4e6e' }}>
                        {exp.dedicated_amount != null ? formatMVR(exp.dedicated_amount) : '—'}
                      </span>
                      <span className="text-sm font-mono" style={{ color: '#34d399' }}>
                        {log?.actual_amount != null ? formatMVR(log.actual_amount) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky footer */}
      {periodRow && (
        <div
          className="flex-shrink-0 border-t px-6 py-3"
          style={{ borderColor: '#22223a', backgroundColor: 'rgba(12,12,27,0.85)', backdropFilter: 'blur(8px)' }}
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-xs" style={{ color: '#4e4e6e' }}>
              {categories.reduce((s, c) => s + c.expenses.length, 0)} expenses
            </span>
            <div className="flex items-center gap-5">
              <span className="text-xs" style={{ color: '#8080a8' }}>
                Logged <span className="font-mono ml-1" style={{ color: '#f59e0b' }}>{formatMVR(totalLogged)}</span>
              </span>
              <span className="text-xs" style={{ color: '#8080a8' }}>
                Left{' '}
                <span className="font-mono ml-1" style={{ color: remaining >= 0 ? '#22c55e' : '#ef4444' }}>
                  {formatMVR(remaining)}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryBlock({
  cat, periodId, locked, logValues, saveStates, noteValues, expandedNotes,
  expanded, onToggle, onAmountChange, onNoteToggle, onNoteChange,
}: {
  cat: Category;
  periodId: string;
  locked: boolean;
  logValues: Record<string, string>;
  saveStates: Record<string, SaveState>;
  noteValues: Record<string, string>;
  expandedNotes: Set<string>;
  expanded: boolean;
  onToggle: () => void;
  onAmountChange: (id: string, val: string) => void;
  onNoteToggle: (id: string) => void;
  onNoteChange: (id: string, val: string) => void;
}) {
  const catTotal = cat.expenses.reduce((sum, e) => {
    const v = logValues[e.id];
    return sum + (v ? parseFloat(v) || 0 : 0);
  }, 0);
  const catBudget = cat.expenses.reduce((s, e) => s + (e.dedicated_amount ?? 0), 0);
  const catDelta = catBudget > 0 ? catBudget - catTotal : null;
  const budgetPct = catBudget > 0 ? (catTotal / catBudget) * 100 : 0;
  const overBudget = catBudget > 0 && catTotal > catBudget;
  const nearBudget = !overBudget && catBudget > 0 && budgetPct >= 80;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: '#121228', borderColor: '#22223a', borderLeft: `3px solid ${cat.color}` }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(12,12,27,0.5)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
      >
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
        <span className="text-sm font-semibold flex-1 text-left" style={{ color: '#ededf8' }}>{cat.name}</span>
        {overBudget && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
          >
            Over budget
          </span>
        )}
        {nearBudget && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
          >
            {Math.round(budgetPct)}%
          </span>
        )}
        <span className="text-xs font-mono mr-1" style={{ color: '#4e4e6e' }}>{formatMVR(catTotal)}</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
          style={{ color: '#4e4e6e' }}
        />
      </button>

      {expanded && cat.expenses.length > 0 && (
        <>
          <div
            className="grid grid-cols-[1fr_auto_140px_80px_28px] gap-3 px-4 py-2 border-t"
            style={{ borderColor: 'rgba(34,34,58,0.5)', backgroundColor: 'rgba(7,7,15,0.3)' }}
          >
            {['Expense', 'Budget', 'Amount (MVR)', 'Delta', ''].map((h) => (
              <span key={h} className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#4e4e6e' }}>
                {h}
              </span>
            ))}
          </div>

          {cat.expenses.map((exp) => {
            const rawVal = logValues[exp.id] ?? '';
            const actualAmount = rawVal !== '' ? parseFloat(rawVal) : null;
            const delta = computeDelta({ id: exp.id, name: exp.name, dedicated_amount: exp.dedicated_amount, actual_amount: actualAmount });
            const ss = saveStates[exp.id] ?? 'idle';
            const hasNote = !!(noteValues[exp.id]);
            const noteExpanded = expandedNotes.has(exp.id);

            return (
              <div key={exp.id} style={{ borderTop: '1px solid rgba(34,34,58,0.3)' }}>
                <div
                  className="grid grid-cols-[1fr_auto_140px_80px_28px] gap-3 items-center px-4 py-3 transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(7,7,15,0.2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                >
                  <div className="min-w-0">
                    <p className="text-sm truncate" style={{ color: '#ededf8' }}>{exp.name}</p>
                    {exp.billing_day && (
                      <p className="text-[10px]" style={{ color: '#4e4e6e' }}>Day {exp.billing_day}</p>
                    )}
                  </div>

                  <span className="text-xs font-mono whitespace-nowrap" style={{ color: '#4e4e6e' }}>
                    {exp.dedicated_amount != null ? formatMVR(exp.dedicated_amount) : <span style={{ opacity: 0.3 }}>—</span>}
                  </span>

                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={rawVal}
                      disabled={locked}
                      onChange={(e) => onAmountChange(exp.id, e.target.value)}
                      className="w-full text-right pr-7 pl-2 py-2 rounded-lg border text-sm font-mono focus:outline-none transition-all disabled:opacity-40"
                      style={{ backgroundColor: '#0a0a18', borderColor: '#22223a', color: '#ededf8' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#22223a')}
                      placeholder="0.00"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      {ss === 'saving' && <Loader2 size={10} style={{ color: '#6366f1' }} className="animate-spin" />}
                      {ss === 'saved' && <Check size={10} style={{ color: '#22c55e' }} />}
                    </span>
                  </div>

                  <div className="text-right">
                    {delta !== null ? (
                      <span
                        className="inline-flex items-center gap-0.5 text-xs font-mono font-medium"
                        style={{ color: delta >= 0 ? '#22c55e' : '#ef4444' }}
                      >
                        {delta >= 0 ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                        {delta >= 0 ? '+' : ''}{formatMVR(delta)}
                      </span>
                    ) : (
                      <Minus size={12} style={{ color: '#4e4e6e', marginLeft: 'auto' }} />
                    )}
                  </div>

                  <button
                    onClick={() => onNoteToggle(exp.id)}
                    title={hasNote ? 'View note' : 'Add note'}
                    className="w-6 h-6 flex items-center justify-center rounded transition-colors"
                    style={{ color: hasNote ? '#6366f1' : '#4e4e6e' }}
                    onMouseEnter={(e) => { if (!hasNote) e.currentTarget.style.color = '#8080a8'; }}
                    onMouseLeave={(e) => { if (!hasNote) e.currentTarget.style.color = '#4e4e6e'; }}
                  >
                    <MessageSquare size={12} />
                  </button>
                </div>

                {noteExpanded && (
                  <div className="px-4 pb-3 pt-1" style={{ backgroundColor: 'rgba(7,7,15,0.2)' }}>
                    <textarea
                      rows={2}
                      value={noteValues[exp.id] ?? ''}
                      onChange={(e) => onNoteChange(exp.id, e.target.value)}
                      disabled={locked}
                      className="w-full px-3 py-2 rounded-lg text-xs resize-none focus:outline-none transition-colors disabled:opacity-40"
                      style={{ backgroundColor: '#0a0a18', border: '1px solid #22223a', color: '#8080a8' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#22223a')}
                      placeholder="Add a note for this expense…"
                    />
                  </div>
                )}
              </div>
            );
          })}

          <div
            className="grid grid-cols-[1fr_auto_140px_80px_28px] gap-3 items-center px-4 py-2.5 border-t-2"
            style={{ borderColor: 'rgba(34,34,58,0.6)', backgroundColor: 'rgba(0,0,0,0.15)' }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#4e4e6e' }}>Category total</span>
            <span className="text-xs font-mono font-semibold" style={{ color: '#8080a8' }}>
              {catBudget > 0 ? formatMVR(catBudget) : '—'}
            </span>
            <span className="text-right text-sm font-mono font-semibold" style={{ color: '#ededf8' }}>
              {formatMVR(catTotal)}
            </span>
            <div className="text-right">
              {catDelta !== null ? (
                <span className="text-xs font-mono font-semibold" style={{ color: catDelta >= 0 ? '#22c55e' : '#ef4444' }}>
                  {catDelta >= 0 ? '+' : ''}{formatMVR(catDelta)}
                </span>
              ) : (
                <span className="text-xs" style={{ color: '#4e4e6e' }}>—</span>
              )}
            </div>
            <div />
          </div>
        </>
      )}

      {expanded && cat.expenses.length === 0 && (
        <div className="px-4 py-4 border-t text-xs" style={{ borderColor: 'rgba(34,34,58,0.5)', color: '#4e4e6e' }}>
          No expenses in this category. Add them in Setup.
        </div>
      )}
    </div>
  );
}
