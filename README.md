# Finlog

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-2-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Built with Claude Code](https://img.shields.io/badge/built%20with-Claude%20Code-cc785c.svg)](https://claude.ai/code)

A self-hosted personal budget planner with a deliberately layered security model. Track monthly income and expenses, visualize spending patterns, manage savings goals — deployed on your own infrastructure, owned entirely by you.

> **Single-user by design.** Finlog has no multi-tenant model, no account registration, and no third-party auth services. You own the deployment, the credentials, and the data.

---

## Features

**Budget & Ledger**

- Monthly periods with income tracking and auto-saving expense logs (800 ms debounce)
- Per-category budget allocation with dedicated vs. actual comparison
- Budget threshold badges at 80% and 100% of category spend
- Lock and unlock periods to finalize closed months

**Dashboard & Analytics**

- Month / Year / All-time view modes, each with contextual KPIs
- Safe-to-spend: income minus total budgeted minus savings target — forward-looking, not backward
- Spending anomaly detection — flags any category running above 150% of its 3-month rolling average
- Upcoming billing alerts for expenses due within the next 7 days
- Month-over-month trend badges on all key figures
- Category health grid with progress bars and per-category budget utilization

**Goals & History**

- Savings goals with contribution history and visual progress tracking
- Full expense history with full-text search and filters by category and period
- CSV and PDF export with per-period summaries

**Infrastructure**

- Command palette — `Ctrl+K` / `⌘K`
- Exchange rates via [fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api) — completely free, no API key, cached 24 hours in Supabase
- Deploys to Vercel with no configuration changes required

---

## Security Model

Finlog is built with three independent security layers. The design ensures that no single point of failure exposes your data.

| Layer                       | Mechanism                                     | Purpose                                                                       |
| --------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| `proxy.ts` (middleware)     | Session cookie check                          | UX redirect — sends unauthenticated requests to login                         |
| Server actions & API routes | `requireAuth()` called first in every handler | Actual enforcement — rejects unauthorized calls regardless of how they arrive |
| Supabase Row Level Security | No anon-key policies on any table             | Last line of defense — anon key has zero table access                         |

This three-layer model was a direct response to [CVE-2025-29927](https://github.com/advisories/GHSA-f82v-jwr5-mffw), which demonstrated that Next.js middleware can be bypassed by a crafted request header. Treating middleware as the sole security boundary is not sufficient — every server action is an independently authenticated HTTP endpoint.

**Additional hardening:**

- Timing-safe credential comparison (`crypto.timingSafeEqual`) to prevent timing-based login attacks
- Login rate limiting: 5 attempts per 15 minutes per IP address
- JWTs signed with `SESSION_SECRET`, stored in `HttpOnly; SameSite=Strict` cookies with 7-day expiry
- Security response headers: HSTS, CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
- `x-middleware-subrequest` header blocked at the middleware level

---

## Prerequisites

| Requirement            | Notes                                                   |
| ---------------------- | ------------------------------------------------------- |
| Node.js 20+            | Node 18 reached end-of-life in April 2025               |
| Supabase account       | [Free tier](https://supabase.com/pricing) is sufficient |
| Vercel account         | [Free tier](https://vercel.com/pricing) for deployment  |
| No additional API keys | Exchange rates use a free, unauthenticated service      |

---

## Quick Start

```bash
git clone https://github.com/your-username/finlog.git
cd finlog
npm install
cp .env.local.example .env.local
# Fill in .env.local — see the Setup Guide below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will see the login page.

---

## Setup Guide

### 1. Environment variables

Copy `.env.local.example` to `.env.local` and fill in every value:

| Variable                        | Description                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `FINLOG_USERNAME`               | Your login username                                                           |
| `FINLOG_PASSWORD`               | Your login password                                                           |
| `SESSION_SECRET`                | 32+ random characters (see below)                                             |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Settings → API                                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API                                                     |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase → Settings → API — **server-only, never prefix with `NEXT_PUBLIC_`** |
| `NEXT_PUBLIC_APP_URL`           | `http://localhost:3000` for local development, your domain in production      |

Generate a `SESSION_SECRET`:

```bash
openssl rand -base64 32
```

### 2. Supabase project

1. Create a new project at [supabase.com](https://supabase.com)
2. Navigate to **SQL Editor**
3. Paste the entire contents of `supabase/schema.sql` and run it

This creates all tables, enables Row Level Security, and seeds the default expense categories.

### 3. Run locally

```bash
npm run dev
```

### 4. Verify the setup

Log in with the credentials from your `.env.local`. Navigate to **Setup** and confirm the default categories are visible. If the page loads with data, your Supabase connection is working.

---

## Deployment (Vercel)

1. Push the repository to GitHub
2. Import the repository in Vercel
3. Add all environment variables under **Settings → Environment Variables**
4. Set `NEXT_PUBLIC_APP_URL` to your production domain (e.g. `https://finlog.yourdomain.com`)
5. Deploy

Before going live, work through the security checklist in [`AI_BUILD_PROMPT.md`](AI_BUILD_PROMPT.md#security-checklist).

> **Critical:** Never commit `.env.local` to git. The `.env*` pattern in `.gitignore` prevents this, but verify it before your first push: `git status` should not show `.env.local` as a tracked file.

---

## Tech Stack

| Layer          | Technology                  | Notes                                           |
| -------------- | --------------------------- | ----------------------------------------------- |
| Framework      | Next.js 16.2 (App Router)   | `proxy.ts` is the middleware name in Next.js 16 |
| Language       | TypeScript 5                | Strict mode                                     |
| Styling        | Tailwind CSS v4             | CSS-first config — no `tailwind.config.js`      |
| Database       | Supabase (PostgreSQL + RLS) | Service role key used server-side only          |
| Auth           | Custom JWT via `jose`       | No NextAuth, no Clerk, no external auth service |
| Validation     | Zod                         | Applied to every server action input            |
| Charts         | Recharts 3                  | All chart components are `'use client'`         |
| PDF export     | `@react-pdf/renderer` 4     | Client-side PDF generation                      |
| Icons          | Lucide React                |                                                 |
| Dates          | date-fns 4                  |                                                 |
| Search palette | cmdk                        |                                                 |

---

## How This Was Built

Finlog was designed by a human developer and implemented with [Claude Code](https://claude.ai/code) as an AI coding assistant. The security model, database schema, authentication approach, and full feature specification were written as a design document before any code existed. Claude Code implemented the codebase from that specification.

The original design document is preserved in [`AI_BUILD_PROMPT.md`](AI_BUILD_PROMPT.md). It shows what Finlog looked like as a written specification before it became a working application — a reference for contributors and a concrete study in specification-driven AI-assisted development.

The decisions in this codebase — three-layer security, timing-safe authentication, lockable periods, forward-looking safe-to-spend, spending anomaly detection — were deliberate architectural choices made before implementation began, not emergent outputs of an AI generating plausible-looking code.

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, code standards, and pull request process.

For security vulnerabilities, do not open a public issue. See the responsible disclosure process in `CONTRIBUTING.md`.

---

## License

[MIT](LICENSE) © 2026 Munfix
