import { requireAuth } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import SetupClient from '@/components/setup/SetupClient';

export default async function SetupPage() {
  await requireAuth();

  const supabase = createServerClient();
  const { data: categories } = await supabase
    .from('categories')
    .select('*, expenses(*, expense_logs(id))')
    .order('sort_order');

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[--color-text-primary]">Setup</h1>
        <p className="text-sm text-[--color-text-secondary] mt-1">
          Manage your expense categories and items
        </p>
      </div>
      <SetupClient initialCategories={categories ?? []} />
    </div>
  );
}
