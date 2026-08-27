'use client';

import { RefreshCw } from 'lucide-react';
import type { AdminLog } from '@/lib/admin-types';
import { useAdminResource } from '@/lib/use-admin-resource';

const actionLabels: Record<string, string> = { 'accounts.create': 'Conta criada', 'accounts.update': 'Conta atualizada', 'accounts.delete': 'Conta arquivada', 'brands.create': 'Marca criada', 'brands.update': 'Marca atualizada', 'brands.delete': 'Marca excluída', 'analysts.create': 'Analista criado', 'analysts.update': 'Analista atualizado', 'analysts.delete': 'Analista excluído', 'users.create': 'Usuário criado', 'users.update': 'Usuário atualizado', 'users.delete': 'Usuário desativado', 'goals.create': 'Meta criada', 'goals.update': 'Meta atualizada', 'goals.delete': 'Meta excluída', 'budgets.create': 'Orçamento criado', 'budgets.update': 'Orçamento atualizado', 'budgets.delete': 'Orçamento excluído', 'csv.import': 'CSV importado' };

export function AdminLogs() {
  const logs = useAdminResource<{ items: AdminLog[] }>('logs');
  return <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><h2 className="text-sm font-bold">Atividade e alterações</h2><p className="mt-1 text-xs text-slate-500">Até 100 eventos administrativos, lidos diretamente da auditoria</p></div><button onClick={logs.reload} className="rounded-lg border border-slate-200 p-2 text-slate-500" aria-label="Atualizar histórico"><RefreshCw size={14}/></button></div>
    {logs.error ? <p role="alert" className="p-5 text-xs text-red-600">{logs.error}</p> : logs.loading ? <div className="p-8 text-center text-xs text-slate-500">Carregando…</div> : !logs.data?.items.length ? <div className="p-8 text-center text-xs text-slate-500">Nenhuma alteração registrada.</div> : <div>{logs.data.items.map((item) => <div key={item.id} className="flex items-start gap-3 border-b border-slate-100 px-4 py-4"><span className="mt-1.5 h-2 w-2 rounded-full bg-orange-500"/><div className="min-w-0 flex-1"><p className="text-xs font-bold">{actionLabels[item.action] ?? item.action}</p><p className="mt-1 truncate text-[11px] text-slate-500">{describe(item)}</p></div><div className="shrink-0 text-right text-[10px] text-slate-400"><p>{item.user ?? 'Sistema'}</p><p className="mt-1">{new Date(item.createdAt).toLocaleString('pt-BR')}</p></div></div>)}</div>}
  </section>;
}

function describe(item: AdminLog) {
  const after = item.afterValues as Record<string, unknown> | null;
  const before = item.beforeValues as Record<string, unknown> | null;
  const value = after ?? before;
  if (!value) return item.entity;
  return String(value.name ?? value.email ?? value.accountId ?? value.id ?? item.entity);
}
