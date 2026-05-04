# Finlog — Architecture Reference

This document is the original design specification written before Finlog was implemented. The security model, authentication architecture, database schema, and feature behavior were defined here first. Claude Code then implemented the codebase from this specification.

## Who this is for

- **Contributors** — understanding the constraints and reasoning behind technical decisions before proposing changes. If you are wondering why something was built a specific way, the rationale is likely in this document.
- **Forks and adaptations** — bootstrapping a similar project with the same security foundations intact.
- **Study** — examining what a complete, upfront specification looks like for a project of this scale, and how it translates to working code.

The key thing to understand about this document's role: the decisions here — three independent security layers, timing-safe login, lockable periods, anomaly detection thresholds — were made before any code existed. This is a design artifact, not a post-hoc description.

---

## Security Architecture

### The Middleware Is Not a Security Boundary

[CVE-2025-29927](https://github.com/advisories/GHSA-f82v-jwr5-mffw) demonstrated that Next.js middleware can be bypassed by sending an `x-middleware-subrequest` header. **Every server action and route handler must verify authentication independently.** Middleware handles UX routing — it is the front door, not the lock on every room. Every room has its own lock.

### The Three Layers

1. **`proxy.ts` (middleware)** — Sends unauthenticated users to `/`. UX only. Not trusted for security.
2. **Server Actions / Route Handlers** — Every function that touches data calls `requireAuth()` first. This is the actual security boundary.
3. **Supabase RLS** — Final defense at the database level. If layers 1 and 2 both fail, the database still rejects the request.

### Environment Variable Rules

- `NEXT_PUBLIC_` prefix = visible in the client bundle. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` use this prefix. These are designed to be public.
- `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `FINLOG_USERNAME`, `FINLOG_PASSWORD` — **never** prefix with `NEXT_PUBLIC_`. They must never appear in any `'use client'` file or browser bundle. Verify: `grep -r "NEXT_PUBLIC_SUPABASE_SERVICE" .` should return nothing.

### Server Actions Are Public HTTP Endpoints

Any `'use server'` function is an HTTP POST endpoint. An attacker can call it directly without going through the UI. Every server action calls `requireAuth()` before doing anything else.

---

## Tech Stack

| Package | Version | Notes |
|---|---|---|
| Node.js | 20.x LTS | Node 18 is EOL as of April 2025 |
| next | 16.2.4 | Fixes CVE-2025-55183/55184/66478 |
| react / react-dom | 19.x | Bundled with Next 16 |
| typescript | 5.x | |
| tailwindcss | 4.x | CSS-first config, no `tailwind.config.js` |
| @tailwindcss/postcss | 4.x | Required for Tailwind v4 PostCSS integration |
| @supabase/supabase-js | 2.103.3 | |
| @supabase/ssr | 0.10.2 | Required for correct SSR cookie handling |
| jose | 6.1.0 | JWT signing and verification |
| recharts | 3.8.1 | |
| @react-pdf/renderer | 4.5.1 | |
| date-fns | 4.x | |
| lucide-react | latest | |
| zod | 3.x | Input validation on all server actions |

**Tailwind v4 note:** There is no `tailwind.config.js`. Configuration is done in `app/globals.css` via `@import "tailwindcss"` and `@theme {}` blocks.

---

## Environment Variables

```env
# .env.local — never commit this file

# Single-user credentials
FINLOG_USERNAME=your_username_here
FINLOG_PASSWORD=your_secure_password_here
SESSION_SECRET=generate_32_random_chars_here

# Supabase — NEXT_PUBLIC_ only for URL and anon key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Service role key — server only
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App URL (used for logout redirect)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Authentication System

### Credential Comparison

Credentials are stored in environment variables and compared server-side using `crypto.timingSafeEqual`. This prevents timing attacks where an attacker could determine whether a username or password was partially correct based on response time.

### Session Token

On successful login, a JWT is issued via `jose`, signed with `SESSION_SECRET` using HS256. It is stored as an `HttpOnly; Secure; SameSite=Strict` cookie named `finlog_session` with a 7-day expiry. Short expiry is appropriate for a personal tool — occasional re-login is acceptable.

```typescript
// lib/auth/session.ts
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!);
const COOKIE_NAME = 'finlog_session';

