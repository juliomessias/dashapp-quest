'use client';
import { CalendarDays, Filter, RotateCcw } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import type { FilterAccountOption } from '@/lib/filters';

const fieldClass = 'h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-orange-400 disabled:cursor-wait disabled:bg-slate-50';

function GlobalFiltersInner({ accounts, loading = false, showAccount = true }: { accounts: FilterAccountOption[]; loading?: boolean; showAccount?: boolean }) {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams();
  const selectedBrand = params.get('marca') ?? ''; const selectedAccount = params.get('accountId') ?? '';
  const brands = useMemo(() => Array.from(new Map(accounts.map((account) => [account.brandId, account.brand])).entries()), [accounts]);
  const brandAccounts = selectedBrand ? accounts.filter((account) => account.brandId === selectedBrand) : accounts;
  const analysts = Array.from(new Map(brandAccounts.filter((account) => account.analystId).map((account) => [account.analystId!, account.analyst!])).entries());
  const markets = Array.from(new Set(brandAccounts.map((account) => account.market))).sort();
  function replace(next: URLSearchParams) { router.replace(`${pathname}?${next.toString()}`, { scroll: false }); }
  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString()); if (value) next.set(key, value); else next.delete(key);
    if (key === 'ano' && value) { const current = (next.get('data') ?? '2026-08-25').slice(4); next.set('data', `${value}${current}`); }
    if (key === 'marca') {
      const selected = accounts.find((account) => account.id === next.get('accountId'));
      if (selected && selected.brandId !== value) next.delete('accountId');
      if (next.get('analista') && !accounts.some((account) => account.brandId === value && account.analystId === next.get('analista'))) next.delete('analista');
      if (next.get('mercado') && !accounts.some((account) => account.brandId === value && account.market === next.get('mercado'))) next.delete('mercado');
    }
    if (key === 'accountId' && value) {
      const account = accounts.find((item) => item.id === value);
      if (account) {
        if (next.get('marca') && next.get('marca') !== account.brandId) next.delete('marca');
        if (next.get('analista') && next.get('analista') !== account.analystId) next.delete('analista');
        if (next.get('mercado') && next.get('mercado') !== account.market) next.delete('mercado');
      }
    }
    replace(next);
  }
  const period = params.get('periodo') ?? 'ytd'; const start = params.get('inicio') ?? ''; const end = params.get('fim') ?? '';
  const customError = period === 'personalizado' && start && end && end < start ? 'A data final não pode ser anterior à inicial.' : '';
  return <section className={`rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,.03)] ${loading ? 'opacity-70' : ''}`} aria-label="Filtros globais" aria-busy={loading}>
    <div className="flex flex-wrap items-center gap-2">
      <div className="mr-1 flex items-center gap-2 px-1 text-xs font-semibold text-slate-600"><Filter size={14} className="text-orange-600"/>Filtros</div>
      <select aria-label="Ciclo" disabled={loading} value={params.get('ano') ?? '2026'} onChange={(event) => update('ano', event.target.value)} className={fieldClass}><option>2026</option><option>2025</option></select>
      <select aria-label="Período" disabled={loading} value={period} onChange={(event) => update('periodo', event.target.value)} className={fieldClass}><option value="dia">Dia</option><option value="mes">Mês</option><option value="12m">12 meses móveis</option><option value="ytd">YTD corporativo</option><option value="personalizado">Personalizado</option></select>
      {period === 'personalizado' ? <>
        <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 shadow-sm"><CalendarDays size={14}/><input aria-label="Data inicial" type="date" value={start} onChange={(event) => update('inicio', event.target.value)} className="w-[112px] bg-transparent font-medium outline-none"/></label>
        <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 shadow-sm"><CalendarDays size={14}/><input aria-label="Data final personalizada" type="date" value={end} min={start || undefined} onChange={(event) => update('fim', event.target.value)} className="w-[112px] bg-transparent font-medium outline-none"/></label>
      </> : <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 shadow-sm"><CalendarDays size={14}/><input aria-label="Data final" type="date" value={params.get('data') ?? '2026-08-25'} onChange={(event) => update('data', event.target.value)} className="w-[112px] bg-transparent font-medium outline-none"/></label>}
      {showAccount && <select aria-label="Conta" disabled={loading} value={selectedAccount} onChange={(event) => update('accountId', event.target.value)} className={`${fieldClass} max-w-[220px]`}><option value="">Todas as contas</option>{brandAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>}
      <select aria-label="Marca" disabled={loading} value={selectedBrand} onChange={(event) => update('marca', event.target.value)} className={fieldClass}><option value="">Todas as marcas</option>{brands.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <select aria-label="Mercado" disabled={loading} value={params.get('mercado') ?? ''} onChange={(event) => update('mercado', event.target.value)} className={fieldClass}><option value="">Todos os mercados</option>{markets.map((market) => <option key={market}>{market}</option>)}</select>
      <select aria-label="Analista" disabled={loading} value={params.get('analista') ?? ''} onChange={(event) => update('analista', event.target.value)} className={fieldClass}><option value="">Todos os analistas</option>{analysts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <button onClick={() => router.replace(pathname)} className="ml-auto flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800"><RotateCcw size={14}/>Limpar filtros</button>
    </div>{customError && <p role="alert" className="mt-2 text-xs font-medium text-red-600">{customError}</p>}
  </section>;
}

export function GlobalFilters(props: { accounts?: FilterAccountOption[]; loading?: boolean; showAccount?: boolean }) {
  return <Suspense fallback={<div className="h-[62px] animate-pulse rounded-xl border border-slate-200 bg-white" aria-label="Carregando filtros"/>}><GlobalFiltersInner accounts={props.accounts ?? []} loading={props.loading} showAccount={props.showAccount}/></Suspense>;
}
