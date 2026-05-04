'use server';

import { requireAuth } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

export async function createIncomeEntry(
  periodId: string,
  source: string,
  amount: number,
  notes?: string,
) {
  await requireAuth();

  const pidParsed = z.string().uuid().safeParse(periodId);
  const srcParsed = z.string().min(1).max(100).safeParse(source);
  const amtParsed = z.number().positive().safeParse(amount);
  if (!pidParsed.success || !srcParsed.success || !amtParsed.success) {
    return { data: null, error: 'Invalid input' };
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('income_entries')
    .insert({
      period_id: pidParsed.data,
      source: srcParsed.data,
      amount: amtParsed.data,
      notes: notes ?? null,
    })
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

export async function deleteIncomeEntry(id: string) {
  await requireAuth();

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: 'Invalid ID' };

  const supabase = createServerClient();
  const { error } = await supabase.from('income_entries').delete().eq('id', idParsed.data);
  return { error: error?.message ?? null };
}
