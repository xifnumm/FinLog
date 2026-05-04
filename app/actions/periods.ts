'use server';

import { requireAuth } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import { MonthlyPeriodSchema } from '@/lib/validators';
import { z } from 'zod';
import { format } from 'date-fns';

export async function createMonthlyPeriod(
  period: string,
  totalReceived: number,
  notes?: string,
) {
  await requireAuth();

  const parsed = MonthlyPeriodSchema.safeParse({ period, total_received: totalReceived, notes });
  if (!parsed.success) return { data: null, error: 'Invalid input' };

  // Prevent creating future months
  const currentPeriod = format(new Date(), 'yyyy-MM');
  if (parsed.data.period > currentPeriod) {
    return { data: null, error: 'Cannot create a period for a future month' };
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('monthly_periods')
    .insert({
      period: parsed.data.period,
      total_received: parsed.data.total_received,
      notes: parsed.data.notes ?? null,
    })
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

export async function updateMonthlyPeriodLock(periodId: string, isLocked: boolean) {
  await requireAuth();

  const idParsed = z.string().uuid().safeParse(periodId);
  if (!idParsed.success) return { data: null, error: 'Invalid ID' };

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('monthly_periods')
    .update({ is_locked: isLocked })
    .eq('id', idParsed.data)
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

export async function getOrCreateAnnualPeriod(year: number) {
  await requireAuth();

  const yearParsed = z.number().int().min(2020).max(2100).safeParse(year);
  if (!yearParsed.success) return { data: null, error: 'Invalid year' };

  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from('annual_periods')
    .select()
    .eq('year', yearParsed.data)
    .single();

  if (existing) return { data: existing, error: null };

  const { data, error } = await supabase
    .from('annual_periods')
    .insert({ year: yearParsed.data })
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

export async function updateMonthlyPeriod(
  periodId: string,
  updates: { total_received?: number; notes?: string | null },
) {
  await requireAuth();

  const idParsed = z.string().uuid().safeParse(periodId);
  if (!idParsed.success) return { error: 'Invalid ID' };

  if (updates.total_received !== undefined) {
    const parsed = z.number().min(0).safeParse(updates.total_received);
    if (!parsed.success) return { error: 'Enter a valid amount' };
  }

  const supabase = createServerClient();

  const { data: period } = await supabase
    .from('monthly_periods')
    .select('is_locked')
    .eq('id', idParsed.data)
    .single();
  if (period?.is_locked) return { error: 'Period is locked' };

  const { error } = await supabase
    .from('monthly_periods')
    .update(updates)
    .eq('id', idParsed.data);

  return { error: error?.message ?? null };
}

export async function copyPreviousMonthLogs(
  currentPeriodId: string,
  previousPeriodId: string,
) {
  await requireAuth();

  const currentId = z.string().uuid().safeParse(currentPeriodId);
  const prevId = z.string().uuid().safeParse(previousPeriodId);
  if (!currentId.success || !prevId.success) return { error: 'Invalid ID', logs: [] };

  const supabase = createServerClient();

  const { data: prevLogs } = await supabase
    .from('expense_logs')
    .select('expense_id, actual_amount, notes')
    .eq('period_id', prevId.data);

  if (!prevLogs || prevLogs.length === 0) {
    return { error: 'No logs found in the previous month', logs: [] };
  }

  const { error } = await supabase
    .from('expense_logs')
    .upsert(
      prevLogs.map((l) => ({
        period_id: currentId.data,
        expense_id: l.expense_id,
        actual_amount: l.actual_amount,
        notes: l.notes,
        logged_at: new Date().toISOString(),
      })),
      { onConflict: 'period_id,expense_id', ignoreDuplicates: true },
    );

  return { error: error?.message ?? null, logs: prevLogs };
}

export async function resetCurrentMonthLogs(confirmation: string) {
  await requireAuth();

  if (confirmation !== 'RESET') {
    return { error: 'Confirmation text mismatch' };
  }

  const supabase = createServerClient();
  const currentPeriod = format(new Date(), 'yyyy-MM');

  const { data: period } = await supabase
    .from('monthly_periods')
    .select('id, is_locked')
    .eq('period', currentPeriod)
    .single();

  if (!period) return { error: 'No current period found' };
  if (period.is_locked) return { error: 'Period is locked' };

  const { error } = await supabase
    .from('expense_logs')
    .delete()
    .eq('period_id', period.id);

  return { error: error?.message ?? null };
}
