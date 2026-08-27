import { redirect } from 'next/navigation';
import { AdminMetaIntegration } from '@/components/admin-meta-integration';
import { AppShell } from '@/components/app-shell';
import { getSessionActor } from '@/lib/server-auth';

export default async function MetaIntegrationPage() {
  const actor = await getSessionActor(); if (!actor) redirect('/login?callbackUrl=/admin/integracoes/meta'); if (actor.role !== 'admin') redirect('/?erro=acesso-negado');
  return <AppShell><div className="mx-auto max-w-[1540px] p-4 md:p-6 lg:p-7"><p className="mb-1 text-[11px] font-semibold uppercase tracking-[.13em] text-orange-700">Integrações</p><h1 className="text-2xl font-bold tracking-[-.03em] md:text-[28px]">Meta Ads</h1><p className="mt-1 text-sm text-slate-500">Autorize a Meta, escolha as contas do workspace e acompanhe a sincronização.</p><AdminMetaIntegration/></div></AppShell>;
}
