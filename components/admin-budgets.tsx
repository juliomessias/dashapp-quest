'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { CheckCircle2, Edit3, Loader2, Save, Trash2 } from 'lucide-react';
import type { AdminBudget, AdminCatalog } from '@/lib/admin-types';
import { budgetInputSchema } from '@/lib/admin-validation';
import { money } from '@/lib/demo-data';
import { mutateAdmin, useAdminResource } from '@/lib/use-admin-resource';

const input = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-orange-400';
const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const blank = { id: '', accountId: '', year: 2026, month: 8, budget: '', prepaidBalance: '', note: '' };

export function AdminBudgets() {
  const catalog = useAdminResource<AdminCatalog>('catalog');
  const budgets = useAdminResource<{ items: AdminBudget[] }>('budgets');
  const [form, setForm] = useState({ ...blank });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedAccount = catalog.data?.accounts.find((item) => item.id === form.accountId);

  async function persist(replace = false) {
    const parsed = budgetInputSchema.safeParse({
      ...form,
      prepaidBalance: form.prepaidBalance.trim() ? form.prepaidBalance : null,
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return false;
    }
    await mutateAdmin('budgets', form.id ? 'PATCH' : 'POST', { ...parsed.data, id: form.id || undefined, replace });
    setForm({ ...blank });
    setMessage(replace ? 'Orçamento existente substituído com sucesso.' : 'Orçamento salvo e confirmado no banco.');
    budgets.reload();
    return true;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({}); setMessage(''); setSaving(true);
    try {
      await persist();
    } catch (reason) {
      const error = reason as Error & { status?: number };
      if (error.status === 409 && confirm('Já existe orçamento para esta conta, ano e mês. Deseja substituí-lo?')) {
        try { await persist(true); } catch (replaceError) { setErrors({ form: replaceError instanceof Error ? replaceError.message : 'Falha ao substituir.' }); }
      } else setErrors({ form: error.message });
    } finally { setSaving(false); }
  }

  function edit(item: AdminBudget) {
    setForm({ id: item.id, accountId: item.accountId, year: item.year, month: item.month, budget: item.budget, prepaidBalance: item.prepaidBalance ?? '', note: item.note ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(item: AdminBudget) {
    if (!confirm(`Excluir o orçamento de ${item.account} em ${months[item.month - 1]}/${item.year}?`)) return;
    try {
      await mutateAdmin('budgets', 'DELETE', undefined, item.id);
      setMessage('Orçamento excluído e auditoria registrada.'); budgets.reload();
    } catch (reason) { setErrors({ form: reason instanceof Error ? reason.message : 'Falha ao excluir.' }); }
  }

  return <div className="mt-5 space-y-4">
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold">{form.id ? 'Editar orçamento' : 'Cadastrar orçamento manualmente'}</h2><p className="mt-1 text-xs text-slate-500">Informe valores em reais; formatos 15000, 15000,50 e R$ 15.000,50 são aceitos.</p></div>{form.id && <button type="button" onClick={() => setForm({ ...blank })} className="text-xs font-semibold text-slate-500">Cancelar edição</button>}</div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Conta" error={errors.accountId}><select className={input} value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}><option value="">Selecione</option>{catalog.data?.accounts.filter((item) => item.status !== 'archived').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Marca vinculada"><input className={`${input} bg-slate-50`} readOnly value={selectedAccount?.brand ?? ''} placeholder="Preenchida pela conta"/></Field>
        <Field label="Ano" error={errors.year}><input className={input} type="number" min="2020" max="2100" value={form.year} onChange={(event) => setForm({ ...form, year: Number(event.target.value) })}/></Field>
        <Field label="Mês" error={errors.month}><select className={input} value={form.month} onChange={(event) => setForm({ ...form, month: Number(event.target.value) })}>{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></Field>
        <Field label="Orçamento" error={errors.budget}><input className={input} inputMode="decimal" placeholder="R$ 0,00" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })}/></Field>
        <Field label="Saldo pré-pago" error={errors.prepaidBalance}><input className={input} inputMode="decimal" placeholder="Opcional" value={form.prepaidBalance} onChange={(event) => setForm({ ...form, prepaidBalance: event.target.value })}/></Field>
        <Field label="Observação" error={errors.note}><input className={input} maxLength={1000} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })}/></Field>
      </div>
      {errors.form && <p role="alert" className="mt-3 text-xs font-medium text-red-600">{errors.form}</p>}{message && <p role="status" className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700"><CheckCircle2 size={14}/>{message}</p>}
      <button disabled={saving} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-orange-600 px-4 text-xs font-bold text-white disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={15}/> : <Save size={15}/>}Salvar orçamento</button>
    </form>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-bold">Orçamentos cadastrados</h2><p className="mt-1 text-xs text-slate-500">{budgets.data?.items.length ?? 0} registros persistidos</p></div>
      {budgets.error ? <p role="alert" className="p-5 text-xs text-red-600">{budgets.error}</p> : budgets.loading ? <div className="p-8 text-center text-xs text-slate-500">Carregando…</div> : !budgets.data?.items.length ? <div className="p-8 text-center text-xs text-slate-500">Nenhum orçamento cadastrado.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr>{['Ano/mês', 'Conta', 'Marca', 'Orçamento', 'Saldo pré-pago', 'Observação', 'Última alteração', 'Ações'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{budgets.data.items.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-4 py-3">{months[item.month - 1]}/{item.year}</td><td className="px-4 py-3 font-semibold">{item.account}</td><td className="px-4 py-3">{item.brand}</td><td className="px-4 py-3 font-semibold">{money.format(Number(item.budget))}</td><td className="px-4 py-3">{item.prepaidBalance === null ? '—' : money.format(Number(item.prepaidBalance))}</td><td className="max-w-48 truncate px-4 py-3 text-slate-500">{item.note || '—'}</td><td className="px-4 py-3 text-[10px] text-slate-500">{new Date(item.changedAt).toLocaleString('pt-BR')}<br/>{item.changedBy ?? item.source}</td><td className="px-4 py-3"><button aria-label="Editar orçamento" onClick={() => edit(item)} className="mr-2 rounded p-2 text-slate-500 hover:bg-slate-100"><Edit3 size={14}/></button><button aria-label="Excluir orçamento" onClick={() => remove(item)} className="rounded p-2 text-red-600 hover:bg-red-50"><Trash2 size={14}/></button></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>{children}{error && <span className="mt-1 block text-[10px] font-medium text-red-600">{error}</span>}</label>; }
