'use client';

import { useState, useTransition, useEffect } from 'react';
import { X, User, Lock, Settings, Check, Loader2, RefreshCw, Download, AlertTriangle } from 'lucide-react';
import { updateDisplayName, updatePassword, getUserProfile, updateSavingsTarget } from '@/app/actions/user';
import { resetCurrentMonthLogs } from '@/app/actions/periods';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

type Tab = 'profile' | 'security' | 'app';

interface Props {
  open: boolean;
  onClose: () => void;
  initialName: string;
}

const MAJOR_CURRENCIES = ['eur', 'gbp', 'jpy', 'sgd', 'aud', 'cad', 'aed', 'inr', 'myr'];
const MVR_PER_USD = 15.42;

function ProfileTab({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  function handleSave() {
    setError(''); setStatus('idle');
    startTransition(async () => {
      const result = await updateDisplayName(name);
      if (result.error) { setError(result.error); setStatus('error'); }
      else { setStatus('saved'); router.refresh(); setTimeout(() => setStatus('idle'), 2500); }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[--color-text-secondary] mb-1.5">Display Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="w-full px-3 py-2.5 rounded-lg text-sm text-[--color-text-primary] focus:outline-none focus:ring-2 focus:ring-[--color-accent]/40 transition-colors"
          style={{ backgroundColor: '#1a1a28', border: '1px solid #38384f' }}
          placeholder="Your name"
          maxLength={50}
        />
        {error && <p className="mt-1.5 text-xs text-[--color-danger]">{error}</p>}
      </div>
      <button
        onClick={handleSave}
        disabled={isPending || !name.trim() || status === 'saved'}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[--color-accent] hover:bg-[--color-accent-hover] text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : status === 'saved' ? <Check size={14} /> : null}
        {status === 'saved' ? 'Saved!' : 'Save Name'}
      </button>
    </div>
  );
}

function SecurityTab() {
  const [isPending, startTransition] = useTransition();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');

  function handleSave() {
    setError(''); setStatus('idle');
    if (next !== confirm) { setError('Passwords do not match'); return; }
    startTransition(async () => {
      const result = await updatePassword(current, next);
      if (result.error) { setError(result.error); }
      else {
        setStatus('saved');
        setCurrent(''); setNext(''); setConfirm('');
        setTimeout(() => setStatus('idle'), 2500);
      }
    });
  }

  return (
    <div className="space-y-3">
      {[
        ['Current password', current, setCurrent, 'current-password'],
        ['New password', next, setNext, 'new-password'],
        ['Confirm new password', confirm, setConfirm, 'new-password'],
      ].map(([label, value, setter, autocomplete]) => (
        <div key={label as string}>
          <label className="block text-xs font-medium text-[--color-text-secondary] mb-1.5">{label as string}</label>
          <input
            type="password"
            value={value as string}
            onChange={(e) => (setter as (v: string) => void)(e.target.value)}
            autoComplete={autocomplete as string}
            className="w-full px-3 py-2.5 rounded-lg text-sm text-[--color-text-primary] focus:outline-none focus:ring-2 focus:ring-[--color-accent]/40 focus:border-[--color-accent] transition-colors"
            placeholder="••••••••"
          />
        </div>
      ))}
      {error && <p className="text-xs text-[--color-danger]">{error}</p>}
      <button
        onClick={handleSave}
        disabled={isPending || !current || !next || !confirm}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[--color-accent] hover:bg-[--color-accent-hover] text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : status === 'saved' ? <Check size={14} /> : null}
        {status === 'saved' ? 'Password updated!' : 'Update Password'}
      </button>
    </div>
  );
}

function AppSettingsTab() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [loadingRates, setLoadingRates] = useState(true);
  const [ratesError, setRatesError] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Savings target
  const [savingsTarget, setSavingsTarget] = useState('');
  const [savingsStatus, setSavingsStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [savingsError, setSavingsError] = useState('');

  useEffect(() => {
    getUserProfile().then(({ monthly_savings_target }) => {
      if (monthly_savings_target != null) setSavingsTarget(monthly_savings_target.toString());
    });
  }, []);

  async function handleSaveSavingsTarget() {
    setSavingsError(''); setSavingsStatus('idle');
    const parsed = savingsTarget === '' ? null : parseFloat(savingsTarget);
    if (savingsTarget !== '' && (isNaN(parsed as number) || (parsed as number) < 0)) {
      setSavingsError('Enter a valid positive amount'); return;
    }
    startTransition(async () => {
      const result = await updateSavingsTarget(parsed);
      if (result.error) { setSavingsError(result.error); setSavingsStatus('error'); }
      else { setSavingsStatus('saved'); router.refresh(); setTimeout(() => setSavingsStatus('idle'), 2500); }
    });
  }

  async function fetchRates() {
    setRatesError(''); setLoadingRates(true);
    try {
      const res = await fetch('/api/currency');
      if (!res.ok) throw new Error();
      const d = await res.json();
      setRates(d.rates);
    } catch {
      setRatesError('Failed to load exchange rates');
    } finally {
      setLoadingRates(false);
    }
  }

  useEffect(() => { fetchRates(); }, []);

  async function handleExport() {
    const res = await fetch('/api/export');
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finlog-export-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleReset() {
    setResetError(''); setResetSuccess(false);
    const result = await resetCurrentMonthLogs(resetConfirm);
    if (result.error) { setResetError(result.error); }
    else { setResetSuccess(true); setResetConfirm(''); router.refresh(); }
  }

  const displayCurrencies = rates
    ? MAJOR_CURRENCIES.filter((c) => rates[c] != null).map((c) => ({
        code: c.toUpperCase(),
        rateVsUsd: rates[c],
        per100mvr: (100 / MVR_PER_USD) * rates[c],
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Monthly savings target */}
      <div>
        <h3 className="text-xs font-semibold text-[--color-text-secondary] uppercase tracking-wider mb-3">Monthly Savings Target</h3>
        <p className="text-xs text-[--color-text-muted] mb-3">
          Set a target and the dashboard will show if you&apos;re on track each month. Leave blank to disable.
        </p>
        <div className="flex gap-2 items-start">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[--color-text-muted]">MVR</span>
            <input
              type="number"
              min="0"
              value={savingsTarget}
              onChange={(e) => setSavingsTarget(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveSavingsTarget()}
              className="w-full pl-12 pr-3 py-2.5 rounded-lg text-sm font-mono text-[--color-text-primary] focus:outline-none focus:ring-2 focus:ring-[--color-accent]/40 transition-colors"
              style={{ backgroundColor: '#1a1a28', border: '1px solid #38384f' }}
              placeholder="0.00"
            />
          </div>
          <button
            onClick={handleSaveSavingsTarget}
            disabled={isPending || savingsStatus === 'saved'}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[--color-accent] hover:bg-[--color-accent-hover] text-white text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : savingsStatus === 'saved' ? <Check size={14} /> : null}
            {savingsStatus === 'saved' ? 'Saved!' : 'Save'}
          </button>
        </div>
        {savingsError && <p className="mt-1.5 text-xs text-[--color-danger]">{savingsError}</p>}
      </div>

      {/* Exchange rates */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[--color-text-secondary] uppercase tracking-wider">Exchange Rates</h3>
          <button
            onClick={fetchRates}
            disabled={loadingRates}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-[--color-text-secondary] hover:text-[--color-text-primary] transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#1a1a28', border: '1px solid #38384f' }}
          >
            <RefreshCw size={11} className={loadingRates ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
        {ratesError && <p className="text-xs text-[--color-danger] mb-2">{ratesError}</p>}
        {loadingRates ? (
          <div className="flex items-center gap-2 py-3 text-xs text-[--color-text-muted]">
            <Loader2 size={12} className="animate-spin" />
            Loading rates…
          </div>
        ) : displayCurrencies.length === 0 ? (
          <p className="text-xs text-[--color-text-muted]">No cached rates. Click Refresh to fetch.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid #38384f' }}>
                {['Currency', 'Rate (USD)', '100 MVR ≈'].map((h) => (
                  <th key={h} className="text-left py-1.5 font-medium text-[--color-text-muted] last:text-right">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayCurrencies.map(({ code, rateVsUsd, per100mvr }) => (
                <tr key={code} className="border-b border-[--color-bg-border]/30 last:border-0">
                  <td className="py-1.5 font-medium text-[--color-text-primary]">{code}</td>
                  <td className="py-1.5 font-mono text-[--color-text-secondary]">{rateVsUsd.toFixed(4)}</td>
                  <td className="py-1.5 font-mono text-[--color-text-secondary] text-right">{per100mvr.toFixed(2)} {code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Data export */}
      <div>
        <h3 className="text-xs font-semibold text-[--color-text-secondary] uppercase tracking-wider mb-3">Data Export</h3>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[--color-text-secondary] hover:text-[--color-text-primary] transition-colors"
          style={{ backgroundColor: '#1a1a28', border: '1px solid #38384f' }}
        >
          <Download size={13} />
          Export all data as JSON
        </button>
      </div>

      {/* Danger zone */}
      <div className="border border-[--color-danger]/25 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-[--color-danger] flex items-center gap-1.5">
          <AlertTriangle size={12} />
          Danger Zone
        </h3>
        <p className="text-xs text-[--color-text-muted]">
          Reset all expense logs for the current month. This cannot be undone.
        </p>
        <div>
          <label className="block text-xs text-[--color-text-secondary] mb-1.5">
            Type <span className="font-mono text-[--color-danger]">RESET</span> to confirm
          </label>
          <input
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm font-mono text-[--color-text-primary] focus:outline-none focus:ring-2 focus:ring-[--color-danger]/40 transition-colors"
            style={{ backgroundColor: '#1a1a28', border: '1px solid #38384f' }}
            placeholder="RESET"
          />
        </div>
        {resetError && <p className="text-xs text-[--color-danger]">{resetError}</p>}
        {resetSuccess && <p className="text-xs text-[--color-success]">Month logs reset successfully.</p>}
        <button
          onClick={handleReset}
          disabled={resetConfirm !== 'RESET'}
          className="px-3 py-1.5 rounded-lg bg-[--color-danger] hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Reset Current Month Logs
        </button>
      </div>
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'app', label: 'App Settings', icon: Settings },
];

export default function UserSettingsDialog({ open, onClose, initialName }: Props) {
  const [tab, setTab] = useState<Tab>('profile');

  useEffect(() => {
    if (open) setTab('profile');
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.82)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: '#242434',
          border: '1px solid #38384f',
          boxShadow: '0 32px 64px -12px rgba(0,0,0,0.9)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #38384f' }}>
          <h2 className="text-sm font-semibold text-[--color-text-primary]">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[--color-text-muted] hover:text-[--color-text-primary] hover:bg-[--color-bg-border] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab row */}
        <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid #38384f', backgroundColor: '#1a1a28' }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-[--color-accent] text-[--color-accent]'
                  : 'border-transparent text-[--color-text-secondary] hover:text-[--color-text-primary]'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {tab === 'profile' && <ProfileTab initialName={initialName} />}
          {tab === 'security' && <SecurityTab />}
          {tab === 'app' && <AppSettingsTab />}
        </div>
      </div>
    </div>
  );
}
