import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import { format } from 'date-fns';
import AppShell from '@/components/layout/AppShell';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('finlog_session')?.value;

  if (!token || !(await verifySession(token))) {
    redirect('/');
  }

  const supabase = createServerClient();
  const currentPeriod = format(new Date(), 'yyyy-MM');

  const [{ data: periodRow }, { data: profile }] = await Promise.all([
    supabase.from('monthly_periods').select('id').eq('period', currentPeriod).single(),
    supabase.from('user_profile').select('display_name').limit(1).single(),
  ]);

  return (
    <AppShell
      newMonthPending={!periodRow}
      displayName={profile?.display_name ?? 'Admin'}
    >
      {children}
    </AppShell>
  );
}
