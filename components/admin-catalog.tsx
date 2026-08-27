'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { CheckCircle2, Edit3, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import type { AdminAccount, AdminAnalyst, AdminBrand, AdminCatalog, AdminUser } from '@/lib/admin-types';
import { accountInputSchema, analystInputSchema, brandInputSchema, userInputSchema } from '@/lib/admin-validation';
import { mutateAdmin, useAdminResource } from '@/lib/use-admin-resource';

type Entity = 'accounts' | 'brands' | 'analysts' | 'users';
type FormData = Record<string, string | boolean>;
const input = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-orange-400';
const labels: Record<Entity, string> = { accounts: 'Contas', brands: 'Marcas', analysts: 'Analistas', users: 'Usuários' };

function initial(entity: Entity): FormData {
  if (entity === 'accounts') return { id: '', name: '', metaAccountId: '', brandId: '', market: 'Brasil', analystId: '', facebookPageId: '', instagramProfileId: '', currency: 'BRL', timezone: 'America/Sao_Paulo', status: 'active' };
  if (entity === 'brands') return { id: '', name: '', code: '', active: true };
  if (entity === 'analysts') return { id: '', name: '', email: '', active: true };
  return { id: '', name: '', email: '', password: '', role: 'viewer', active: true };
}

export function AdminCatalogs() {
  const catalog = useAdminResource<AdminCatalog>('catalog');
  const [entity, setEntity] = useState<Entity>('accounts');
  const [form, setForm] = useState<FormData>(initial('accounts'));
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({}); const [saving, setSaving] = useState(false);
  const rows = useMemo(() => catalog.data?.[entity] ?? [], [catalog.data, entity]);

  function changeEntity(next: Entity) { setEntity(next); setForm(initial(next)); setMessage(''); setError(''); setFieldErrors({}); }
  function update(key: string, value: string | boolean) { setForm((current) => ({ ...current, [key]: value })); }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage(''); setFieldErrors({});
    const body: Record<string, unknown> = { ...form };
    if (!body.id) delete body.id;
    if (entity === 'users' && !body.password) delete body.password;
    if (entity === 'accounts') {
      body.analystId = body.analystId || null; body.facebookPageId = body.facebookPageId || null; body.instagramProfileId = body.instagramProfileId || null;
    }
    const validator=entity==='accounts'?accountInputSchema:entity==='brands'?brandInputSchema:entity==='analysts'?analystInputSchema:userInputSchema;
    const parsed=validator.safeParse(body);
    if(!parsed.success){setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue)=>[String(issue.path[0]),issue.message])));return;}
    setSaving(true);
    try {
      await mutateAdmin(entity, form.id ? 'PATCH' : 'POST', parsed.data as Record<string,unknown>);
      setMessage(`${labels[entity].slice(0, -1)} ${form.id ? 'atualizado' : 'criado'} com sucesso.`);
      setForm(initial(entity)); catalog.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.'); }
    finally { setSaving(false); }
  }

  function edit(row: AdminAccount | AdminBrand | AdminAnalyst | AdminUser) {
    if (entity === 'accounts') { const item = row as AdminAccount; setForm({ id:item.id,name:item.name,metaAccountId:item.metaAccountId,brandId:item.brandId,market:item.market,analystId:item.analystId??'',facebookPageId:item.facebookPageId??'',instagramProfileId:item.instagramProfileId??'',currency:item.currency,timezone:item.timezone,status:item.status }); }
    else if (entity === 'brands') { const item = row as AdminBrand; setForm({ id: item.id, name: item.name, code: item.code, active: item.active }); }
    else if (entity === 'analysts') { const item = row as AdminAnalyst; setForm({ id: item.id, name: item.name, email: item.email, active: item.active }); }
    else { const item = row as AdminUser; setForm({ id: item.id, name: item.name, email: item.email, password: '', role: item.role, active: item.active }); }
    setError(''); setMessage(''); setFieldErrors({}); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(row: AdminAccount | AdminBrand | AdminAnalyst | AdminUser) {
    const verb = entity === 'accounts' ? 'arquivar' : entity === 'users' ? 'desativar' : 'excluir';
    if (!confirm(`Deseja ${verb} “${row.name}”?`)) return;
    try { await mutateAdmin(entity, 'DELETE', undefined, row.id); setMessage(`Registro ${verb === 'excluir' ? 'excluído' : `${verb}ado`} com sucesso.`); catalog.reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível concluir.'); }
  }

  return <div className="mt-5 space-y-4">
    <div className="flex flex-wrap gap-2">{(Object.keys(labels) as Entity[]).map((item) => <button key={item} onClick={() => changeEntity(item)} className={`rounded-lg px-3 py-2 text-xs font-bold ${entity === item ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{labels[item]} <span className="ml-1 opacity-60">{catalog.data?.[item].length ?? 0}</span></button>)}</div>
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold">{form.id ? `Editar ${labels[entity].toLowerCase()}` : `Novo cadastro · ${labels[entity]}`}</h2><p className="mt-1 text-xs text-slate-500">A alteração é validada, persistida e registrada no histórico.</p></div>{form.id && <button type="button" onClick={() => setForm(initial(entity))} className="text-xs font-semibold text-slate-500">Cancelar edição</button>}</div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Fields entity={entity} form={form} update={update} catalog={catalog.data} errors={fieldErrors}/></div>
      {error && <p role="alert" className="mt-3 text-xs font-medium text-red-600">{error}</p>}{message && <p role="status" className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700"><CheckCircle2 size={14}/>{message}</p>}
      <button disabled={saving} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-orange-600 px-4 text-xs font-bold text-white disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={15}/> : form.id ? <Save size={15}/> : <Plus size={15}/>} {form.id ? 'Salvar alterações' : 'Criar cadastro'}</button>
    </form>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-bold">{labels[entity]}</h2><p className="mt-1 text-xs text-slate-500">Cadastros disponíveis na base</p></div>{catalog.error ? <p role="alert" className="p-5 text-xs text-red-600">{catalog.error}</p> : catalog.loading ? <div className="p-8 text-center text-xs text-slate-500">Carregando…</div> : !rows.length ? <div className="p-8 text-center text-xs text-slate-500">Nenhum registro.</div> : <CatalogTable entity={entity} rows={rows} onEdit={edit} onRemove={remove}/>}</section>
  </div>;
}

function Fields({ entity, form, update, catalog, errors }: { entity: Entity; form: FormData; update: (key: string, value: string | boolean) => void; catalog: AdminCatalog | null;errors:Record<string,string> }) {
  if (entity === 'accounts') return <><Field label="Nome" error={errors.name}><input required minLength={3} className={input} value={String(form.name)} onChange={(event) => update('name', event.target.value)}/></Field><Field label="ID Meta" error={errors.metaAccountId}><input required minLength={3} className={input} value={String(form.metaAccountId)} onChange={(event) => update('metaAccountId', event.target.value)}/></Field><Field label="Marca" error={errors.brandId}><select required className={input} value={String(form.brandId)} onChange={(event) => update('brandId', event.target.value)}><option value="">Selecione</option>{catalog?.brands.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Mercado" error={errors.market}><input required className={input} value={String(form.market)} onChange={(event) => update('market', event.target.value)}/></Field><Field label="Analista" error={errors.analystId}><select className={input} value={String(form.analystId)} onChange={(event) => update('analystId', event.target.value)}><option value="">Sem responsável</option>{catalog?.analysts.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Moeda" error={errors.currency}><input required maxLength={3} className={input} value={String(form.currency)} onChange={(event) => update('currency', event.target.value)}/></Field><Field label="Fuso horário" error={errors.timezone}><input required className={input} value={String(form.timezone)} onChange={(event) => update('timezone', event.target.value)}/></Field><Field label="Status" error={errors.status}><select className={input} value={String(form.status)} onChange={(event) => update('status', event.target.value)}><option value="active">Ativa</option><option value="paused">Pausada</option><option value="archived">Arquivada</option></select></Field><Field label="Página do Facebook" error={errors.facebookPageId}><input className={input} value={String(form.facebookPageId)} onChange={(event) => update('facebookPageId', event.target.value)}/></Field><Field label="Perfil do Instagram" error={errors.instagramProfileId}><input className={input} value={String(form.instagramProfileId)} onChange={(event) => update('instagramProfileId', event.target.value)}/></Field></>;
  if (entity === 'brands') return <><Field label="Nome" error={errors.name}><input required minLength={2} className={input} value={String(form.name)} onChange={(event) => update('name', event.target.value)}/></Field><Field label="Código" error={errors.code}><input required minLength={2} maxLength={40} className={input} value={String(form.code)} onChange={(event) => update('code', event.target.value)}/></Field><ActiveField value={Boolean(form.active)} update={update}/></>;
  if (entity === 'analysts') return <><Field label="Nome" error={errors.name}><input required minLength={2} className={input} value={String(form.name)} onChange={(event) => update('name', event.target.value)}/></Field><Field label="E-mail" error={errors.email}><input required type="email" className={input} value={String(form.email)} onChange={(event) => update('email', event.target.value)}/></Field><ActiveField value={Boolean(form.active)} update={update}/></>;
  return <><Field label="Nome" error={errors.name}><input required minLength={2} className={input} value={String(form.name)} onChange={(event) => update('name', event.target.value)}/></Field><Field label="E-mail" error={errors.email}><input required type="email" className={input} value={String(form.email)} onChange={(event) => update('email', event.target.value)}/></Field><Field label={form.id ? 'Nova senha (opcional)' : 'Senha'} error={errors.password}><input required={!form.id} minLength={8} type="password" className={input} value={String(form.password)} onChange={(event) => update('password', event.target.value)}/></Field><Field label="Perfil" error={errors.role}><select className={input} value={String(form.role)} onChange={(event) => update('role', event.target.value)}><option value="admin">Administrador</option><option value="analyst">Analista</option><option value="viewer">Visualizador</option></select></Field><ActiveField value={Boolean(form.active)} update={update}/></>;
}

function ActiveField({ value, update }: { value: boolean; update: (key: string, value: boolean) => void }) { return <Field label="Situação"><label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs"><input type="checkbox" checked={value} onChange={(event) => update('active', event.target.checked)}/>Ativo</label></Field>; }

function CatalogTable({ entity, rows, onEdit, onRemove }: { entity: Entity; rows: (AdminAccount | AdminBrand | AdminAnalyst | AdminUser)[]; onEdit: (row: AdminAccount | AdminBrand | AdminAnalyst | AdminUser) => void; onRemove: (row: AdminAccount | AdminBrand | AdminAnalyst | AdminUser) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr>{(entity === 'accounts' ? ['Nome', 'ID Meta', 'Marca', 'Mercado', 'Analista', 'Status'] : entity === 'brands' ? ['Nome', 'Código', 'Situação'] : entity === 'analysts' ? ['Nome', 'E-mail', 'Situação'] : ['Nome', 'E-mail', 'Perfil', 'Situação']).map((label) => <th key={label} className="px-4 py-3">{label}</th>)}<th className="px-4 py-3">Ações</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100">{entity === 'accounts' ? <AccountCells item={row as AdminAccount}/> : entity === 'brands' ? <><Cell strong>{row.name}</Cell><Cell>{(row as AdminBrand).code}</Cell><StateCell active={(row as AdminBrand).active}/></> : entity === 'analysts' ? <><Cell strong>{row.name}</Cell><Cell>{(row as AdminAnalyst).email}</Cell><StateCell active={(row as AdminAnalyst).active}/></> : <><Cell strong>{row.name}</Cell><Cell>{(row as AdminUser).email}</Cell><Cell>{(row as AdminUser).role}</Cell><StateCell active={(row as AdminUser).active}/></>}<td className="px-4 py-3"><button aria-label="Editar cadastro" onClick={() => onEdit(row)} className="mr-2 rounded p-2 text-slate-500 hover:bg-slate-100"><Edit3 size={14}/></button><button aria-label="Excluir ou desativar cadastro" onClick={() => onRemove(row)} className="rounded p-2 text-red-600 hover:bg-red-50"><Trash2 size={14}/></button></td></tr>)}</tbody></table></div>;
}
function AccountCells({ item }: { item: AdminAccount }) { return <><Cell strong>{item.name}</Cell><Cell>{item.metaAccountId}</Cell><Cell>{item.brand}</Cell><Cell>{item.market}</Cell><Cell>{item.analyst ?? '—'}</Cell><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.status}</span></td></>; }
function Cell({ children, strong = false }: { children: ReactNode; strong?: boolean }) { return <td className={`px-4 py-3 ${strong ? 'font-semibold' : ''}`}>{children}</td>; }
function StateCell({ active }: { active: boolean }) { return <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{active ? 'Ativo' : 'Inativo'}</span></td>; }
function Field({ label,error, children }: { label: string;error?:string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>{children}{error&&<span className="mt-1 block text-[10px] font-medium text-red-600">{error}</span>}</label>; }
