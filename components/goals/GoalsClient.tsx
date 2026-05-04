'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, differenceInDays } from 'date-fns';
import {
  Plus, Trash2, Pencil, ChevronDown, ChevronUp, Check, Loader2, Target, X,
} from 'lucide-react';
import { createGoal, updateGoal, deleteGoal, addGoalContribution, deleteGoalContribution } from '@/app/actions/goals';
import { formatMVR } from '@/lib/currency';
import PageHeader from '@/components/shared/PageHeader';

interface Contribution {
  id: string;
  amount: number;
  notes: string | null;
  contributed_at: string;
}

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  color: string;
  deadline: string | null;
  notes: string | null;
  goal_contributions: Contribution[];
}

const COLORS = [
  '#6366f1', '#818cf8', '#22c55e', '#34d399', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316',
];

function GoalForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<Goal>;
  onSave: (data: { name: string; target_amount: number; color: string; deadline: string | null; notes: string | null }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [target, setTarget] = useState(initial?.target_amount?.toString() ?? '');
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [err, setErr] = useState('');

  function handleSubmit() {
    if (!name.trim()) { setErr('Name is required'); return; }
    const t = parseFloat(target);
    if (!t || t <= 0) { setErr('Enter a valid target amount'); return; }
    setErr('');
    onSave({ name: name.trim(), target_amount: t, color, deadline: deadline || null, notes: notes || null });
  }

  return (
    <div
      className="rounded-xl border p-5 space-y-4 animate-slide-up"
      style={{ backgroundColor: '#121228', borderColor: '#22223a' }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8080a8' }}>
        {initial?.id ? 'Edit Goal' : 'New Goal'}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#8080a8' }}>Goal name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors"
            style={{ backgroundColor: '#0a0a18', borderColor: '#22223a', color: '#ededf8' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#22223a')}
            placeholder="e.g. Emergency Fund"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#8080a8' }}>Target (MVR)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono" style={{ color: '#4e4e6e' }}>MVR</span>
            <input
              type="number"
              min="0"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full pl-12 pr-3 py-2 rounded-lg border text-sm font-mono focus:outline-none transition-colors"
              style={{ backgroundColor: '#0a0a18', borderColor: '#22223a', color: '#ededf8' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#22223a')}
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#8080a8' }}>Deadline (optional)</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors"
            style={{ backgroundColor: '#0a0a18', borderColor: '#22223a', color: '#ededf8' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#22223a')}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-2" style={{ color: '#8080a8' }}>Colour</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-6 h-6 rounded-full transition-transform"
              style={{
                background: c,
                outline: color === c ? `2px solid ${c}` : 'none',
                outlineOffset: '2px',
                transform: color === c ? 'scale(1.15)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: '#8080a8' }}>Notes (optional)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors"
          style={{ backgroundColor: '#0a0a18', borderColor: '#22223a', color: '#ededf8' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#22223a')}
          placeholder="Optional notes"
        />
      </div>

      {err && <p className="text-xs" style={{ color: '#ef4444' }}>{err}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#6366f1', color: 'white' }}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm transition-colors"
          style={{ backgroundColor: '#1a1a32', color: '#8080a8', border: '1px solid #30305a' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function GoalCard({ goal, onUpdated }: { goal: Goal; onUpdated: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [showContribs, setShowContribs] = useState(false);
  const [addingContrib, setAddingContrib] = useState(false);
  const [contribAmount, setContribAmount] = useState('');
  const [contribNotes, setContribNotes] = useState('');
  const [contribErr, setContribErr] = useState('');

  const savedAmount = Number(goal.current_amount);
  const target = Number(goal.target_amount);
  const pct = target > 0 ? Math.min(100, (savedAmount / target) * 100) : 0;
  const remaining = target - savedAmount;
  const daysLeft = goal.deadline
    ? differenceInDays(parseISO(goal.deadline), new Date())
    : null;

  async function handleUpdate(data: { name: string; target_amount: number; color: string; deadline: string | null; notes: string | null }) {
    startTransition(async () => {
      await updateGoal(goal.id, data);
      setEditing(false);
      router.refresh();
    });
  }

  async function handleDelete() {
    if (!confirm(`Delete "${goal.name}"?`)) return;
    startTransition(async () => {
      await deleteGoal(goal.id);
      router.refresh();
    });
  }

  async function handleAddContrib() {
    const amt = parseFloat(contribAmount);
    if (!amt || amt <= 0) { setContribErr('Enter a valid amount'); return; }
    setContribErr('');
    startTransition(async () => {
      const res = await addGoalContribution(goal.id, amt, contribNotes || undefined);
      if (res.error) { setContribErr(res.error); return; }
      setContribAmount('');
      setContribNotes('');
      setAddingContrib(false);
      router.refresh();
    });
  }

  async function handleDeleteContrib(id: string) {
    startTransition(async () => {
      await deleteGoalContribution(id, goal.id);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <GoalForm
        initial={goal}
        onSave={handleUpdate}
        onCancel={() => setEditing(false)}
        saving={isPending}
      />
    );
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: '#121228', borderColor: '#22223a', borderLeft: `3px solid ${goal.color}` }}
    >
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: '#ededf8' }}>{goal.name}</span>
              {pct >= 100 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                  Complete
                </span>
              )}
              {daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                  {daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                </span>
              )}
              {daysLeft !== null && daysLeft < 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                  Overdue
                </span>
              )}
            </div>
            {goal.deadline && (
              <p className="text-xs" style={{ color: '#4e4e6e' }}>
                Target: {format(parseISO(goal.deadline), 'd MMM yyyy')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditing(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: '#4e4e6e' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1a1a32'; e.currentTarget.style.color = '#8080a8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = '#4e4e6e'; }}
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40"
              style={{ color: '#4e4e6e' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = '#4e4e6e'; }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: '#22223a' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: goal.color }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs">
            <span className="font-mono font-medium" style={{ color: '#ededf8' }}>{formatMVR(savedAmount)}</span>
            <span style={{ color: '#4e4e6e' }}>
              {pct.toFixed(0)}% · {remaining > 0 ? formatMVR(remaining) + ' to go' : 'Goal reached!'}
            </span>
            <span className="font-mono" style={{ color: '#8080a8' }}>{formatMVR(target)}</span>
          </div>
        </div>

        {goal.notes && (
          <p className="text-xs" style={{ color: '#8080a8' }}>{goal.notes}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setAddingContrib(!addingContrib); setContribErr(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ backgroundColor: '#1a1a32', color: '#8080a8', border: '1px solid #30305a' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ededf8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#8080a8'; }}
          >
            <Plus size={11} />
            Add contribution
          </button>
          {goal.goal_contributions.length > 0 && (
            <button
              onClick={() => setShowContribs(!showContribs)}
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: '#4e4e6e' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#8080a8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#4e4e6e'; }}
            >
              {goal.goal_contributions.length} contribution{goal.goal_contributions.length !== 1 ? 's' : ''}
              {showContribs ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
        </div>

        {/* Add contribution form */}
        {addingContrib && (
          <div
            className="rounded-lg p-3 space-y-2 animate-slide-up"
            style={{ backgroundColor: '#0a0a18', border: '1px solid #22223a' }}
          >
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono" style={{ color: '#4e4e6e' }}>MVR</span>
                <input
                  type="number"
                  min="0"
                  autoFocus
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddContrib()}
                  className="w-full pl-12 pr-3 py-2 rounded-lg border text-sm font-mono focus:outline-none transition-colors"
                  style={{ backgroundColor: '#07070f', borderColor: '#22223a', color: '#ededf8' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#22223a')}
                  placeholder="0.00"
                />
              </div>
              <input
                value={contribNotes}
                onChange={(e) => setContribNotes(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors"
                style={{ backgroundColor: '#07070f', borderColor: '#22223a', color: '#ededf8' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#22223a')}
                placeholder="Notes (optional)"
              />
            </div>
            {contribErr && <p className="text-xs" style={{ color: '#ef4444' }}>{contribErr}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleAddContrib}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#6366f1', color: 'white' }}
              >
                {isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                Save
              </button>
              <button
                onClick={() => setAddingContrib(false)}
                className="px-3 py-1.5 rounded-lg text-xs transition-colors"
                style={{ color: '#8080a8' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Contribution history */}
        {showContribs && goal.goal_contributions.length > 0 && (
          <div
            className="rounded-lg overflow-hidden animate-slide-up"
            style={{ border: '1px solid #22223a' }}
          >
            {[...goal.goal_contributions]
              .sort((a, b) => b.contributed_at.localeCompare(a.contributed_at))
              .map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 px-3 py-2.5"
                  style={{ borderBottom: '1px solid rgba(34,34,58,0.5)' }}
                >
                  <span className="text-xs font-mono" style={{ color: '#ededf8' }}>{formatMVR(Number(c.amount))}</span>
                  <span className="text-xs flex-1" style={{ color: '#8080a8' }}>{c.notes || ''}</span>
                  <span className="text-xs font-mono" style={{ color: '#4e4e6e' }}>
                    {format(parseISO(c.contributed_at), 'd MMM yyyy')}
                  </span>
                  <button
                    onClick={() => handleDeleteContrib(c.id)}
                    disabled={isPending}
                    className="w-5 h-5 flex items-center justify-center rounded transition-colors disabled:opacity-40"
                    style={{ color: '#4e4e6e' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#4e4e6e'; }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GoalsClient({ goals }: { goals: Goal[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const activeGoals = goals.filter((g) => Number(g.current_amount) < Number(g.target_amount));

  async function handleCreate(data: { name: string; target_amount: number; color: string; deadline: string | null; notes: string | null }) {
    startTransition(async () => {
      const res = await createGoal(data);
      if (!res.error) { setShowForm(false); router.refresh(); }
    });
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto animate-fade-in">
      <PageHeader
        title="Savings Goals"
        subtitle={goals.length > 0 ? `${activeGoals.length} active, ${goals.length - activeGoals.length} complete` : undefined}
        right={
          !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: '#6366f1', color: 'white' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#818cf8')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#6366f1')}
            >
              <Plus size={14} />
              New Goal
            </button>
          ) : undefined
        }
      />

      {/* Summary bar */}
      {goals.length > 0 && (
        <div
          className="grid grid-cols-3 gap-3 mb-6 p-4 rounded-xl border"
          style={{ backgroundColor: '#121228', borderColor: '#22223a' }}
        >
          {[
            { label: 'Total Saved', value: formatMVR(totalSaved), color: '#22c55e' },
            { label: 'Total Target', value: formatMVR(totalTarget), color: '#ededf8' },
            { label: 'Active Goals', value: String(activeGoals.length), color: '#818cf8' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-xs mb-1" style={{ color: '#4e4e6e' }}>{label}</p>
              <p className="text-lg font-mono font-semibold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="mb-4">
          <GoalForm onSave={handleCreate} onCancel={() => setShowForm(false)} saving={isPending} />
        </div>
      )}

      {goals.length === 0 && !showForm && (
        <div className="flex flex-col items-center gap-3 mt-16 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: '#121228', border: '1px solid #22223a' }}
          >
            <Target size={24} style={{ color: '#4e4e6e' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: '#ededf8' }}>No savings goals yet</p>
          <p className="text-sm" style={{ color: '#4e4e6e' }}>Track progress toward big purchases, emergency funds, or any financial milestone.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: '#6366f1', color: 'white' }}
          >
            <Plus size={14} />
            Create your first goal
          </button>
        </div>
      )}

      <div className="space-y-3">
        {goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} onUpdated={() => router.refresh()} />
        ))}
      </div>
    </div>
  );
}
