# Contributing to Finlog

Thank you for your interest in contributing. This document covers the development setup, code standards, and process for submitting changes.

---

## Ways to Contribute

- **Bug reports** — something behaves incorrectly or produces unexpected output
- **Feature requests** — ideas that fit within Finlog's scope as a focused personal finance tool
- **Code contributions** — bug fixes, features, or improvements via pull request
- **Documentation** — corrections, clarifications, or additions to this repository's docs

---

## Development Setup

### Prerequisites

- Node.js 20+ (Node 18 is EOL)
- A Supabase project — [free tier](https://supabase.com/pricing) is sufficient
- Git

### Steps

1. Fork the repository and clone your fork
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment template:
   ```bash
   cp .env.local.example .env.local
   ```
4. Fill in all values in `.env.local` — see the [Setup Guide in README.md](README.md#setup-guide)
5. Apply the database schema: paste `supabase/schema.sql` into the Supabase SQL Editor and run it
6. Start the development server:
   ```bash
   npm run dev
   ```

---

## Project Structure

```
app/
  (public)/           # Login page — no authentication required
  (protected)/        # All application pages — require a valid session
    dashboard/
    ledger/
    goals/
    history/
    setup/
    reports/
  actions/            # Server actions — each begins with requireAuth()
  api/                # Route handlers (auth, currency, export, search)
components/
  layout/             # AppShell, search command palette, user settings dialog
  dashboard/          # Dashboard client and chart components
  ledger/             # Ledger client
  goals/              # Goals client
  history/            # History client
  setup/              # Setup client
  reports/            # Reports client and PDF renderer
  shared/             # Small reusable components (CurrencyAmount, LockBadge, etc.)
lib/
  auth/               # Session management (session.ts) and period lock enforcement (lock.ts)
  supabase/           # Server client (service role) and browser client (anon key)
  calculations.ts     # Pure computation functions — no database calls
  validators.ts       # All Zod schemas
supabase/
  schema.sql          # Full database schema — run once per new project
proxy.ts              # Next.js 16 middleware — UX routing only, not a security layer
```

---

## Code Standards

### Security — non-negotiable

Every server action must call `await requireAuth()` as its first line, before any other logic:

```typescript
export async function myAction(data: unknown) {
  await requireAuth(); // Always first — no exceptions
  // ...
}
```

Middleware does not protect server actions. They are independent HTTP endpoints callable by anyone. This is not a convention in Finlog — it is the security model. See `AI_BUILD_PROMPT.md` for the full rationale.

Any action that writes to `expense_logs` must also call `assertPeriodNotLocked(periodId)` immediately after auth.

### Validation

All server action inputs are validated with Zod before any database operation. Schemas are in `lib/validators.ts`. Do not trust user-supplied data at any point before validation.

```typescript
const parsed = MySchema.safeParse(data);
if (!parsed.success) return { data: null, error: 'Invalid input' };
```

### TypeScript

- No `any`. Use `unknown` for external or untyped inputs and narrow with Zod or type guards.
- Supabase join results are inferred as arrays by TypeScript even when the join returns a single object. Cast via `as unknown as TargetType` at the query site rather than working around it elsewhere.

### Styling

Finlog uses Tailwind CSS v4 in CSS-first mode. There is no `tailwind.config.js`. All design tokens are defined in `app/globals.css` under the `@theme` block.

**Overlays (dropdowns, modals, popovers) must use inline style objects with hex values** — not Tailwind CSS variable utility classes:

```tsx
// Correct
<div style={{ backgroundColor: '#1a1a32', borderColor: '#30305a' }}>

// Do not use inside overlays
<div className="bg-[--color-bg-popup]">
```

CSS variables declared in `@theme` do not resolve reliably inside portals and detached DOM layers. This is a known Tailwind v4 behavior, not a styling preference.

### Build gate

Run `npm run build` before opening a pull request. It must complete with zero TypeScript errors. A build that introduces type errors will not be merged.

---

## Pull Request Process

1. Fork the repository
2. Create a branch from `main`:
   ```bash
   git checkout -b your-branch-name
   ```
3. Make your changes
4. Run the build and confirm it is clean:
   ```bash
   npm run build
   ```
5. Open a pull request against `main`

**Your PR description should include:**
- What the change does and the problem it solves
- Any new environment variables introduced
- Any database schema changes (include the migration SQL directly in the PR body — there is no automated migration system)
- Security considerations if the change touches authentication, server actions, or database access

---

## Scope

Finlog is intentionally a focused single-user tool. The following kinds of changes are unlikely to be accepted regardless of implementation quality:

- Multi-user or account registration features
- External service dependencies beyond what is already in use
- Features that duplicate what a dedicated tool (expense tracking app, investment tracker, etc.) does better
- UI complexity that significantly increases the maintenance surface

If you are unsure whether a feature fits, open an issue first and describe the problem you are trying to solve before writing any code.

---

## Reporting Security Issues

Do not open a public GitHub issue for security vulnerabilities.

Send a description to [munfix@pm.me](mailto:munfix@pm.me) with:
- A description of the vulnerability
- Steps to reproduce it
- Your assessment of the potential impact

You will receive a response within 72 hours.

---

## Reporting Bugs

Open a GitHub issue with:
- A clear description of the unexpected behavior
- Steps to reproduce it reliably
- What you expected to happen
- Your environment (OS, Node.js version, browser)

---

## Questions

For general questions about the project or codebase, open a GitHub Discussion rather than an issue. Issues are for tracked work — bugs and accepted feature requests.
