import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.username || !body?.password) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const expectedUser = process.env.FINLOG_USERNAME!;
  const expectedPass = process.env.FINLOG_PASSWORD!;

  let authenticated = false;

  // Check if user has set a custom password via in-app settings
  try {
    const supabase = createServerClient();
    const { data: profile } = await supabase
      .from('user_profile')
      .select('password_hash')
      .limit(1)
      .single();

    if (profile?.password_hash) {
      const userMatch = timingSafeEqual(
        Buffer.from(body.username.padEnd(64)),
        Buffer.from(expectedUser.padEnd(64)),
      );
      const passOk = await bcrypt.compare(body.password, profile.password_hash);
      authenticated = userMatch && passOk;
    }
  } catch {
    // DB unavailable — fall through to env var check
  }

  if (!authenticated) {
    const userMatch = timingSafeEqual(
      Buffer.from(body.username.padEnd(64)),
      Buffer.from(expectedUser.padEnd(64)),
    );
    const passMatch = timingSafeEqual(
      Buffer.from(body.password.padEnd(64)),
      Buffer.from(expectedPass.padEnd(64)),
    );
    authenticated = userMatch && passMatch;
  }

  if (!authenticated) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await createSession();
  const response = NextResponse.json({ ok: true });
  await setSessionCookie(token);
  return response;
}
