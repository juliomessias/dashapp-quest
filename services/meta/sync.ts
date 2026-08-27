import 'server-only';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { adAccounts, metaAccountLinks, metaConnections, metaDailyInsights, reachPeriodCache, syncRuns } from '../../db/schema';
import { getDb } from '../../lib/db';
import { requireMetaConfig } from '../../lib/meta-config';
import { decryptMetaToken } from '../../lib/token-crypto';
import { MetaClient } from './client';
import { fetchAggregatedReach, fetchDailyInsights } from './insights';
import { sanitizeMetaError } from './integration';

export type SyncRange = { start: string; end: string };
type SyncTarget = { accountId: string; metaAccountId: string; connectionId: string; accountLinkId: string; accessToken: string; graphApiVersion: string };

export async function syncAccount(target: SyncTarget, range: SyncRange) {
  const db = await getDb();
  const [run] = await db.insert(syncRuns).values({ connectionId: target.connectionId, accountLinkId: target.accountLinkId, accountId: target.accountId, periodStart: new Date(`${range.start}T00:00:00`), periodEnd: new Date(`${range.end}T00:00:00`), status: 'running' }).returning();
  try {
    const client = new MetaClient(target.accessToken, target.graphApiVersion); const [rows, aggregatedReach] = await Promise.all([fetchDailyInsights(client, target.metaAccountId, range.start, range.end), fetchAggregatedReach(client, target.metaAccountId, range.start, range.end)]);
    for (const row of rows) {
      await db.insert(metaDailyInsights).values({ insightDate: new Date(`${row.date}T00:00:00`), accountId: target.accountId, campaignId: row.campaignId, adsetId: row.adsetId, adId: row.adId, spend: String(row.spend), impressions: String(row.impressions), dailyReach: String(row.dailyReach), engagements: String(row.engagements), videoViews: String(row.videoViews), clicks: String(row.clicks), results: String(row.results), rawData: row.rawData, updatedAt: new Date() })
        .onConflictDoUpdate({ target: [metaDailyInsights.insightDate, metaDailyInsights.accountId, metaDailyInsights.campaignId, metaDailyInsights.adsetId, metaDailyInsights.adId], set: { spend: String(row.spend), impressions: String(row.impressions), dailyReach: String(row.dailyReach), engagements: String(row.engagements), videoViews: String(row.videoViews), clicks: String(row.clicks), results: String(row.results), rawData: row.rawData, updatedAt: new Date() } });
    }
    await db.insert(reachPeriodCache).values({ accountId: target.accountId, level: 'account', startDate: new Date(`${range.start}T00:00:00`), endDate: new Date(`${range.end}T00:00:00`), reach: String(aggregatedReach), expiresAt: range.end >= new Date().toISOString().slice(0, 10) ? new Date(Date.now() + 6 * 60 * 60_000) : null })
      .onConflictDoUpdate({ target: [reachPeriodCache.accountId, reachPeriodCache.level, reachPeriodCache.startDate, reachPeriodCache.endDate], set: { reach: String(aggregatedReach), expiresAt: range.end >= new Date().toISOString().slice(0, 10) ? new Date(Date.now() + 6 * 60 * 60_000) : null, createdAt: new Date() } });
    await db.update(syncRuns).set({ status: 'success', recordCount: rows.length, finishedAt: new Date() }).where(eq(syncRuns.id, run.id));
    await db.update(adAccounts).set({ lastSuccessfulSyncAt: new Date() }).where(eq(adAccounts.id, target.accountId));
    await db.update(metaAccountLinks).set({ accessStatus: 'available', lastAccessTestAt: new Date(), updatedAt: new Date() }).where(eq(metaAccountLinks.id, target.accountLinkId));
    return rows.length;
  } catch (error) {
    await db.update(syncRuns).set({ status: 'failed', finishedAt: new Date(), errorMessage: sanitizeMetaError(error) }).where(eq(syncRuns.id, run.id));
    throw error;
  }
}

export async function syncAllAccounts(range: SyncRange, onlyLinkIds?: string[]) {
  const config = requireMetaConfig(); const db = await getDb();
  const conditions = [eq(metaAccountLinks.syncEnabled, true), eq(adAccounts.status, 'active'), isNotNull(metaConnections.encryptedAccessToken)];
  if (onlyLinkIds?.length) conditions.push(inArray(metaAccountLinks.id, onlyLinkIds));
  const links = await db.select({ accountId: metaAccountLinks.accountId, metaAccountId: metaAccountLinks.metaAccountId, connectionId: metaAccountLinks.connectionId, accountLinkId: metaAccountLinks.id, encryptedAccessToken: metaConnections.encryptedAccessToken })
    .from(metaAccountLinks).innerJoin(adAccounts, eq(metaAccountLinks.accountId, adAccounts.id)).innerJoin(metaConnections, eq(metaAccountLinks.connectionId, metaConnections.id)).where(and(...conditions));
  const result: Array<{ accountId: string; connectionId: string; status: 'success'; count: number } | { accountId: string; connectionId: string; status: 'failed'; error: string }> = [];
  for (const link of links) {
    try {
      const processed = await syncAccount({ accountId: link.accountId, metaAccountId: link.metaAccountId, connectionId: link.connectionId, accountLinkId: link.accountLinkId, accessToken: decryptMetaToken(link.encryptedAccessToken!, config.tokenEncryptionKey), graphApiVersion: config.graphApiVersion }, range);
      result.push({ accountId: link.accountId, connectionId: link.connectionId, status: 'success', count: processed });
    } catch (error) { result.push({ accountId: link.accountId, connectionId: link.connectionId, status: 'failed', error: sanitizeMetaError(error) }); }
  }
  for (const connectionId of new Set(links.map((link) => link.connectionId))) {
    const connectionResults = result.filter((item) => item.connectionId === connectionId); const failed = connectionResults.filter((item) => item.status === 'failed').length;
    await db.update(metaConnections).set({ lastSyncAt: new Date(), lastSyncResult: { status: failed ? (failed === connectionResults.length ? 'failed' : 'partial') : 'success', processedAccounts: connectionResults.length, failedAccounts: failed, range }, updatedAt: new Date() }).where(eq(metaConnections.id, connectionId));
  }
  return result;
}