export async function createSession(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

export async function requireAuth(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !(await jwtVerify(token, SECRET).then(() => true).catch(() => false))) {
    throw new Error('Unauthorized');
  }
}
```

### Login Rate Limiting

The login route uses a simple in-memory rate limiter: 5 attempts per IP per 15 minutes. This resets on server restart, which is acceptable for a personal, self-hosted deployment. The response on rate limit is HTTP 429 with a generic message.

```typescript
// Prevents timing attacks on both credential fields
const userMatch = timingSafeEqual(
  Buffer.from(body.username.padEnd(64)),
  Buffer.from(expectedUser.padEnd(64)),
);
const passMatch = timingSafeEqual(
  Buffer.from(body.password.padEnd(64)),
  Buffer.from(expectedPass.padEnd(64)),
);

// Generic error — never reveal which field is wrong
if (!userMatch || !passMatch) {
  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
}
```

### Middleware (`proxy.ts`)

In Next.js 16, middleware is exported from `proxy.ts` (not `middleware.ts`). This file handles UX redirects and blocks the `x-middleware-subrequest` bypass vector.

```typescript
export async function proxy(request: NextRequest) {
  // Block the CVE-2025-29927 bypass vector
  if (request.headers.get('x-middleware-subrequest')) {
    return new NextResponse(null, { status: 403 });
  }
  // UX redirect — not a security check
  const session = request.cookies.get('finlog_session')?.value;
  if (!session) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}
```

---

## Supabase Client Setup

Two clients are in use. The service role client is used for all data operations in server actions and route handlers. The browser client (anon key) exists for any potential Realtime subscriptions — it has no write access due to RLS.

```typescript
// lib/supabase/server.ts — service role, server only
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Never NEXT_PUBLIC_
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
```

```typescript
// lib/supabase/client.ts — anon key, browser only
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

---

## Database Schema

Run the full schema from `supabase/schema.sql` in the Supabase SQL Editor. Below is a summary of the design decisions.

**Core tables:**

- `categories` — Expense categories with type (`monthly` or `annual`), color, and icon
- `expenses` — Individual expense line items belonging to a category, with optional `dedicated_amount`, `billing_day`, and `billing_month`
- `monthly_periods` — One row per month (format: `YYYY-MM`), storing `total_received`, lock state, and notes
- `expense_logs` — Actual spending per expense per period. Unique constraint on `(period_id, expense_id)`.
- `annual_periods` / `annual_expense_logs` — Mirrors the monthly structure for annual expenses
- `exchange_rates` — Single JSONB row for cached rate data, with a `fetched_at` timestamp for the 24-hour cache check
- `user_profile` — Display name, password hash (unused in current auth model), and `monthly_savings_target`
- `savings_goals` / `goal_contributions` — Savings goal tracking with contribution history
- `income_entries` — Multiple income sources per period beyond the single `total_received` figure

**RLS posture:** All tables have RLS enabled. No policies are defined for the anon role. The absence of a policy means deny-all for any request arriving via the anon key. The service role key bypasses RLS automatically — this is why the service role key must never appear in client-side code.

**Important:** Tables created via raw SQL in Supabase do not automatically receive grants. If adding tables, run explicit `GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO service_role;` after creation, or verify that the service role can access them.

---

## Lock Enforcement

Period locking is enforced server-side, not just in the UI. A helper checks the lock state before any write:

```typescript
// lib/auth/lock.ts
export async function assertPeriodNotLocked(periodId: string): Promise<void> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('monthly_periods')
    .select('is_locked')
    .eq('id', periodId)
    .single();

  if (data?.is_locked) {
    throw new Error('This month is locked. Unlock it first to make changes.');
  }
}
```

`assertPeriodNotLocked` is called after `requireAuth()` in any action that modifies expense logs.

---

## Input Validation

Every server action validates its inputs with Zod before any database operation. The pattern:

