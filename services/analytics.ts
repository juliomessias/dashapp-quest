import 'server-only';
import { and, asc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { adAccounts, analysts, brands, goalMonthlyWeights, metaDailyInsights, metricGoals, monthlyBudgets, reachPeriodCache, socialDailyInsights, userAccountAccess } from '@/db/schema';
import { getDb, type AppDb } from '@/lib/db';
import { accountMatchesFilters, formatDateOnly, parseGlobalFilters, resolveFilterRange, sanitizeDependentFilters, type FilterAccountOption } from '@/lib/filters';
import { calculateBudgetPacing, daysInclusive, endOfDay } from '@/lib/formulas';
import type { AnalyticsMetric, AnalyticsResponse, PerformanceAccount } from '@/lib/analytics-types';
import type { SessionActor } from '@/lib/server-auth';
import { getDashboardIntegrationState } from '@/services/meta/integration';

type AccountRecord = FilterAccountOption & { metaAccountId: string; brandId: string; lastSuccessfulSyncAt: Date | null };
type GoalRecord = typeof metricGoals.$inferSelect;
type BudgetRecord = typeof monthlyBudgets.$inferSelect;
type WeightRecord = typeof goalMonthlyWeights.$inferSelect;

const labels: Record<string, string> = { spend: 'Investimento', reach: 'Alcance', impressions: 'Impressões', engagement: 'Engajamentos', video_views: 'Rep. de vídeo', likes_growth: 'Curtidores', followers_growth: 'Seguidores' };
const campaignLabels = ['Always On · Alcance', 'Verão Conti 2026', 'Vídeo Institucional', 'Conversão · PDV'];

async function authorizedAccounts(db: AppDb, actor: SessionActor): Promise<AccountRecord[]> {
  let allowedIds: string[] | null = null;
  if (actor.role !== 'admin') {
    const access = await db.select({ accountId: userAccountAccess.accountId }).from(userAccountAccess).where(eq(userAccountAccess.userId, actor.id));
    allowedIds = access.map((item) => item.accountId);
    if (!allowedIds.length) return [];
  }
  const conditions = [eq(adAccounts.status, 'active')];
  if (allowedIds) conditions.push(inArray(adAccounts.id, allowedIds));
  return db.select({
    id: adAccounts.id, metaAccountId: adAccounts.metaAccountId, name: adAccounts.name, brandId: brands.id, brand: brands.name,
    market: adAccounts.market, analystId: analysts.id, analyst: analysts.name, lastSuccessfulSyncAt: adAccounts.lastSuccessfulSyncAt,
  }).from(adAccounts).innerJoin(brands, eq(adAccounts.brandId, brands.id)).leftJoin(analysts, eq(adAccounts.analystId, analysts.id)).where(and(...conditions)).orderBy(asc(adAccounts.name));
}

function previousRange(start: Date, end: Date) {
  const duration = daysInclusive(start, end); const previousEnd = new Date(start); previousEnd.setDate(previousEnd.getDate() - 1); const previousStart = new Date(previousEnd); previousStart.setDate(previousStart.getDate() - duration + 1);
  return { start: previousStart, end: endOfDay(previousEnd) };
}

async function aggregateActuals(db: AppDb, accountIds: string[], start: Date, end: Date) {
  if (!accountIds.length) return { media: [], social: [] };
  const media = await db.select({
    accountId: metaDailyInsights.accountId, spend: sql<string>`coalesce(sum(${metaDailyInsights.spend}), 0)`, impressions: sql<string>`coalesce(sum(${metaDailyInsights.impressions}), 0)`,
    engagements: sql<string>`coalesce(sum(${metaDailyInsights.engagements}), 0)`, videoViews: sql<string>`coalesce(sum(${metaDailyInsights.videoViews}), 0)`,
  }).from(metaDailyInsights).where(and(inArray(metaDailyInsights.accountId, accountIds), gte(metaDailyInsights.insightDate, start), lte(metaDailyInsights.insightDate, end))).groupBy(metaDailyInsights.accountId);
  const social = await db.select({ accountId: socialDailyInsights.accountId, followers: sql<number>`coalesce(sum(${socialDailyInsights.followersDelta}), 0)::int`, likes: sql<number>`coalesce(sum(${socialDailyInsights.likesDelta}), 0)::int` })
    .from(socialDailyInsights).where(and(inArray(socialDailyInsights.accountId, accountIds), gte(socialDailyInsights.insightDate, start), lte(socialDailyInsights.insightDate, end))).groupBy(socialDailyInsights.accountId);
  return { media, social };
}

function monthsInRange(start: Date, end: Date) {
  const result: Array<{ year: number; month: number; start: Date; end: Date }> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const monthStart = new Date(cursor); const monthEnd = endOfDay(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
    result.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1, start: start > monthStart ? start : monthStart, end: end < monthEnd ? end : monthEnd });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}

