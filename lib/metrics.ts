export type DailyMetric = { date: string; spend: number; impressions: number; engagement: number; videoViews: number; clicks: number; results: number };
export function aggregateAdditiveMetrics(rows: DailyMetric[], aggregatedReach: number) {
  const totals = rows.reduce((acc, row) => ({ spend: acc.spend + row.spend, impressions: acc.impressions + row.impressions, engagement: acc.engagement + row.engagement, videoViews: acc.videoViews + row.videoViews, clicks: acc.clicks + row.clicks, results: acc.results + row.results }), { spend: 0, impressions: 0, engagement: 0, videoViews: 0, clicks: 0, results: 0 });
  return { ...totals, reach: aggregatedReach };
}