```typescript
export async function createCategory(data: unknown) {
  await requireAuth();

  const parsed = CreateCategorySchema.safeParse(data);
  if (!parsed.success) return { data: null, error: 'Invalid input' };

  const supabase = createServerClient();
  const { data: result, error } = await supabase
    .from('categories')
    .insert(parsed.data)
    .select()
    .single();

  return { data: result, error: error?.message ?? null };
}
```

All Zod schemas are centralized in `lib/validators.ts`.

---

## Security Headers

Configured in `next.config.ts` and applied to all routes. In production, HSTS and `upgrade-insecure-requests` are active. In development, they are suppressed to avoid localhost issues.

Headers applied: `Strict-Transport-Security`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and a full `Content-Security-Policy`.

---

## App Structure

```
app/
  (public)/
    page.tsx                    # Login page
  api/
    auth/login/route.ts         # Rate-limited login with timing-safe comparison
    auth/logout/route.ts
    currency/route.ts           # Exchange rate fetch and cache
    export/route.ts             # CSV export
    reports/route.ts
    search/route.ts
  (protected)/
    layout.tsx                  # Protected layout — validates session, passes newMonthPending
    dashboard/page.tsx
    ledger/page.tsx
    goals/page.tsx
    history/page.tsx
    setup/page.tsx
    reports/page.tsx
lib/
  auth/
    session.ts                  # createSession, requireAuth, cookie helpers
    lock.ts                     # assertPeriodNotLocked
  supabase/
    server.ts                   # Service role client (server only)
    client.ts                   # Anon client (browser, Realtime only)
  calculations.ts               # Pure computation functions, no DB calls
  currency.ts
  utils.ts
  validators.ts                 # All Zod schemas
components/
  layout/
    AppShell.tsx                # Brand bar + tab nav + glassmorphism header
    SearchCommand.tsx           # cmdk command palette
    UserSettingsDialog.tsx
  dashboard/
    DashboardClient.tsx
    Charts.tsx
  ledger/LedgerClient.tsx
  goals/GoalsClient.tsx
  history/HistoryClient.tsx
  setup/SetupClient.tsx
  reports/
    ReportsClient.tsx
    PDFExport.tsx
  shared/
    CurrencyAmount.tsx
    LockBadge.tsx
    DeltaBadge.tsx
    PageHeader.tsx
app/
  actions/
    periods.ts
    expenses.ts
    categories.ts
    goals.ts
    income.ts
    annual.ts
    user.ts
proxy.ts                        # Next.js 16 middleware name (not middleware.ts)
next.config.ts                  # Security headers
supabase/schema.sql             # Full database schema
```

---

## Tailwind v4 Setup

No `tailwind.config.js`. Configuration is entirely in `app/globals.css`:

```css
@import 'tailwindcss';

@theme {
  --color-bg-base: #07070f;
  --color-bg-surface: #0c0c1b;
  --color-bg-elevated: #121228;
  --color-bg-popup: #1a1a32;
  --color-bg-popup-border: #30305a;
  --color-bg-border: #22223a;
  --color-bg-input: #0a0a18;
  --color-text-primary: #ededf8;
  --color-text-secondary: #8080a8;
  --color-text-muted: #4e4e6e;
  --color-accent: #6366f1;
  --color-accent-hover: #818cf8;
  --color-success: #22c55e;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;
  --color-mvr: #34d399;
}
```

**Overlay rendering caveat:** CSS variables from `@theme` do not resolve reliably inside portals and detached overlay layers (dropdowns, modals). All overlay components use inline hex style objects instead of Tailwind utility classes for background and border colors. This is a known behavior, not a styling preference.

---

## UI Design System

Dark mode only. The `class="dark"` on the root `<html>` element does not change. No light/dark toggle.

**Layout:** Brand bar (h-14, glassmorphism) + tab navigation bar (h-11) + scrollable main content. No sidebar.

**Typography conventions:**
- Body and UI: Geist Sans
- All currency amounts: `font-mono tabular-nums` — keeps column alignment consistent and signals financial data
- Section labels: `text-[10px] uppercase tracking-widest`