function goalForAccount(account: Pick<AccountRecord, 'id' | 'brandId'>, metricKey: string, range: { start: Date; end: Date }, goals: GoalRecord[], weights: WeightRecord[]) {
  let total = 0; let configured = false;
  for (const period of monthsInRange(range.start, range.end)) {
    if (period.month > 10) continue;
    const monthly = goals.find((goal) => goal.year === period.year && goal.month === period.month && goal.metricKey === metricKey && goal.accountId === account.id)
      ?? goals.find((goal) => goal.year === period.year && goal.month === period.month && goal.metricKey === metricKey && !goal.accountId && goal.brandId === account.brandId);
    const annual = goals.find((goal) => goal.year === period.year && goal.month === null && goal.metricKey === metricKey && goal.accountId === account.id)
      ?? goals.find((goal) => goal.year === period.year && goal.month === null && goal.metricKey === metricKey && !goal.accountId && goal.brandId === account.brandId);
    if (!monthly && !annual) continue;
    configured = true;
    const base = monthly ? Number(monthly.value) : Number(annual!.value) * Number(weights.find((weight) => weight.year === period.year && weight.month === period.month && weight.accountId === account.id)?.weight
      ?? weights.find((weight) => weight.year === period.year && weight.month === period.month && !weight.accountId && weight.brandId === account.brandId)?.weight ?? .1);
    const fullDays = new Date(period.year, period.month, 0).getDate();
    total += base * daysInclusive(period.start, period.end) / fullDays;
  }
  return configured ? total : null;
}

function budgetForAccount(accountId: string, range: { start: Date; end: Date }, budgets: BudgetRecord[]) {
  const matching = budgets.filter((budget) => budget.accountId === accountId && monthsInRange(range.start, range.end).some((period) => period.year === budget.year && period.month === budget.month));
  if (!matching.length) return { budget: null, prepaid: null };
  return { budget: matching.reduce((sum, item) => sum + Number(item.budget), 0), prepaid: matching.some((item) => item.prepaidBalance !== null) ? matching.reduce((sum, item) => sum + Number(item.prepaidBalance ?? 0), 0) : null };
}

