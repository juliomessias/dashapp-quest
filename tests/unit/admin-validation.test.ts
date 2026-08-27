import { describe, expect, it } from 'vitest';
import { budgetInputSchema, goalInputSchema, parseBrazilianCurrency } from '../../lib/admin-validation';
import { accountMatchesFilters, parseGlobalFilters, sanitizeDependentFilters, type FilterAccountOption } from '../../lib/filters';

const accounts: FilterAccountOption[] = [
  { id: 'a1', name: 'Conta Brasil', brandId: 'b1', brand: 'Marca A', market: 'Brasil', analystId: 'u1', analyst: 'Ana' },
  { id: 'a2', name: 'Conta Argentina', brandId: 'b2', brand: 'Marca B', market: 'Argentina', analystId: 'u2', analyst: 'Bia' },
];

describe('validação administrativa', () => {
  it('normaliza os três formatos monetários aceitos', () => {
    expect(parseBrazilianCurrency('15000')).toBe(15000);
    expect(parseBrazilianCurrency('15000,50')).toBe(15000.5);
    expect(parseBrazilianCurrency('R$ 15.000,50')).toBe(15000.5);
  });
  it('rejeita meta mensal em novembro e orçamento negativo', () => {
    expect(goalInputSchema.safeParse({ year: 2026, scope: 'account', accountId: '00000000-0000-4000-8000-000000000301', metricKey: 'reach', type: 'monthly', month: 11, value: 1 }).success).toBe(false);
    expect(budgetInputSchema.safeParse({ accountId: '00000000-0000-4000-8000-000000000301', year: 2026, month: 8, budget: '-1' }).success).toBe(false);
  });
});

describe('encadeamento de filtros', () => {
  it('remove dependências incompatíveis e preserva as válidas', () => {
    const filters = parseGlobalFilters({ periodo: 'ytd', data: '2026-08-25', accountId: 'a1', marca: 'b2', mercado: 'Argentina', analista: 'u2' });
    const sanitized = sanitizeDependentFilters(filters, accounts);
    expect(sanitized.accountId).toBe('a1');
    expect(sanitized.marca).toBeUndefined();
    expect(sanitized.mercado).toBeUndefined();
    expect(sanitized.analista).toBeUndefined();
    expect(accountMatchesFilters(accounts[0], sanitized)).toBe(true);
  });
  it('rejeita intervalo personalizado invertido', () => {
    expect(() => parseGlobalFilters({ periodo: 'personalizado', data: '2026-08-25', inicio: '2026-08-20', fim: '2026-08-10' })).toThrow(/final/);
  });
});
