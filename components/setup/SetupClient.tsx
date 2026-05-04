'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  ToggleLeft, ToggleRight, Check, AlertCircle,
  Folder, Home, Lock, Zap, Heart, Star, Briefcase, Car, Coffee, Gift,
  ShoppingCart, Utensils, Wifi, Phone, Tv, Fuel, Pill, Plane, Book, Music,
  Gamepad2, Shirt, Baby, Building, Wrench, Camera, Dumbbell, PawPrint,
  CreditCard, Banknote, Bus, Train, Bike, Laptop, Shield, Flame, Globe,
  Scissors, Package, type LucideIcon,
} from 'lucide-react';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  deleteCategoryForce,
} from '@/app/actions/categories';
import {
  createExpense,
  updateExpense,
  toggleExpenseActive,
  deleteExpense,
} from '@/app/actions/expenses';
import { useRouter } from 'next/navigation';
import { formatMVR } from '@/lib/currency';

interface Expense {
  id: string;
  name: string;
  dedicated_amount: number | null;
  billing_month: number | null;
  billing_day: number | null;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
}

interface Category {
  id: string;
  name: string;
  type: 'monthly' | 'annual';
  color: string;
  icon: string;
  sort_order: number;
  expenses: Expense[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const COLOR_OPTIONS = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#22c55e', label: 'Green' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#f97316', label: 'Orange' },
  { value: '#84cc16', label: 'Lime' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#a78bfa', label: 'Purple' },
];

const ICON_MAP: Record<string, LucideIcon> = {
  folder: Folder,
  home: Home,
  lock: Lock,
  zap: Zap,
  heart: Heart,
  star: Star,
  briefcase: Briefcase,
  car: Car,
  coffee: Coffee,
  gift: Gift,
  shopping: ShoppingCart,
  food: Utensils,
  wifi: Wifi,
  phone: Phone,
  tv: Tv,
  fuel: Fuel,
  health: Pill,
  travel: Plane,
  book: Book,
  music: Music,
  gaming: Gamepad2,
  clothing: Shirt,
  baby: Baby,
  building: Building,
  tools: Wrench,
  camera: Camera,
  fitness: Dumbbell,
  pets: PawPrint,
  card: CreditCard,
  cash: Banknote,
  bus: Bus,
  train: Train,
  bike: Bike,
  laptop: Laptop,
  shield: Shield,
  flame: Flame,
  globe: Globe,
  scissors: Scissors,
  package: Package,
};

const ICON_KEYS = Object.keys(ICON_MAP);

function IconDisplay({ name, size = 16, className = '' }: { name: string; size?: number; className?: string }) {
  const Icon = ICON_MAP[name] ?? Folder;
  return <Icon size={size} className={className} />;
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[--color-bg-base] border border-[--color-bg-border] text-sm text-[--color-text-primary] hover:border-[--color-accent]/40 transition-colors"
      >
        <IconDisplay name={value} size={15} className="text-[--color-text-secondary]" />
        <span className="flex-1 text-left capitalize">{value}</span>
        <ChevronDown size={13} className={`text-[--color-text-muted] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="absolute z-50 top-full mt-1.5 left-0 right-0 rounded-xl p-2"
          style={{ backgroundColor: '#242434', border: '1px solid #38384f', boxShadow: '0 16px 32px -8px rgba(0,0,0,0.8)' }}
        >
          <div className="grid grid-cols-8 gap-1">
            {ICON_KEYS.map((key) => {
              const selected = value === key;
              return (
                <button
                  key={key}
                  type="button"
                  title={key}
                  onClick={() => { onChange(key); setOpen(false); }}
                  className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                    selected
                      ? 'bg-[--color-accent] text-white'
                      : 'text-[--color-text-secondary] hover:bg-[--color-bg-surface] hover:text-[--color-text-primary]'
                  }`}
                >
                  <IconDisplay name={key} size={15} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_OPTIONS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          onClick={() => onChange(c.value)}
          className="w-7 h-7 rounded-full transition-all flex items-center justify-center flex-shrink-0"
          style={{ background: c.value, boxShadow: value === c.value ? `0 0 0 2px var(--color-bg-surface), 0 0 0 4px ${c.value}` : 'none' }}
        >
          {value === c.value && <Check size={12} className="text-white" strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[--color-danger]/10 border border-[--color-danger]/20 text-xs text-[--color-danger]">
      <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
      {message}
    </div>
  );
}

function CategoryForm({
  initial,
  tab,
  onSave,
  onCancel,
}: {
  initial?: Partial<Category>;
  tab: 'monthly' | 'annual';
  onSave: (data: Partial<Category>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? '#6366f1');
  const [icon, setIcon] = useState(initial?.icon ?? 'folder');
  const [error, setError] = useState('');

  function handleSave() {
    if (!name.trim()) { setError('Name is required'); return; }
    setError('');
    onSave({ name: name.trim(), color, icon, type: tab });
  }

  return (
    <div className="p-4 bg-[--color-bg-surface] rounded-xl border border-[--color-bg-border] space-y-4">
      <div>
        <label className="block text-xs font-medium text-[--color-text-secondary] mb-1.5">Name</label>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="w-full px-3 py-2 rounded-lg bg-[--color-bg-base] border border-[--color-bg-border] text-sm text-[--color-text-primary] focus:outline-none focus:ring-2 focus:ring-[--color-accent]/40 focus:border-[--color-accent] transition-colors"
          placeholder="Category name"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[--color-text-secondary] mb-1.5">Color</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[--color-text-secondary] mb-1.5">Icon</label>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
      </div>
      {error && <ErrorAlert message={error} />}
      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-bg-base] rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-1.5 text-sm bg-[--color-accent] hover:bg-[--color-accent-hover] text-white rounded-lg transition-colors font-medium"
        >
          Save category
        </button>
      </div>
    </div>
  );
}

function ExpenseForm({
  initial,
  categoryId,
  categoryType,
  onSave,
  onCancel,
}: {
  initial?: Partial<Expense>;
  categoryId: string;
  categoryType: 'monthly' | 'annual';
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial?.dedicated_amount?.toString() ?? '');
  const [billingMonth, setBillingMonth] = useState(initial?.billing_month?.toString() ?? '');
  const [billingDay, setBillingDay] = useState(initial?.billing_day?.toString() ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [error, setError] = useState('');

  function handleSave() {
    if (!name.trim()) { setError('Name is required'); return; }
    if (categoryType === 'annual' && !billingMonth) { setError('Billing month is required for annual expenses'); return; }
    setError('');
    onSave({
      category_id: categoryId,
      name: name.trim(),
      dedicated_amount: amount ? parseFloat(amount) : null,
      billing_month: billingMonth ? parseInt(billingMonth) : null,
      billing_day: billingDay ? parseInt(billingDay) : null,
      notes: notes || null,
      is_active: isActive,
    });
  }

  return (
    <div className="p-4 bg-[--color-bg-base] rounded-xl border border-[--color-bg-border] space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-[--color-text-secondary] mb-1.5">Expense name *</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            className="w-full px-3 py-2 rounded-lg bg-[--color-bg-surface] border border-[--color-bg-border] text-sm text-[--color-text-primary] focus:outline-none focus:ring-2 focus:ring-[--color-accent]/40 focus:border-[--color-accent] transition-colors"
            placeholder="e.g. Netflix, Rent, Groceries"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[--color-text-secondary] mb-1.5">Budget (MVR)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[--color-text-muted] font-mono">MVR</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-lg bg-[--color-bg-surface] border border-[--color-bg-border] text-sm text-[--color-text-primary] focus:outline-none focus:ring-2 focus:ring-[--color-accent]/40 focus:border-[--color-accent] transition-colors"
              placeholder="0.00"
            />
          </div>
        </div>
        {categoryType === 'annual' ? (
          <div>
            <label className="block text-xs font-medium text-[--color-text-secondary] mb-1.5">Billing Month *</label>
            <select
              value={billingMonth}
              onChange={(e) => { setBillingMonth(e.target.value); setError(''); }}
              className="w-full px-3 py-2 rounded-lg bg-[--color-bg-surface] border border-[--color-bg-border] text-sm text-[--color-text-primary] focus:outline-none focus:ring-2 focus:ring-[--color-accent]/40 focus:border-[--color-accent] transition-colors"
            >
              <option value="">Select month</option>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-[--color-text-secondary] mb-1.5">Billing Day</label>
            <input
              type="number"
              min="1"
              max="31"
              value={billingDay}
              onChange={(e) => setBillingDay(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[--color-bg-surface] border border-[--color-bg-border] text-sm text-[--color-text-primary] focus:outline-none focus:ring-2 focus:ring-[--color-accent]/40 focus:border-[--color-accent] transition-colors"
              placeholder="Day of month"
            />
          </div>
        )}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-[--color-text-secondary] mb-1.5">Notes</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[--color-bg-surface] border border-[--color-bg-border] text-sm text-[--color-text-primary] focus:outline-none focus:ring-2 focus:ring-[--color-accent]/40 focus:border-[--color-accent] transition-colors"
            placeholder="Optional notes"
            maxLength={1000}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`flex items-center transition-colors ${isActive ? 'text-[--color-success]' : 'text-[--color-text-muted] hover:text-[--color-text-secondary]'}`}
          >
            {isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
          </button>
          <span className="text-xs text-[--color-text-secondary]">
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
      {error && <ErrorAlert message={error} />}
      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-bg-surface] rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-1.5 text-sm bg-[--color-accent] hover:bg-[--color-accent-hover] text-white rounded-lg transition-colors font-medium"
        >
          Save expense
        </button>
      </div>
    </div>
  );
}

function CategoryRow({
  cat,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddExpense,
}: {
  cat: Category;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddExpense: () => void;
}) {
  const activeCount = cat.expenses?.filter((e) => e.is_active).length ?? 0;
  const totalCount = cat.expenses?.length ?? 0;

  return (
    <button
      onClick={onToggleExpand}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left group"
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: cat.color + '22', color: cat.color }}
      >
        <IconDisplay name={cat.icon} size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-[--color-text-primary]">{cat.name}</span>
        <span className="ml-2 text-xs text-[--color-text-muted]">
          {activeCount}/{totalCount} expenses
        </span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1.5 rounded-lg text-[--color-text-muted] hover:text-[--color-text-primary] hover:bg-[--color-bg-base] transition-colors"
          title="Edit category"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-lg text-[--color-text-muted] hover:text-[--color-danger] hover:bg-[--color-danger]/5 transition-colors"
          title="Delete category"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="ml-1 text-[--color-text-muted]">
        {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </div>
    </button>
  );
}

export default function SetupClient({ initialCategories }: { initialCategories: Category[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'monthly' | 'annual'>('monthly');
  const [isPending, startTransition] = useTransition();
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [addingCat, setAddingCat] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [addingExpenseCatId, setAddingExpenseCatId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [pageError, setPageError] = useState('');

  const categories = initialCategories.filter((c) => c.type === activeTab);

  function refresh() {
    router.refresh();
  }

  function toggleExpand(id: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-[--color-bg-elevated] rounded-xl w-fit border border-[--color-bg-border]">
        {(['monthly', 'annual'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setAddingCat(false); setPageError(''); }}
            className={`px-5 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
              activeTab === tab
                ? 'bg-[--color-accent] text-white shadow-sm'
                : 'text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-bg-border]'
            }`}
          >
            {tab === 'monthly' ? 'Monthly' : 'Annual'}
          </button>
        ))}
      </div>

      {pageError && <ErrorAlert message={pageError} />}

      {/* Category list */}
      <div className="space-y-2">
        {categories.length === 0 && !addingCat && (
          <div className="text-center py-10 text-sm text-[--color-text-muted]">
            No {activeTab} categories yet
          </div>
        )}

        {categories.map((cat) => (
          <div
            key={cat.id}
            className="bg-[--color-bg-elevated] border border-[--color-bg-border] rounded-xl overflow-hidden"
            style={{ borderLeft: `3px solid ${cat.color}` }}
          >
            {editingCatId === cat.id ? (
              <div className="p-3">
                <CategoryForm
                  initial={cat}
                  tab={activeTab}
                  onSave={(data) => {
                    startTransition(async () => {
                      const result = await updateCategory(cat.id, data);
                      if (result.error) { setPageError(result.error); return; }
                      setEditingCatId(null);
                      refresh();
                    });
                  }}
                  onCancel={() => setEditingCatId(null)}
                />
              </div>
            ) : (
              <CategoryRow
                cat={cat}
                expanded={expandedCats.has(cat.id)}
                onToggleExpand={() => toggleExpand(cat.id)}
                onEdit={() => { setEditingCatId(cat.id); setExpandedCats((p) => { const n = new Set(p); n.delete(cat.id); return n; }); }}
                onDelete={() => {
                  if (!confirm(`Delete category "${cat.name}"?`)) return;
                  startTransition(async () => {
                    const result = await deleteCategory(cat.id);
                    if (result.hasExpenses) {
                      if (!confirm(result.error + '\n\nDelete anyway and remove all associated data?')) return;
                      await deleteCategoryForce(cat.id);
                    } else if (result.error) {
                      setPageError(result.error);
                      return;
                    }
                    refresh();
                  });
                }}
                onAddExpense={() => {
                  setExpandedCats((p) => new Set([...p, cat.id]));
                  setAddingExpenseCatId(cat.id);
                }}
              />
            )}

            {/* Expense list */}
            {expandedCats.has(cat.id) && editingCatId !== cat.id && (
              <div className="border-t border-[--color-bg-border]">
                {(cat.expenses ?? []).length === 0 && addingExpenseCatId !== cat.id && (
                  <div className="px-4 py-3 text-xs text-[--color-text-muted]">No expenses yet</div>
                )}

                {cat.expenses?.map((exp) => (
                  <div key={exp.id}>
                    {editingExpenseId === exp.id ? (
                      <div className="p-3">
                        <ExpenseForm
                          initial={exp}
                          categoryId={cat.id}
                          categoryType={cat.type}
                          onSave={(data) => {
                            startTransition(async () => {
                              const result = await updateExpense(exp.id, data);
                              if (result.error) { setPageError(result.error); return; }
                              setEditingExpenseId(null);
                              refresh();
                            });
                          }}
                          onCancel={() => setEditingExpenseId(null)}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[--color-bg-border]/40 last:border-0 hover:bg-[--color-bg-surface]/50 transition-colors group">
                        <div className="flex-1 min-w-0">
                          <span
                            className={`text-sm ${
                              exp.is_active
                                ? 'text-[--color-text-primary]'
                                : 'text-[--color-text-muted] line-through'
                            }`}
                          >
                            {exp.name}
                          </span>
                          {cat.type === 'annual' && exp.billing_month != null && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-[--color-accent]/10 text-[--color-accent]">
                              {MONTH_NAMES[exp.billing_month - 1]}
                            </span>
                          )}
                          {exp.billing_day != null && (
                            <span className="ml-1.5 text-xs text-[--color-text-muted]">
                              day {exp.billing_day}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-[--color-text-secondary]">
                          {exp.dedicated_amount != null ? formatMVR(exp.dedicated_amount) : '—'}
                        </span>
                        <button
                          onClick={() => {
                            startTransition(async () => {
                              await toggleExpenseActive(exp.id, !exp.is_active);
                              refresh();
                            });
                          }}
                          className={`p-1 transition-colors ${
                            exp.is_active ? 'text-[--color-success]' : 'text-[--color-text-muted] hover:text-[--color-text-secondary]'
                          }`}
                          title={exp.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {exp.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingExpenseId(exp.id)}
                            className="p-1.5 rounded-lg text-[--color-text-muted] hover:text-[--color-text-primary] hover:bg-[--color-bg-base] transition-colors"
                            title="Edit"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => {
                              if (!confirm(`Delete "${exp.name}"? All logged amounts will be removed.`)) return;
                              startTransition(async () => {
                                const result = await deleteExpense(exp.id, true);
                                if (result.error) { setPageError(result.error); return; }
                                refresh();
                              });
                            }}
                            className="p-1.5 rounded-lg text-[--color-text-muted] hover:text-[--color-danger] hover:bg-[--color-danger]/5 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add expense form / button */}
                <div className="p-3">
                  {addingExpenseCatId === cat.id ? (
                    <ExpenseForm
                      categoryId={cat.id}
                      categoryType={cat.type}
                      onSave={(data) => {
                        startTransition(async () => {
                          const result = await createExpense(data);
                          if (result.error) { setPageError(result.error); return; }
                          setAddingExpenseCatId(null);
                          refresh();
                        });
                      }}
                      onCancel={() => setAddingExpenseCatId(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setAddingExpenseCatId(cat.id)}
                      className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-[--color-text-muted] hover:text-[--color-accent] hover:bg-[--color-accent]/5 rounded-lg transition-colors"
                    >
                      <Plus size={13} />
                      Add expense
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add category form / button */}
        {addingCat ? (
          <CategoryForm
            tab={activeTab}
            onSave={(data) => {
              startTransition(async () => {
                const result = await createCategory(data);
                if (result.error) { setPageError(result.error); return; }
                setAddingCat(false);
                refresh();
              });
            }}
            onCancel={() => setAddingCat(false)}
          />
        ) : (
          <button
            onClick={() => { setAddingCat(true); setPageError(''); }}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-3.5 w-full rounded-xl border border-dashed border-[--color-bg-border] text-sm text-[--color-text-muted] hover:text-[--color-accent] hover:border-[--color-accent]/40 hover:bg-[--color-accent]/[0.03] transition-all disabled:opacity-50"
          >
            <Plus size={15} />
            Add {activeTab} category
          </button>
        )}
      </div>
    </div>
  );
}
