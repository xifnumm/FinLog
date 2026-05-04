'use server';

import { requireAuth } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

export async function updateDisplayName(name: string) {
  await requireAuth();

  const parsed = z.string().min(1).max(50).trim().safeParse(name);
  if (!parsed.success) return { error: 'Name must be 1–50 characters' };

  const supabase = createServerClient();
  const { data: existing } = await supabase.from('user_profile').select('id').limit(1).single();

  if (existing) {
    await supabase
      .from('user_profile')
      .update({ display_name: parsed.data, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('user_profile').insert({ display_name: parsed.data });
  }

  return { error: null };
}

export async function getUserProfile() {
  await requireAuth();
  const supabase = createServerClient();
  const { data } = await supabase
    .from('user_profile')
    .select('monthly_savings_target')
    .limit(1)
    .single();
  return { monthly_savings_target: (data?.monthly_savings_target as number | null) ?? null };
}

export async function updateSavingsTarget(target: number | null) {
  await requireAuth();

  if (target !== null) {
    const parsed = z.number().min(0).safeParse(target);
    if (!parsed.success) return { error: 'Enter a valid positive amount' };
  }

  const supabase = createServerClient();
  const { data: existing } = await supabase.from('user_profile').select('id').limit(1).single();
  if (existing) {
    await supabase
      .from('user_profile')
      .update({ monthly_savings_target: target, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('user_profile').insert({ monthly_savings_target: target });
  }

  return { error: null };
}

export async function updatePassword(currentPassword: string, newPassword: string) {
  await requireAuth();

  const schema = z.object({
    current: z.string().min(1),
    next: z.string().min(8, 'New password must be at least 8 characters'),
  });
  const parsed = schema.safeParse({ current: currentPassword, next: newPassword });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createServerClient();
  const { data: profile } = await supabase
    .from('user_profile')
    .select('password_hash')
    .limit(1)
    .single();

  // Verify current password
  if (profile?.password_hash) {
    const valid = await bcrypt.compare(parsed.data.current, profile.password_hash);
    if (!valid) return { error: 'Current password is incorrect' };
  } else {
    // First time — verify against env var
    if (parsed.data.current !== process.env.FINLOG_PASSWORD) {
      return { error: 'Current password is incorrect' };
    }
  }

  const hash = await bcrypt.hash(parsed.data.next, 12);

  const { data: existing } = await supabase.from('user_profile').select('id').limit(1).single();
  if (existing) {
    await supabase
      .from('user_profile')
      .update({ password_hash: hash, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  }

  return { error: null };
}
