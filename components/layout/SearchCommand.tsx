'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  Search, LayoutDashboard, BookOpen, Settings2,
  BarChart3, DollarSign, Tag, Calendar,
} from 'lucide-react';
import { format, parse } from 'date-fns';

const PAGES = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, desc: 'Overview & charts' },
  { id: 'ledger', label: 'Ledger', href: '/ledger', icon: BookOpen, desc: 'Monthly expense tracking' },
  { id: 'setup', label: 'Setup', href: '/setup', icon: Settings2, desc: 'Categories & expenses' },
  { id: 'reports', label: 'Reports', href: '/reports', icon: BarChart3, desc: 'Export PDF & CSV' },
];

interface SearchResult {
  expenses: { id: string; name: string; categories: { name: string; color: string } | null }[];
  categories: { id: string; name: string; color: string; type: string }[];
  periods: { id: string; period: string; label: string; total_received: number }[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function SearchCommand({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({ expenses: [], categories: [], periods: [] });
  const [loading, setLoading] = useState(false);

  // Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape') onOpenChange(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) { setQuery(''); setResults({ expenses: [], categories: [], periods: [] }); }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults({ expenses: [], categories: [], periods: [] }); return; }
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => { setResults(d); setLoading(false); })
      .catch(() => setLoading(false));
    return () => controller.abort();
  }, [query]);

  const navigate = useCallback((href: string) => {
    router.push(href);
    onOpenChange(false);
  }, [router, onOpenChange]);

  const filteredPages = PAGES.filter(
    (p) => !query || p.label.toLowerCase().includes(query.toLowerCase()),
  );

  const hasResults =
    filteredPages.length > 0 ||
    results.expenses.length > 0 ||
    results.categories.length > 0 ||
    results.periods.length > 0;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ backgroundColor: 'rgba(0,0,0,0.82)' }}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl mx-4 rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#242434',
          border: '1px solid #38384f',
          boxShadow: '0 32px 64px -12px rgba(0,0,0,0.9), 0 0 0 1px rgba(99,102,241,0.12)',
        }}
      >
        <Command shouldFilter={false}>
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid #38384f' }}>
            {loading ? (
              <div className="w-4 h-4 border-2 border-[--color-accent] border-t-transparent rounded-full animate-spin flex-shrink-0" />
            ) : (
              <Search size={16} className="text-[--color-text-muted] flex-shrink-0" />
            )}
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search pages, expenses, categories…"
              className="flex-1 bg-transparent text-[--color-text-primary] placeholder-[--color-text-muted] text-sm outline-none"
            />
            <kbd className="hidden sm:block text-[10px] text-[--color-text-muted] px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: '#16161f', border: '1px solid #38384f' }}>
              ESC
            </kbd>
          </div>

          {/* Results */}
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            {!hasResults && query && !loading && (
              <Command.Empty className="py-10 text-center text-sm text-[--color-text-muted]">
                No results for &ldquo;{query}&rdquo;
              </Command.Empty>
            )}

            {/* Pages */}
            {filteredPages.length > 0 && (
              <Command.Group>
                <div className="px-2 py-1.5 text-[10px] font-semibold text-[--color-text-muted] uppercase tracking-wider">
                  {query ? 'Pages' : 'Quick Navigation'}
                </div>
                {filteredPages.map((page) => (
                  <Command.Item
                    key={page.id}
                    value={page.id}
                    onSelect={() => navigate(page.href)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer hover:bg-white/5 data-[selected=true]:bg-[--color-accent]/15 data-[selected=true]:text-[--color-accent] transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-white/5 group-data-[selected=true]:bg-[--color-accent]/20 flex items-center justify-center flex-shrink-0 transition-colors">
                      <page.icon size={14} className="text-[--color-text-muted] group-data-[selected=true]:text-[--color-accent]" />
                    </div>
                    <div>
                      <div className="text-[--color-text-primary] group-data-[selected=true]:text-[--color-accent] font-medium">
                        {page.label}
                      </div>
                      <div className="text-xs text-[--color-text-muted]">{page.desc}</div>
                    </div>
                    <span className="ml-auto text-xs text-[--color-text-muted] opacity-0 group-data-[selected=true]:opacity-100 transition-opacity">
                      ↵
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Expenses */}
            {results.expenses.length > 0 && (
              <Command.Group>
                <div className="px-2 py-1.5 text-[10px] font-semibold text-[--color-text-muted] uppercase tracking-wider mt-1">
                  Expenses
                </div>
                {results.expenses.map((e) => (
                  <Command.Item
                    key={e.id}
                    value={`expense-${e.id}`}
                    onSelect={() => navigate('/setup')}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer hover:bg-white/5 data-[selected=true]:bg-[--color-accent]/15 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                      <DollarSign size={13} className="text-[--color-text-muted]" />
                    </div>
                    <div>
                      <div className="text-[--color-text-primary] font-medium">{e.name}</div>
                      {e.categories && (
                        <div className="flex items-center gap-1.5 text-xs text-[--color-text-muted]">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: e.categories.color }}
                          />
                          {e.categories.name}
                        </div>
                      )}
                    </div>
                    <span className="ml-auto text-xs text-[--color-text-muted]">Setup</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Categories */}
            {results.categories.length > 0 && (
              <Command.Group>
                <div className="px-2 py-1.5 text-[10px] font-semibold text-[--color-text-muted] uppercase tracking-wider mt-1">
                  Categories
                </div>
                {results.categories.map((c) => (
                  <Command.Item
                    key={c.id}
                    value={`cat-${c.id}`}
                    onSelect={() => navigate('/setup')}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer hover:bg-white/5 data-[selected=true]:bg-[--color-accent]/15 transition-colors"
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${c.color}20` }}
                    >
                      <Tag size={13} style={{ color: c.color }} />
                    </div>
                    <div>
                      <div className="text-[--color-text-primary] font-medium">{c.name}</div>
                      <div className="text-xs text-[--color-text-muted] capitalize">{c.type}</div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Periods */}
            {results.periods.length > 0 && (
              <Command.Group>
                <div className="px-2 py-1.5 text-[10px] font-semibold text-[--color-text-muted] uppercase tracking-wider mt-1">
                  Months
                </div>
                {results.periods.map((p) => (
                  <Command.Item
                    key={p.id}
                    value={`period-${p.id}`}
                    onSelect={() => navigate(`/ledger?month=${p.period}`)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer hover:bg-white/5 data-[selected=true]:bg-[--color-accent]/15 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Calendar size={13} className="text-[--color-text-muted]" />
                    </div>
                    <div className="text-[--color-text-primary] font-medium">{p.label}</div>
                    <span className="ml-auto text-xs text-[--color-text-muted]">Ledger →</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
