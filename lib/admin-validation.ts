import { z } from 'zod';

export const metricKeys = ['reach', 'impressions', 'engagement', 'video_views', 'likes_growth', 'followers_growth', 'spend'] as const;
export const metricLabels: Record<(typeof metricKeys)[number], string> = {
  reach: 'Alcance', impressions: 'Impressões', engagement: 'Engajamento', video_views: 'Reproduções de vídeo',
  likes_growth: 'Curtidores', followers_growth: 'Seguidores', spend: 'Investimento',
};

export function parseBrazilianCurrency(input: string | number): number {
  if (typeof input === 'number') return input;
  const value = input.trim().replace(/R\$/gi, '').replace(/\s/g, '');
  if (!value) return Number.NaN;
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value;
  return Number(normalized);
}

const nonNegativeMoney = z.union([z.string(), z.number()]).transform(parseBrazilianCurrency).pipe(z.number().finite().nonnegative());
const optionalMoney = z.union([z.literal(''), z.string(), z.number(), z.null(), z.undefined()]).transform((value) => value === '' || value == null ? null : parseBrazilianCurrency(value)).pipe(z.number().finite().nonnegative().nullable());

export const goalInputSchema = z.object({
  id: z.string().uuid().optional(), year: z.coerce.number().int().min(2020).max(2100), scope: z.enum(['account', 'brand']),
  accountId: z.string().uuid().nullable().optional(), brandId: z.string().uuid().nullable().optional(), metricKey: z.enum(metricKeys),
  type: z.enum(['annual', 'monthly']), month: z.coerce.number().int().min(1).max(10).nullable().optional(), value: nonNegativeMoney,
  note: z.string().max(1000).optional().default(''), replace: z.boolean().optional().default(false),
}).superRefine((value, ctx) => {
  if (value.scope === 'account' && !value.accountId) ctx.addIssue({ code: 'custom', path: ['accountId'], message: 'Selecione a conta.' });
  if (value.scope === 'brand' && !value.brandId) ctx.addIssue({ code: 'custom', path: ['brandId'], message: 'Selecione a marca.' });
  if (value.type === 'monthly' && !value.month) ctx.addIssue({ code: 'custom', path: ['month'], message: 'Selecione um mês entre janeiro e outubro.' });
});

export const budgetInputSchema = z.object({
  id: z.string().uuid().optional(), accountId: z.string().uuid(), year: z.coerce.number().int().min(2020).max(2100), month: z.coerce.number().int().min(1).max(12),
  budget: nonNegativeMoney, prepaidBalance: optionalMoney, note: z.string().max(1000).optional().default(''), replace: z.boolean().optional().default(false),
});

export const brandInputSchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(160), code: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()), active: z.boolean().default(true) });
export const analystInputSchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(160), email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()), active: z.boolean().default(true) });
export const accountInputSchema = z.object({
  id: z.string().uuid().optional(), metaAccountId: z.string().trim().min(3).max(80), name: z.string().trim().min(3).max(220), brandId: z.string().uuid(),
  market: z.string().trim().min(2).max(100), analystId: z.string().uuid().nullable().optional(), facebookPageId: z.string().trim().max(100).nullable().optional(),
  instagramProfileId: z.string().trim().max(100).nullable().optional(), currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default('BRL'),
  timezone: z.string().trim().min(3).max(80).default('America/Sao_Paulo'), status: z.enum(['active', 'paused', 'archived']).default('active'),
});
export const userInputSchema = z.object({
  id: z.string().uuid().optional(), name: z.string().trim().min(2).max(160), email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(200).optional(), role: z.enum(['admin', 'analyst', 'viewer']), active: z.boolean().default(true),
}).superRefine((value, ctx) => { if (!value.id && !value.password) ctx.addIssue({ code: 'custom', path: ['password'], message: 'Informe uma senha com pelo menos 8 caracteres.' }); });

export type GoalInput = z.infer<typeof goalInputSchema>;
export type BudgetInput = z.infer<typeof budgetInputSchema>;
