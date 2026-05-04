'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.get('username'),
          password: form.get('password'),
        }),
      });

      if (res.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Invalid credentials');
      }
    });
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[--color-bg-base] overflow-hidden">
      {/* Animated grid background */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" aria-hidden>
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Glow orb */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
        style={{
          background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)',
          animation: 'pulse 6s ease-in-out infinite',
        }}
        aria-hidden
      />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.06; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.12; transform: translate(-50%, -50%) scale(1.08); }
        }
      `}</style>

      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-[--color-bg-elevated] border border-[--color-bg-border] rounded-2xl p-8 shadow-2xl">
          {/* Wordmark */}
          <div className="mb-8 text-center">
            <span className="text-3xl font-semibold tracking-tight text-[--color-text-primary]">
              Fin<span className="text-[--color-accent]">log</span>
            </span>
            <p className="mt-1 text-sm text-[--color-text-muted]">Personal budget planner</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-medium text-[--color-text-secondary] mb-1.5"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="w-full px-3 py-2.5 rounded-lg bg-[--color-bg-surface] border border-[--color-bg-border] text-[--color-text-primary] text-sm placeholder-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--color-accent] focus:border-transparent transition-colors duration-150"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[--color-text-secondary] mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full px-3 py-2.5 rounded-lg bg-[--color-bg-surface] border border-[--color-bg-border] text-[--color-text-primary] text-sm placeholder-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--color-accent] focus:border-transparent transition-colors duration-150"
              />
            </div>

            {error && (
              <p className="text-sm text-[--color-danger] text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 rounded-lg bg-[--color-accent] hover:bg-[--color-accent-hover] text-white text-sm font-medium transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
