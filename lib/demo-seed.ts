import { argon2id, hash } from 'argon2';
import type { AppDb } from './db';
import { adAccounts, analysts, brands, metaDailyInsights, metricDefinitions, metricGoals, monthlyBudgets, socialDailyInsights, users } from '../db/schema';
import { demoAccounts, demoAdminId, demoAnalysts, demoBrands, demoMetricDefinitions } from './demo-fixtures';

function dateOnly(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function daysInMonth(year: number, month: number) { return new Date(year, month, 0).getDate(); }

export async function seedDemoDatabase(db: AppDb) {
  const passwordHash = await hash('Demo@2026', { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  await db.insert(users).values({ id: demoAdminId, name: 'Marina Costa', email: 'admin@demo.local', passwordHash, role: 'admin', active: true }).onConflictDoNothing();
  await db.insert(analysts).values(demoAnalysts.map((item) => ({ ...item }))).onConflictDoNothing();
  await db.insert(brands).values(demoBrands.map((item) => ({ ...item }))).onConflictDoNothing();
  await db.insert(adAccounts).values(demoAccounts.map((item) => ({ id: item.id, metaAccountId: item.metaAccountId, name: item.name, brandId: item.brandId, market: item.market, analystId: item.analystId, currency: 'BRL', timezone: 'America/Sao_Paulo', status: 'active' as const }))).onConflictDoNothing();
  await db.insert(metricDefinitions).values(demoMetricDefinitions.map((item) => ({ ...item }))).onConflictDoNothing();

  const budgetRows = demoAccounts.flatMap((account) => [2025, 2026].flatMap((year) => Array.from({ length: 10 }, (_, index) => ({
    year, month: index + 1, accountId: account.id, budget: (account.monthlyBudget * (.94 + index * .012)).toFixed(2), prepaidBalance: index % 3 === 0 ? (account.monthlyBudget * .16).toFixed(2) : null,
    source: 'demo-seed', changedByUserId: demoAdminId,
  }))));
  for (let index = 0; index < budgetRows.length; index += 100) await db.insert(monthlyBudgets).values(budgetRows.slice(index, index + 100)).onConflictDoNothing();

  const goalRows = demoAccounts.flatMap((account) => [2025, 2026].flatMap((year) => [
    { metricKey: 'spend', value: account.monthlyBudget * 10 }, { metricKey: 'reach', value: 6_400_000 * account.scale },
    { metricKey: 'impressions', value: 11_800_000 * account.scale }, { metricKey: 'engagement', value: 830_000 * account.scale },
    { metricKey: 'video_views', value: 690_000 * account.scale }, { metricKey: 'likes_growth', value: 2100 * account.scale },
    { metricKey: 'followers_growth', value: 1050 * account.scale },
  ].map((goal) => ({ year, month: null, accountId: account.id, brandId: null, metricKey: goal.metricKey, value: goal.value.toFixed(2), source: 'demo-seed', changedByUserId: demoAdminId }))));
  for (let index = 0; index < goalRows.length; index += 100) await db.insert(metricGoals).values(goalRows.slice(index, index + 100)).onConflictDoNothing();

  const insightRows: Array<typeof metaDailyInsights.$inferInsert> = [];
  const socialRows: Array<typeof socialDailyInsights.$inferInsert> = [];
  for (const account of demoAccounts) {
    for (const year of [2025, 2026]) {
      for (let month = 1; month <= 10; month += 1) {
        const monthDays = daysInMonth(year, month); const monthFactor = .88 + month * .018 + (year === 2026 ? .035 : 0);
        for (let day = 1; day <= monthDays; day += 1) {
          const date = dateOnly(new Date(year, month - 1, day)); const rhythm = .88 + (day % 5) * .06;
          const dailySpend = account.monthlySpend * monthFactor * rhythm / monthDays;
          const impressions = Math.round((1_020_000 * account.scale * monthFactor * rhythm) / monthDays);
          insightRows.push({ insightDate: date, accountId: account.id, campaignId: `demo-campaign-${(day % 4) + 1}`, adsetId: 'demo-adset', adId: `demo-ad-${(day % 3) + 1}`,
            spend: dailySpend.toFixed(2), impressions: String(impressions), dailyReach: String(Math.round(impressions * .55)), engagements: String(Math.round(impressions * .071)),
            videoViews: String(Math.round(impressions * .059)), clicks: String(Math.round(impressions * .009)), results: String(Math.round(impressions * .0018)), rawData: { demo: true },
          });
          socialRows.push({ insightDate: date, accountId: account.id, profileId: `demo-profile-${account.id.slice(-3)}`, followersTotal: Math.round(18_000 * account.scale + (month * 31 + day) * 3), likesTotal: Math.round(26_000 * account.scale + (month * 31 + day) * 5), followersDelta: day % 7 === 0 ? -2 : Math.round(3 * account.scale), likesDelta: day % 9 === 0 ? -3 : Math.round(5 * account.scale), source: 'demo-seed' });
        }
      }
    }
  }
  for (let index = 0; index < insightRows.length; index += 400) await db.insert(metaDailyInsights).values(insightRows.slice(index, index + 400)).onConflictDoNothing();
  for (let index = 0; index < socialRows.length; index += 400) await db.insert(socialDailyInsights).values(socialRows.slice(index, index + 400)).onConflictDoNothing();
}
