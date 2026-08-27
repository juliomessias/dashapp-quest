'use client';
import Link from 'next/link';
import { AlertTriangle, DatabaseZap, Link2, PlugZap, RefreshCw } from 'lucide-react';
import type { AnalyticsResponse } from '@/lib/analytics-types';

type Integration = AnalyticsResponse['integration'];

export function IntegrationAlert({ integration }: { integration: Integration }) {
  if (!['authorization_expired', 'insufficient_permissions', 'connection_error'].includes(integration.connectionStatus)) return null;
  const message = integration.connectionStatus === 'authorization_expired' ? 'A autorização da Meta expirou.' : integration.connectionStatus === 'insufficient_permissions' ? 'A conexão não possui todas as permissões necessárias.' : 'A verificação mais recente da Meta falhou.';
  return <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle size={17}/><span className="flex-1">{message} Os últimos dados válidos foram preservados.</span><Link href="/admin/integracoes/meta" className="text-xs font-bold underline">Testar ou reconectar</Link></div>;
}

export function RealDataEmptyState({ integration }: { integration: Integration }) {
  const disconnected = !integration.configured || ['not_connected', 'disconnected', 'awaiting_authorization', 'authorization_expired', 'insufficient_permissions', 'connection_error'].includes(integration.connectionStatus);
  if (disconnected) return <section className="mt-4 rounded-xl border border-slate-200 bg-white p-10 text-center"><PlugZap className="mx-auto text-orange-600" size={28}/><h2 className="mt-4 text-base font-bold">Conecte suas contas do Meta Ads</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">Autorize a integração para localizar as contas acessíveis e trazer métricas reais para o dashboard. Metas e orçamentos podem ser cadastrados no painel administrativo.</p><Link href="/admin/integracoes/meta" className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-orange-600 px-4 text-xs font-bold text-white"><PlugZap size={15}/>Configurar integração</Link></section>;
  if (integration.linkedAccounts === 0) return <section className="mt-4 rounded-xl border border-slate-200 bg-white p-10 text-center"><Link2 className="mx-auto text-orange-600" size={28}/><h2 className="mt-4 text-base font-bold">Nenhuma conta vinculada</h2><p className="mt-2 text-sm text-slate-500">Selecione as contas autorizadas que devem fazer parte deste workspace.</p><Link href="/admin/integracoes/meta#gerenciar-contas" className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-orange-600 px-4 text-xs font-bold text-white"><Link2 size={15}/>Selecionar contas</Link></section>;
  if (!integration.hasSuccessfulSync) return <section className="mt-4 rounded-xl border border-slate-200 bg-white p-10 text-center"><DatabaseZap className="mx-auto text-orange-600" size={28}/><h2 className="mt-4 text-base font-bold">Os dados ainda não foram sincronizados</h2><p className="mt-2 text-sm text-slate-500">Execute a primeira sincronização para preencher cards, gráficos e tabelas com resultados reais.</p><Link href="/admin/integracoes/meta" className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-orange-600 px-4 text-xs font-bold text-white"><RefreshCw size={15}/>Sincronizar agora</Link></section>;
  return <section className="mt-4 rounded-xl border border-slate-200 bg-white p-10 text-center"><h2 className="text-base font-bold">Nenhum dado encontrado para o período e filtros selecionados</h2><p className="mt-2 text-sm text-slate-500">Ajuste o período ou o escopo e tente novamente.</p></section>;
}
