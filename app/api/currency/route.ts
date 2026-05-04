import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PRIMARY_URL =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';
const FALLBACK_URL =
  'https://latest.currency-api.pages.dev/v1/currencies/usd.json';

async function fetchRates(): Promise<Record<string, number>> {
  const tryFetch = async (url: string) => {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.usd as Record<string, number>;
  };

  try {
    return await tryFetch(PRIMARY_URL);
  } catch {
    return await tryFetch(FALLBACK_URL);
  }
}

export async function GET(_req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  const { data: cached } = await supabase
    .from('exchange_rates')
    .select('rates, fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single();

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age < CACHE_TTL_MS) {
      return NextResponse.json({ rates: cached.rates, cached: true });
    }
  }

  try {
    const rates = await fetchRates();

    await supabase.from('exchange_rates').insert({ rates });

    return NextResponse.json({ rates, cached: false });
  } catch (err) {
    if (cached) {
      return NextResponse.json({ rates: cached.rates, cached: true, stale: true });
    }
    return NextResponse.json(
      { error: 'Failed to fetch exchange rates' },
      { status: 502 },
    );
  }
}
