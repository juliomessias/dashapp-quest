'use client';

import { useState } from 'react';
import { CheckCircle2, Download, Loader2, UploadCloud } from 'lucide-react';
import { parseImportCsv, type ImportRow } from '@/lib/csv';
import { money } from '@/lib/demo-data';

export function AdminImport() {
  const [file, setFile] = useState<File | null>(null); const [rows, setRows] = useState<ImportRow[]>([]);
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  async function choose(next?: File) {
    setMessage(''); setError(''); setFile(next ?? null);
    if (!next) { setRows([]); return; }
    try { setRows(parseImportCsv(await next.text())); } catch (reason) { setRows([]); setError(reason instanceof Error ? reason.message : 'Arquivo inválido.'); }
  }
  async function submit() {
    if (!file || !rows.length) return; setSaving(true); setError(''); setMessage('');
    try { const form = new FormData(); form.set('file', file); const response = await fetch('/api/import', { method: 'POST', body: form }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'Falha na importação.'); setMessage(`${body.imported} linhas gravadas no banco com sucesso.`); window.dispatchEvent(new CustomEvent('meta-bi:data-changed')); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível importar.'); } finally { setSaving(false); }
  }
  return <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_360px]"><section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold">Importar metas e orçamentos</h2><p className="mt-1 text-xs text-slate-500">O arquivo inteiro é validado antes da gravação. Registros da mesma conta, ano e mês são atualizados.</p>
    <label className="mt-5 flex min-h-[170px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center hover:border-orange-300 hover:bg-orange-50/30"><UploadCloud size={28} className="text-orange-600"/><span className="mt-3 text-sm font-bold text-slate-800">Selecione o arquivo CSV</span><span className="mt-1 text-xs text-slate-500">Até 2 MB · UTF-8</span><input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => choose(event.target.files?.[0])}/></label>
    {file && rows.length > 0 && <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs"><CheckCircle2 size={15} className="text-emerald-600"/><strong>{file.name}</strong><span className="text-slate-500">· {rows.length} linhas válidas</span></div>}{error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>}{message && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-700">{message}</p>}
    <button onClick={submit} disabled={!rows.length || saving} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-xs font-bold text-white disabled:bg-slate-300">{saving && <Loader2 className="animate-spin" size={14}/>}Validar e importar</button>
    {rows.length > 0 && <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-[11px]"><thead className="bg-slate-50"><tr>{['Ano', 'Mês', 'Conta', 'Marca', 'Analista', 'Orçamento'].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}</tr></thead><tbody>{rows.slice(0, 8).map((row, index) => <tr key={`${row.meta_account_id}-${index}`} className="border-t border-slate-100"><td className="px-3 py-2">{row.ano}</td><td className="px-3 py-2">{row.mes}</td><td className="px-3 py-2">{row.conta}</td><td className="px-3 py-2">{row.marca}</td><td className="px-3 py-2">{row.analista}</td><td className="px-3 py-2">{money.format(row.orcamento_mensal)}</td></tr>)}</tbody></table>{rows.length > 8 && <p className="mt-2 text-[10px] text-slate-400">Prévia das primeiras 8 linhas.</p>}</div>}
  </section><aside className="rounded-xl border border-slate-200 bg-white p-5"><Download size={20} className="text-orange-600"/><h3 className="mt-3 text-sm font-bold">Modelo de importação</h3><p className="mt-2 text-xs leading-5 text-slate-500">Use as colunas obrigatórias do modelo. Metas de novembro e dezembro devem permanecer zeradas.</p><a download href="/examples/metas-orcamentos-exemplo.csv" className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"><Download size={14}/>Baixar modelo CSV</a></aside></div>;
}