function totalMetric(accounts: PerformanceAccount[], key: keyof PerformanceAccount) {
  if (!accounts.length) return null;
  const values = accounts.map((account) => account[key]).filter((value): value is number => typeof value === 'number');
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

export async function getAnalytics(searchParams: URLSearchParams, actor: SessionActor): Promise<AnalyticsResponse> {
  const db = await getDb(); const [allAccounts, integration] = await Promise.all([authorizedAccounts(db, actor), getDashboardIntegrationState()]);
  const input = Object.fromEntries(searchParams.entries());
  const fallbackDate = process.env.DEMO_MODE === 'true' ? '2026-08-25' : undefined;
  const parsed = parseGlobalFilters(input, fallbackDate); const filters = sanitizeDependentFilters(parsed, allAccounts);
  const range = resolveFilterRange(filters); const invalidAccount = Boolean(input.accountId && !allAccounts.some((account) => account.id === input.accountId));
  const scoped = allAccounts.filter((account) => accountMatchesFilters(account, filters)); const accountIds = scoped.map((account) => account.id);
  const years = Array.from(new Set(monthsInRange(range.start, range.end).map((period) => period.year)));
  const [actuals, goals, budgets, weights, reachCache, previous] = await Promise.all([
    aggregateActuals(db, accountIds, range.start, range.end),
    accountIds.length ? db.select().from(metricGoals).where(and(inArray(metricGoals.year, years), or(inArray(metricGoals.accountId, accountIds), inArray(metricGoals.brandId, Array.from(new Set(scoped.map((account) => account.brandId))))))) : Promise.resolve([]),
    accountIds.length ? db.select().from(monthlyBudgets).where(and(inArray(monthlyBudgets.accountId, accountIds), inArray(monthlyBudgets.year, years))) : Promise.resolve([]),
    db.select().from(goalMonthlyWeights).where(inArray(goalMonthlyWeights.year, years)),
    accountIds.length ? db.select().from(reachPeriodCache).where(and(inArray(reachPeriodCache.accountId, accountIds), eq(reachPeriodCache.startDate, range.start), eq(reachPeriodCache.endDate, range.end))) : Promise.resolve([]),
    aggregateActuals(db, accountIds, previousRange(range.start, range.end).start, previousRange(range.start, range.end).end),
  ]);
  const mediaByAccount = new Map(actuals.media.map((row) => [row.accountId, row])); const socialByAccount = new Map(actuals.social.map((row) => [row.accountId, row]));
  const previousMedia = new Map(previous.media.map((row) => [row.accountId, row])); const previousSocial = new Map(previous.social.map((row) => [row.accountId, row]));
  const cacheByAccount = new Map(reachCache.map((row) => [row.accountId, Number(row.reach)]));
  const performance = scoped.flatMap<PerformanceAccount>((account) => {
    const media = mediaByAccount.get(account.id); if (!media) return [];
    const social = socialByAccount.get(account.id); const budget = budgetForAccount(account.id, range, budgets);
    const impressions = Number(media.impressions); const reach = cacheByAccount.get(account.id) ?? (process.env.DEMO_MODE === 'true' ? Math.round(impressions * .55) : null);
    return [{ ...account, spent: Number(media.spend), budget: budget.budget, prepaid: budget.prepaid, reach, impressions, engagement: Number(media.engagements), video: Number(media.videoViews), likes: social ? Number(social.likes) : null, followers: social ? Number(social.followers) : null,
      reachGoal: goalForAccount(account, 'reach', range, goals, weights), impressionsGoal: goalForAccount(account, 'impressions', range, goals, weights), engagementGoal: goalForAccount(account, 'engagement', range, goals, weights),
      videoGoal: goalForAccount(account, 'video_views', range, goals, weights), likesGoal: goalForAccount(account, 'likes_growth', range, goals, weights), followersGoal: goalForAccount(account, 'followers_growth', range, goals, weights) }];
  });
  const previousTotals = {
    spend: Array.from(previousMedia.values()).reduce((sum, row) => sum + Number(row.spend), 0), impressions: Array.from(previousMedia.values()).reduce((sum, row) => sum + Number(row.impressions), 0),
    reach: process.env.DEMO_MODE === 'true' ? Array.from(previousMedia.values()).reduce((sum, row) => sum + Math.round(Number(row.impressions) * .55), 0) : null,
    engagement: Array.from(previousMedia.values()).reduce((sum, row) => sum + Number(row.engagements), 0), video: Array.from(previousMedia.values()).reduce((sum, row) => sum + Number(row.videoViews), 0),
    likes: previousSocial.size ? Array.from(previousSocial.values()).reduce((sum, row) => sum + Number(row.likes), 0) : null, followers: previousSocial.size ? Array.from(previousSocial.values()).reduce((sum, row) => sum + Number(row.followers), 0) : null,
  };
  const spendGoal = scoped.map((account) => goalForAccount(account, 'spend', range, goals, weights)).filter((value): value is number => value !== null).reduce((sum, value) => sum + value, 0);
  const metrics: AnalyticsMetric[] = [
    { key: 'investment', label: labels.spend, value: totalMetric(performance, 'spent'), goal: spendGoal || totalMetric(performance, 'budget'), previous: previousTotals.spend, format: 'currency' },
    { key: 'reach', label: labels.reach, value: totalMetric(performance, 'reach'), goal: totalMetric(performance, 'reachGoal'), previous: previousTotals.reach, format: 'number' },
    { key: 'impressions', label: labels.impressions, value: totalMetric(performance, 'impressions'), goal: totalMetric(performance, 'impressionsGoal'), previous: previousTotals.impressions, format: 'number' },
    { key: 'engagement', label: labels.engagement, value: totalMetric(performance, 'engagement'), goal: totalMetric(performance, 'engagementGoal'), previous: previousTotals.engagement, format: 'number' },
    { key: 'video', label: labels.video_views, value: totalMetric(performance, 'video'), goal: totalMetric(performance, 'videoGoal'), previous: previousTotals.video, format: 'number' },
    { key: 'likes', label: labels.likes_growth, value: totalMetric(performance, 'likes'), goal: totalMetric(performance, 'likesGoal'), previous: previousTotals.likes, format: 'number' },
    { key: 'followers', label: labels.followers_growth, value: totalMetric(performance, 'followers'), goal: totalMetric(performance, 'followersGoal'), previous: previousTotals.followers, format: 'number' },
  ];
  const dailyRows = accountIds.length ? await db.select({ date: metaDailyInsights.insightDate, spend: sql<string>`sum(${metaDailyInsights.spend})` }).from(metaDailyInsights)
    .where(and(inArray(metaDailyInsights.accountId, accountIds), gte(metaDailyInsights.insightDate, range.start), lte(metaDailyInsights.insightDate, range.end))).groupBy(metaDailyInsights.insightDate).orderBy(metaDailyInsights.insightDate) : [];
  const trendPeriods = monthsInRange(range.start, range.end); const trends = trendPeriods.map((period) => ({
    month: new Intl.DateTimeFormat('pt-BR', { month: 'short', year: trendPeriods.length > 10 ? '2-digit' : undefined }).format(period.start).replace('.', ''),
    realized: dailyRows.filter((row) => row.date.getFullYear() === period.year && row.date.getMonth() + 1 === period.month).reduce((sum, row) => sum + Number(row.spend), 0),
    goal: scoped.reduce((sum, account) => sum + (goalForAccount(account, 'spend', { start: period.start, end: period.end }, goals, weights) ?? 0), 0),
    budget: scoped.reduce((sum, account) => sum + (budgetForAccount(account.id, { start: period.start, end: period.end }, budgets).budget ?? 0), 0),
  }));
  const selectedAccount = performance.length === 1 ? performance[0] : null;
  const daily = dailyRows.map((row) => ({ day: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(row.date), realized: Number(row.spend), goal: selectedAccount ? (goalForAccount(selectedAccount, 'spend', { start: row.date, end: endOfDay(row.date) }, goals, weights) ?? 0) : 0 }));
  const campaigns = selectedAccount ? await db.select({ id: metaDailyInsights.campaignId, spend: sql<string>`sum(${metaDailyInsights.spend})`, impressions: sql<string>`sum(${metaDailyInsights.impressions})`, results: sql<string>`sum(${metaDailyInsights.results})` }).from(metaDailyInsights)
    .where(and(eq(metaDailyInsights.accountId, selectedAccount.id), gte(metaDailyInsights.insightDate, range.start), lte(metaDailyInsights.insightDate, range.end))).groupBy(metaDailyInsights.campaignId).then((rows) => rows.map((row, index) => ({ id: row.id, campaign: campaignLabels[index % campaignLabels.length], spend: Number(row.spend), impressions: Number(row.impressions), results: Number(row.results), cpr: Number(row.results) ? Number(row.spend) / Number(row.results) : null }))) : [];
  const totalDays = trendPeriods.reduce((sum, period) => sum + new Date(period.year, period.month, 0).getDate(), 0); const elapsed = daysInclusive(range.start, range.end);
  const balances = performance.map((account) => { const pacing = account.budget === null ? null : calculateBudgetPacing(account.budget, account.spent, elapsed, totalDays); return { ...account, balance: pacing?.balance ?? null, consumed: pacing?.consumed ?? null, expected: pacing?.expected ?? null, paceDeviation: pacing?.paceDeviation ?? null, projection: pacing?.projection ?? null, projectedDifference: pacing?.projectedDifference ?? null, remainingDays: pacing?.remainingDays ?? 0, recommendedDaily: pacing?.recommendedDaily ?? null, status: pacing?.status ?? 'Sem orçamento', periodLabel: `${formatDateOnly(range.start)}–${formatDateOnly(range.end)}` }; });
  const within = performance.filter((account) => account.budget && account.spent / account.budget >= .9 && account.spent / account.budget <= 1.05).length;
  const below = performance.filter((account) => account.budget && account.spent / account.budget < .9).length; const risk = performance.length - within - below;
  return { filters, range: { start: formatDateOnly(range.start), end: formatDateOnly(range.end) }, options: { accounts: allAccounts }, metrics, accounts: performance, trends,
    statusCounts: [{ name: 'Dentro da meta', value: within, color: '#15803d' }, { name: 'Próximas', value: below, color: '#d97706' }, { name: 'Abaixo', value: risk, color: '#dc2626' }], daily, campaigns, balances,
    empty: performance.length === 0, invalidAccount, updatedAt: scoped.map((account) => account.lastSuccessfulSyncAt).filter(Boolean).sort().at(-1)?.toISOString() ?? null, integration };
}
