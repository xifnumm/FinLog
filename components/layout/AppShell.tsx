'use client';

import { createContext, useContext, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search, ChevronDown, LogOut, Settings,
  LayoutDashboard, BookOpen, Settings2, BarChart3,
  Clock, Target,
} from 'lucide-react';
import SearchCommand from './SearchCommand';
import UserSettingsDialog from './UserSettingsDialog';

interface AppContextValue {
  newMonthPending: boolean;
}

const AppContext = createContext<AppContextValue>({ newMonthPending: false });

export function useAppContext() {
  return useContext(AppContext);
}

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/ledger',    label: 'Ledger',    icon: BookOpen },
  { href: '/history',   label: 'History',   icon: Clock },
  { href: '/goals',     label: 'Goals',     icon: Target },
  { href: '/setup',     label: 'Setup',     icon: Settings2 },
  { href: '/reports',   label: 'Reports',   icon: BarChart3 },
];

const POPUP_STYLE: React.CSSProperties = {
  backgroundColor: '#1a1a32',
  borderColor: '#30305a',
};

export default function AppShell({
  children,
  newMonthPending,
  displayName,
}: {
  children: React.ReactNode;
  newMonthPending: boolean;
  displayName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <AppContext.Provider value={{ newMonthPending }}>
      <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: '#07070f' }}>

        {/* ── Brand bar ─────────────────────────────────────────────────────── */}
        <header
          className="flex-shrink-0 h-14 flex items-center px-4 md:px-6 border-b"
          style={{
            backgroundColor: 'rgba(12,12,27,0.92)',
            backdropFilter: 'blur(12px)',
            borderColor: '#22223a',
          }}
        >
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0 select-none">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 11V3h4a3 3 0 0 1 0 6H2" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 7h3" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight" style={{ color: '#ededf8' }}>
              Fin<span style={{ color: '#818cf8' }}>log</span>
            </span>
          </Link>

          {/* Center — search */}
          <div className="flex-1 flex justify-center px-4">
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center gap-3 w-64 md:w-80 px-3.5 py-2 rounded-lg border text-sm transition-all"
              style={{
                backgroundColor: '#0a0a18',
                borderColor: '#22223a',
                color: '#4e4e6e',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#30305a'; e.currentTarget.style.color = '#8080a8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#22223a'; e.currentTarget.style.color = '#4e4e6e'; }}
            >
              <Search size={13} className="flex-shrink-0" />
              <span className="flex-1 text-left text-xs">Search…</span>
              <kbd
                className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-mono leading-none"
                style={{ backgroundColor: '#1a1a32', border: '1px solid #30305a', color: '#4e4e6e' }}
              >
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setSearchOpen(true)}
              className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: '#4e4e6e' }}
              aria-label="Search"
            >
              <Search size={17} />
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 pl-2 pr-2 py-1.5 rounded-lg transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#121228')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(129,140,248,0.25) 100%)',
                    border: '1px solid rgba(99,102,241,0.35)',
                  }}
                >
                  <span className="text-[10px] font-bold" style={{ color: '#818cf8' }}>{initials}</span>
                </div>
                <span className="hidden md:block text-sm font-medium max-w-[120px] truncate" style={{ color: '#ededf8' }}>
                  {displayName}
                </span>
                <ChevronDown
                  size={13}
                  className={`hidden md:block transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`}
                  style={{ color: '#4e4e6e' }}
                />
              </button>

              {dropdownOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-52 rounded-xl border shadow-2xl overflow-hidden z-50 animate-slide-up"
                  style={POPUP_STYLE}
                >
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid #30305a' }}>
                    <div className="text-sm font-medium truncate" style={{ color: '#ededf8' }}>{displayName}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#4e4e6e' }}>Personal account</div>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <button
                      onClick={() => { setDropdownOpen(false); setSettingsOpen(true); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm transition-colors"
                      style={{ color: '#8080a8' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#121228'; e.currentTarget.style.color = '#ededf8'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = '#8080a8'; }}
                    >
                      <Settings size={14} />
                      Account Settings
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm transition-colors"
                      style={{ color: '#8080a8' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = '#8080a8'; }}
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Tab nav ───────────────────────────────────────────────────────── */}
        <nav
          className="flex-shrink-0 h-11 border-b overflow-x-auto tab-nav-scroll"
          style={{ backgroundColor: '#0c0c1b', borderColor: '#22223a' }}
        >
          <div className="flex items-center h-full min-w-full justify-center px-2">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative flex items-center gap-1.5 px-3.5 md:px-4 h-full text-xs font-medium whitespace-nowrap transition-all duration-150"
                  style={{ color: active ? '#818cf8' : '#8080a8' }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#ededf8'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#8080a8'; }}
                >
                  <Icon size={13} className="flex-shrink-0" />
                  <span>{label}</span>
                  {active && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                      style={{ background: 'linear-gradient(90deg, #6366f1, #818cf8)' }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* ── Page content ──────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#07070f' }}>
          {children}
        </main>
      </div>

      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
      <UserSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialName={displayName}
      />
    </AppContext.Provider>
  );
}
