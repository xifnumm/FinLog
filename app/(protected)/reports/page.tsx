import { requireAuth } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import ReportsClient from '@/components/reports/ReportsClient';

export default async function ReportsPage() {
  await requireAuth();

  const supabase = createServerClient();

  const { data: periods } = await supabase
    .from('monthly_periods')
    .select('id, period, total_received, is_locked')
    .order('period', { ascending: false });

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[--color-text-primary]">Reports</h1>
        <p className="text-sm text-[--color-text-secondary] mt-1">Export monthly data as PDF or CSV</p>
      </div>
      <ReportsClient periods={periods ?? []} />
    </div>
  );
}
