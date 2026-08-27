export type InsightIdentity = { date: string; accountId: string; campaignId: string; adsetId: string; adId: string };
export function insightKey(row: InsightIdentity) { return `${row.date}:${row.accountId}:${row.campaignId}:${row.adsetId}:${row.adId}`; }
export function upsertInMemory<T extends InsightIdentity>(store: Map<string, T>, row: T) { store.set(insightKey(row), row); return store.size; }
