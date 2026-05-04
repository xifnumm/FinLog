'use server';

import { requireAuth } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import { AnnualExpenseLogSchema } from '@/lib/validators';

export async function upsertAnnualExpenseLog(
  annualPeriodId: string,
  expenseId: string,
  actualAmount: number | null,
  paidAt?: string | null,
  notes?: string,
) {
  await requireAuth();

  const parsed = AnnualExpenseLogSchema.safeParse({
    annual_period_id: annualPeriodId,
    expense_id: expenseId,
    actual_amount: actualAmount,
    paid_at: paidAt ?? null,
    notes,
  });
  if (!parsed.success) return { data: null, error: 'Invalid input' };

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('annual_expense_logs')
    .upsert(
      {
        annual_period_id: parsed.data.annual_period_id,
        expense_id: parsed.data.expense_id,
        actual_amount: parsed.data.actual_amount,
        paid_at: parsed.data.paid_at ?? null,
        notes: parsed.data.notes ?? null,
      },
      { onConflict: 'annual_period_id,expense_id' },
    )
    .select()
    .single();

  return { data, error: error?.message ?? null };
}
