'use server';

import { requireAuth } from '@/lib/auth/session';
import { assertPeriodNotLocked } from '@/lib/auth/lock';
import { createServerClient } from '@/lib/supabase/server';
import { ExpenseSchema, ExpenseLogSchema, ReorderSchema } from '@/lib/validators';
import { z } from 'zod';

export async function upsertExpenseLog(
  periodId: string,
  expenseId: string,
  actualAmount: number | null,
  notes?: string,
) {
  await requireAuth();
  await assertPeriodNotLocked(periodId);

  const parsed = ExpenseLogSchema.safeParse({
    period_id: periodId,
    expense_id: expenseId,
    actual_amount: actualAmount,
    notes,
  });
  if (!parsed.success) return { data: null, error: 'Invalid input' };

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('expense_logs')
    .upsert(
      {
        period_id: parsed.data.period_id,
        expense_id: parsed.data.expense_id,
        actual_amount: parsed.data.actual_amount,
        notes: parsed.data.notes ?? null,
        logged_at: new Date().toISOString(),
      },
      { onConflict: 'period_id,expense_id' },
    )
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

export async function createExpense(formData: unknown) {
  await requireAuth();

  const parsed = ExpenseSchema.safeParse(formData);
  if (!parsed.success) return { data: null, error: 'Invalid input' };

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('expenses')
    .insert(parsed.data)
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

export async function updateExpense(id: string, formData: unknown) {
  await requireAuth();

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { data: null, error: 'Invalid ID' };

  const parsed = ExpenseSchema.partial().safeParse(formData);
  if (!parsed.success) return { data: null, error: 'Invalid input' };

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('expenses')
    .update(parsed.data)
    .eq('id', idParsed.data)
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

export async function toggleExpenseActive(id: string, isActive: boolean) {
  await requireAuth();

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { data: null, error: 'Invalid ID' };

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('expenses')
    .update({ is_active: isActive })
    .eq('id', idParsed.data)
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

export async function deleteExpense(id: string, force = false) {
  await requireAuth();

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: 'Invalid ID' };

  const supabase = createServerClient();

  if (!force) {
    // Soft delete
    const { error } = await supabase
      .from('expenses')
      .update({ is_active: false })
      .eq('id', idParsed.data);
    return { error: error?.message ?? null };
  }

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', idParsed.data);
  return { error: error?.message ?? null };
}

export async function reorderExpenses(orderedIds: string[]) {
  await requireAuth();

  const parsed = ReorderSchema.safeParse({ orderedIds });
  if (!parsed.success) return { error: 'Invalid input' };

  const supabase = createServerClient();
  const updates = parsed.data.orderedIds.map((id, index) =>
    supabase.from('expenses').update({ sort_order: index }).eq('id', id),
  );

  await Promise.all(updates);
  return { error: null };
}
