'use server';

import { requireAuth } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { format } from 'date-fns';

const GoalSchema = z.object({
  name: z.string().min(1).max(100),
  target_amount: z.number().positive(),
  color: z.string().min(4).max(20),
  deadline: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function createGoal(data: {
  name: string;
  target_amount: number;
  color: string;
  deadline?: string | null;
  notes?: string | null;
}) {
  await requireAuth();

  const parsed = GoalSchema.safeParse(data);
  if (!parsed.success) return { data: null, error: 'Invalid input' };

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from('savings_goals')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (existing?.sort_order ?? -1) + 1;

  const { data: row, error } = await supabase
    .from('savings_goals')
    .insert({
      name: parsed.data.name,
      target_amount: parsed.data.target_amount,
      current_amount: 0,
      color: parsed.data.color,
      deadline: parsed.data.deadline ?? null,
      notes: parsed.data.notes ?? null,
      sort_order: nextOrder,
    })
    .select()
    .single();

  return { data: row, error: error?.message ?? null };
}

export async function updateGoal(
  id: string,
  data: { name?: string; target_amount?: number; color?: string; deadline?: string | null; notes?: string | null },
) {
  await requireAuth();

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: 'Invalid ID' };

  const supabase = createServerClient();
  const { error } = await supabase
    .from('savings_goals')
    .update(data)
    .eq('id', idParsed.data);

  return { error: error?.message ?? null };
}

export async function deleteGoal(id: string) {
  await requireAuth();

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: 'Invalid ID' };

  const supabase = createServerClient();
  await supabase.from('goal_contributions').delete().eq('goal_id', idParsed.data);
  const { error } = await supabase.from('savings_goals').delete().eq('id', idParsed.data);
  return { error: error?.message ?? null };
}

export async function addGoalContribution(
  goalId: string,
  amount: number,
  notes?: string,
) {
  await requireAuth();

  const gid = z.string().uuid().safeParse(goalId);
  const amt = z.number().positive().safeParse(amount);
  if (!gid.success || !amt.success) return { error: 'Invalid input' };

  const supabase = createServerClient();

  const { error: insErr } = await supabase.from('goal_contributions').insert({
    goal_id: gid.data,
    amount: amt.data,
    notes: notes ?? null,
    contributed_at: format(new Date(), 'yyyy-MM-dd'),
  });
  if (insErr) return { error: insErr.message };

  // Recompute current_amount from all contributions
  const { data: contributions } = await supabase
    .from('goal_contributions')
    .select('amount')
    .eq('goal_id', gid.data);

  const total = (contributions ?? []).reduce((s, c) => s + Number(c.amount), 0);
  await supabase.from('savings_goals').update({ current_amount: total }).eq('id', gid.data);

  return { error: null };
}

export async function deleteGoalContribution(id: string, goalId: string) {
  await requireAuth();

  const idParsed = z.string().uuid().safeParse(id);
  const gidParsed = z.string().uuid().safeParse(goalId);
  if (!idParsed.success || !gidParsed.success) return { error: 'Invalid ID' };

  const supabase = createServerClient();
  const { error } = await supabase.from('goal_contributions').delete().eq('id', idParsed.data);
  if (error) return { error: error.message };

  const { data: contributions } = await supabase
    .from('goal_contributions')
    .select('amount')
    .eq('goal_id', gidParsed.data);

  const total = (contributions ?? []).reduce((s, c) => s + Number(c.amount), 0);
  await supabase.from('savings_goals').update({ current_amount: total }).eq('id', gidParsed.data);

  return { error: null };
}
