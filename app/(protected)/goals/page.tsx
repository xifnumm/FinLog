import { requireAuth } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import GoalsClient from '@/components/goals/GoalsClient';

export default async function GoalsPage() {
  await requireAuth();

  const supabase = createServerClient();

  const { data: goals } = await supabase
    .from('savings_goals')
    .select('*, goal_contributions(id, amount, notes, contributed_at)')
    .eq('is_active', true)
    .order('sort_order');

  return <GoalsClient goals={goals ?? []} />;
}
