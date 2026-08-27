'use client';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { FilterAccountOption } from '@/lib/filters';

export function AccountSelector({ accounts, selectedId, disabled = false }: { accounts: FilterAccountOption[]; selectedId?: string; disabled?: boolean }) {
  const router = useRouter(); const params = useSearchParams(); const [open, setOpen] = useState(false); const [query, setQuery] = useState('');
  const selected = accounts.find((account) => account.id === selectedId);
  const filtered = useMemo(() => accounts.filter((account) => `${account.name} ${account.brand} ${account.market}`.toLowerCase().includes(query.toLowerCase())), [accounts, query]);
  function choose(id: string) { const next = new URLSearchParams(params.toString()); next.set('accountId', id); setOpen(false); setQuery(''); router.replace(`/contas/${id}?${next.toString()}`, { scroll: false }); }
  return <div className="relative w-full sm:w-[360px]">
    <button type="button" disabled={disabled} aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen((value) => !value)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm disabled:opacity-60">
      <span className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Conta visualizada</span><span className="block truncate text-xs font-bold text-slate-800">{selected ? selected.name : 'Selecione uma conta'}</span>{selected && <span className="block truncate text-[10px] text-slate-500">{selected.brand} · {selected.market}</span>}</span><ChevronsUpDown size={16} className="shrink-0 text-slate-400"/>
    </button>
    {open && <div className="absolute right-0 z-30 mt-2 w-full min-w-[300px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      <label className="flex items-center gap-2 border-b border-slate-100 px-3"><Search size={14} className="text-slate-400"/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar conta ou marca" className="h-10 min-w-0 flex-1 text-xs outline-none"/><button type="button" aria-label="Fechar seletor" onClick={() => setOpen(false)}><X size={14}/></button></label>
      <div role="listbox" aria-label="Contas autorizadas" className="max-h-64 overflow-auto p-1.5">{filtered.map((account) => <button type="button" role="option" aria-selected={account.id === selectedId} key={account.id} onClick={() => choose(account.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-orange-50"><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-800">{account.name}</strong><span className="block truncate text-[10px] text-slate-500">{account.brand} · {account.market}</span></span>{account.id === selectedId && <Check size={15} className="text-orange-600"/>}</button>)}{!filtered.length && <p className="px-3 py-6 text-center text-xs text-slate-500">Nenhuma conta encontrada.</p>}</div>
    </div>}
  </div>;
}
