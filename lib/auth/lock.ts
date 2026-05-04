import { createServerClient } from '@/lib/supabase/server';

export async function assertPeriodNotLocked(periodId: string): Promise<void> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('monthly_periods')
    .select('is_locked')
    .eq('id', periodId)
    .single();

  if (data?.is_locked) {
    throw new Error('This month is locked. Unlock it first to make changes.');
  }
}