**Component conventions:**
- Cards: `rounded-xl border` with `backgroundColor: '#121228'` and `borderColor: '#22223a'`
- Positive delta: `color: '#22c55e'` with `+` prefix
- Negative delta: `color: '#ef4444'`
- MVR amounts: `color: '#34d399' font-mono tabular-nums`
- Hover transitions: `transition-colors duration-150`

---

## Server Action Specifications

All actions follow this pattern: `requireAuth()` → Zod validation → DB operation → `return { data, error }`.

```typescript
// Periods
createMonthlyPeriod(period: string, totalReceived: number, notes?: string)
updateMonthlyPeriodLock(periodId: string, isLocked: boolean)
copyPreviousMonthLogs(currentPeriodId: string)
resetCurrentMonthLogs(periodId: string)

// Expense logs
upsertExpenseLog(periodId, expenseId, actualAmount, notes?)
  // Requires: requireAuth() then assertPeriodNotLocked(periodId)

// Categories
createCategory(data: unknown)
updateCategory(id: string, data: unknown)
deleteCategory(id: string)
reorderCategories(orderedIds: string[])

// Expenses
createExpense(data: unknown)
updateExpense(id: string, data: unknown)
toggleExpenseActive(id: string, isActive: boolean)
deleteExpense(id: string)
reorderExpenses(orderedIds: string[])

// Annual
upsertAnnualExpenseLog(annualPeriodId, expenseId, actualAmount, paidAt?, notes?)

// Goals
createGoal(data: unknown)
updateGoal(id: string, data: unknown)
deleteGoal(id: string)
addGoalContribution(goalId: string, amount: number, notes?: string)
deleteGoalContribution(id: string, goalId: string)

// Income
createIncomeEntry(periodId: string, source: string, amount: number, notes?: string)
deleteIncomeEntry(id: string)
```

---

## Page Behavior Specifications

### Dashboard (`/dashboard`)

Three view modes toggled by the user: **This Month**, **This Year**, **Overall**.

**This Month KPIs:** Total Received, Total Spent, Total Saved (with savings rate %), Safe-to-Spend

Safe-to-spend = `total_received − total_budgeted − savings_target`. Only displayed when `total_budgeted > 0` to avoid showing a meaningless figure before any budget is set.

**This Year KPIs:** YTD Received, YTD Spent, YTD Saved, Avg. Monthly Savings (with best-month callout)

**Overall KPIs:** All-time Received, All-time Spent, All-time Saved (with lifetime savings rate), Months Tracked

**Anomaly detection:** Flags any category where current-month spend exceeds 150% of its average over the previous 3 months. Requires at least 1 prior month with data for that category.

**Upcoming bills:** Expenses with a `billing_day` set on categories of type `monthly`, due within the next 7 calendar days.

**Charts — This Month:** Donut (spend by category) + horizontal bar (dedicated vs. actual, only where `dedicated_amount` is set)

**Charts — This Year:** Line (received vs. spent, Jan–Dec) + area (monthly savings)

**Charts — Overall:** Bar (spend per month, last 12 months) + line (cumulative savings)

### Ledger (`/ledger`)

Month navigation with left/right arrows. Forward months are not allowed.

**State 1 — No period for this month:** Income entry prompt visible. Expense list is rendered but non-interactive behind the prompt. Past months can be created retroactively.

**State 2 — Period exists, unlocked:** Category sections (collapsible, expanded by default). Each expense row has: name, dedicated amount, actual input (auto-saves after 800 ms debounce), delta badge (only shown when both dedicated and actual are set), notes.

**State 3 — Locked period:** Read-only. A lock banner is shown. Lock/unlock button is always accessible regardless of state.

Annual expenses appear in the ledger only during their `billing_month`.

### Setup (`/setup`)

Two tabs: Monthly and Annual. Category management with color and icon pickers. Expense rows show dedicated amount, active toggle, and billing configuration. Drag-to-reorder for both categories and expenses within a category.

### History (`/history`)

Searchable by expense name. Filterable by category and period. Paginated at 50 rows per page. Client-side filtering via `useMemo`.

### Goals (`/goals`)

Savings goals with color-coded progress bars. Contribution history per goal (expandable). Add, edit, and delete goals. Add and delete individual contributions.

