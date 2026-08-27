'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, CircleDollarSign, FileUp, History, PlugZap, SlidersHorizontal } from 'lucide-react';
import { AdminBudgets } from './admin-budgets';
import { AdminCatalogs } from './admin-catalog';
import { AdminGoals } from './admin-goals';
import { AdminImport } from './admin-import';
import { AdminLogs } from './admin-logs';
import { AppShell } from './app-shell';

const tabs = [
  { id: 'cadastros', label: 'Cadastros', icon: Building2 },
  { id: 'metas', label: 'Metas', icon: SlidersHorizontal },
  { id: 'orcamentos', label: 'Orçamentos', icon: CircleDollarSign },
  { id: 'importacao', label: 'Importação', icon: FileUp },
  { id: 'logs', label: 'Logs e histórico', icon: History },
] as const;
type TabId = (typeof tabs)[number]['id'];

export function AdminView() {
  const [tab, setTab] = useState<TabId>('cadastros');
  return <AppShell><div className="mx-auto max-w-[1480px] p-4 md:p-6 lg:p-7">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-[11px] font-semibold uppercase tracking-[.13em] text-orange-700">Configurações</p><h1 className="text-2xl font-bold tracking-[-.03em] md:text-[28px]">Administração</h1><p className="mt-1 text-sm text-slate-500">Contas, acessos, metas, orçamentos e governança da operação.</p></div><Link href="/admin/integracoes/meta" className="flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white"><PlugZap size={15}/>Integrações · Meta Ads</Link></div>
    <div className="flex overflow-x-auto border-b border-slate-200" role="tablist">{tabs.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold ${tab === item.id ? 'border-orange-600 text-orange-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><item.icon size={15}/>{item.label}</button>)}</div>
    {tab === 'cadastros' && <AdminCatalogs/>}
    {tab === 'metas' && <AdminGoals/>}
    {tab === 'orcamentos' && <AdminBudgets/>}
    {tab === 'importacao' && <AdminImport/>}
    {tab === 'logs' && <AdminLogs/>}
  </div></AppShell>;
}
