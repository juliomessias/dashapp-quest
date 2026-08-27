import { z } from 'zod';
import { corporateYtd, dayRange, monthRange, rollingTwelveMonths, type DateRange } from './formulas';

export const periodValues = ['dia', 'mes', '12m', 'ytd', 'personalizado'] as const;
export type PeriodValue = (typeof periodValues)[number];
export type FilterAccountOption = { id: string; name: string; brandId: string; brand: string; market: string; analystId: string | null; analyst: string | null };

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
function todayIso() { return new Date().toISOString().slice(0, 10); }
export function parseDateOnly(value: string): Date {
  if (!isoDate.test(value)) throw new Error('Data inválida.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new Error('Data inválida.');
  return date;
}
export function formatDateOnly(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export const globalFilterSchema = z.object({
  ano: z.coerce.number().int().min(2020).max(2100).default(new Date().getFullYear()), periodo: z.enum(periodValues).default('ytd'),
  data: z.string().regex(isoDate).default(todayIso), inicio: z.string().regex(isoDate).optional(), fim: z.string().regex(isoDate).optional(),
  accountId: z.string().optional(), marca: z.string().optional(), mercado: z.string().optional(), analista: z.string().optional(),
});
export type GlobalFilters = z.infer<typeof globalFilterSchema>;

export function parseGlobalFilters(values: Record<string, string | undefined>, fallbackDate = todayIso()): GlobalFilters {
  const parsed = globalFilterSchema.parse({ ...values, data: values.data || fallbackDate });
  parseDateOnly(parsed.data);
  if (parsed.periodo === 'personalizado') {
    if (!parsed.inicio || !parsed.fim) throw new Error('Informe as datas inicial e final.');
    if (parseDateOnly(parsed.fim) < parseDateOnly(parsed.inicio)) throw new Error('A data final não pode ser anterior à inicial.');
  }
  return parsed;
}

export function resolveFilterRange(filters: GlobalFilters): DateRange {
  const selected = parseDateOnly(filters.data);
  if (filters.periodo === 'dia') return dayRange(selected);
  if (filters.periodo === 'mes') return monthRange(selected);
  if (filters.periodo === '12m') return rollingTwelveMonths(selected);
  if (filters.periodo === 'personalizado') return { start: parseDateOnly(filters.inicio!), end: new Date(parseDateOnly(filters.fim!).setHours(23, 59, 59, 999)) };
  return corporateYtd(selected);
}

export function accountMatchesFilters(account: FilterAccountOption, filters: Pick<GlobalFilters, 'accountId' | 'marca' | 'mercado' | 'analista'>) {
  return (!filters.accountId || account.id === filters.accountId)
    && (!filters.marca || account.brandId === filters.marca)
    && (!filters.mercado || account.market === filters.mercado)
    && (!filters.analista || account.analystId === filters.analista);
}

export function sanitizeDependentFilters(filters: GlobalFilters, accounts: FilterAccountOption[]): GlobalFilters {
  const next = { ...filters };
  const selected = accounts.find((account) => account.id === next.accountId);
  if (next.accountId && !selected) delete next.accountId;
  if (selected) {
    if (next.marca && next.marca !== selected.brandId) delete next.marca;
    if (next.mercado && next.mercado !== selected.market) delete next.mercado;
    if (next.analista && next.analista !== selected.analystId) delete next.analista;
  }
  if (next.marca) {
    const scoped = accounts.filter((account) => account.brandId === next.marca);
    if (next.analista && !scoped.some((account) => account.analystId === next.analista)) delete next.analista;
    if (next.mercado && !scoped.some((account) => account.market === next.mercado)) delete next.mercado;
    if (next.accountId && !scoped.some((account) => account.id === next.accountId)) delete next.accountId;
  }
  return next;
}

export function filtersToSearchParams(filters: GlobalFilters) {
  const params = new URLSearchParams();
  params.set('ano', String(filters.ano)); params.set('periodo', filters.periodo); params.set('data', filters.data);
  for (const key of ['inicio', 'fim', 'accountId', 'marca', 'mercado', 'analista'] as const) if (filters[key]) params.set(key, String(filters[key]));
  return params;
}
