import type { FilterAccountOption, GlobalFilters } from './filters';

export type AnalyticsMetric = { key: string; label: string; value: number | null; goal: number | null; previous: number | null; format: 'currency' | 'number' };
export type PerformanceAccount = FilterAccountOption & {
  metaAccountId: string; analyst: string | null; spent: number; budget: number | null; prepaid: number | null;
  reach: number | null; impressions: number; engagement: number; video: number; likes: number | null; followers: number | null;
  reachGoal: number | null; impressionsGoal: number | null; engagementGoal: number | null; videoGoal: number | null; likesGoal: number | null; followersGoal: number | null;
};
export type CampaignRow = { id: string; campaign: string; spend: number; impressions: number; results: number; cpr: number | null };
export type BalanceRow = PerformanceAccount & { balance: number | null; consumed: number | null; expected: number | null; paceDeviation: number | null; projection: number | null; projectedDifference: number | null; remainingDays: number; recommendedDaily: number | null; status: string; periodLabel: string };
export type AnalyticsResponse = {
  filters: GlobalFilters; range: { start: string; end: string }; options: { accounts: FilterAccountOption[] };
  metrics: AnalyticsMetric[]; accounts: PerformanceAccount[]; trends: Array<{ month: string; realized: number; goal: number; budget: number }>;
  statusCounts: Array<{ name: string; value: number; color: string }>; daily: Array<{ day: string; realized: number; goal: number }>;
  campaigns: CampaignRow[]; balances: BalanceRow[]; empty: boolean; invalidAccount: boolean; updatedAt: string | null;
  integration: { configured: boolean; connectionStatus: string; businessName: string | null; linkedAccounts: number; hasSuccessfulSync: boolean; lastSyncAt: string | null; lastSyncResult: unknown };
};