### Reports (`/reports`)

Period selector → preview table → export as CSV or PDF. PDF is generated client-side via `@react-pdf/renderer`. Monospace font for all financial figures.

---

## Calculations (`lib/calculations.ts`)

Pure TypeScript functions with no side effects and no database calls. All dashboard and ledger math runs through these.

Key functions:
- `computeDelta(expense)` — returns `dedicated - actual`, or `null` if either is unset
- `computePeriodSummary(totalReceived, expenses)` — returns `{ totalLogged, totalDedicated, totalSaved, overBudgetCount }`

---

## Edge Cases and Design Decisions

1. **Soft-delete for expenses:** `is_active = false` rather than hard deletion. Historical logs reference the expense row — deleting it orphans the history. Hard delete is available on explicit confirmation only. Inactive expenses show a `[Deleted]` label in historical views.

2. **NULL `dedicated_amount`:** Treated as "no budget set." Never coerced to 0 in aggregations. The delta badge and budget comparison only appear when both dedicated and actual amounts are present.

3. **Annual expenses in monthly ledger:** Queried with `WHERE categories.type = 'annual' AND expenses.billing_month = <current_month>`. They carry an "Annual" badge in the ledger row to distinguish them visually.

4. **Past month retroactive entry:** Allowed. Future month creation: blocked.

5. **Recharts in App Router:** All Recharts components must be in `'use client'` files. Wrap in `dynamic(() => import(...), { ssr: false })` if hydration errors surface.

6. **Supabase join type inference:** TypeScript infers join results as arrays even when the join is expected to return a single object. Cast via `as unknown as TargetType` at the query site.

7. **New month detection:** The protected layout queries for the current `YYYY-MM` period on every server render. `newMonthPending: boolean` is passed through React context. Only the Ledger page acts on this — other pages are never blocked.

---

## Initial Setup (Fresh Fork)

For someone starting from this codebase on a fresh Supabase project:

1. `npx create-next-app@latest` with TypeScript, App Router, no Tailwind (add manually)
2. Install Tailwind v4: `npm install tailwindcss @tailwindcss/postcss`
3. Configure `postcss.config.mjs`
4. `npx shadcn@latest init` — select Tailwind v4, dark, zinc base color
5. Install remaining dependencies: `npm install @supabase/supabase-js @supabase/ssr jose zod recharts @react-pdf/renderer date-fns lucide-react cmdk`
6. Set up `next.config.ts` with security headers
7. Set up `proxy.ts` with route protection and the subrequest block
8. Set up `lib/auth/session.ts`, login route, logout route
9. Set up `lib/supabase/server.ts` and `lib/supabase/client.ts`
10. Create `lib/validators.ts` with Zod schemas
11. Run `supabase/schema.sql` in the Supabase SQL Editor
12. Build App Shell: layout, navigation
13. Build server actions (CRUD with `requireAuth()` at the top of each)
14. Build pages in order: Setup → Ledger → Dashboard → Goals → History → Reports

---

## Security Checklist

Run through this before deploying to production:

- [ ] `.env.local` is not tracked by git — run `git status` to verify
- [ ] `grep -r "NEXT_PUBLIC_SUPABASE_SERVICE" .` returns nothing
- [ ] `grep -r "SESSION_SECRET" ./app` returns nothing (only `lib/auth/` should reference it)
- [ ] Every server action starts with `await requireAuth()`
- [ ] Every action writing to `expense_logs` calls `assertPeriodNotLocked(periodId)`
- [ ] `proxy.ts` blocks the `x-middleware-subrequest` header
- [ ] Session cookie has `httpOnly: true`, `sameSite: 'strict'`, `secure: true` in production
- [ ] `SUPABASE_SERVICE_ROLE_KEY` does not appear in any `'use client'` file
- [ ] RLS is enabled on all tables — verify in Supabase Dashboard → Table Editor
- [ ] Security headers are visible in production — check via browser DevTools → Network → response headers
- [ ] Login rate limiting is active: 5 attempts per 15 minutes per IP
- [ ] `SESSION_SECRET` is at least 32 characters of random data
