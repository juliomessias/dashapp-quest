import { AdminView } from '@/components/admin-view';
import { getSessionActor } from '@/lib/server-auth';
import { redirect } from 'next/navigation';

export default async function AdminPage() {
  const actor = await getSessionActor();
  if (!actor) redirect('/login?callbackUrl=/admin');
  if (actor.role !== 'admin') redirect('/?erro=acesso-negado');
  return <AdminView />;
}
