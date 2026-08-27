import { count } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { adAccounts, metaDailyInsights } from '../../db/schema';

vi.mock('server-only', () => ({}));

describe('banco do modo demonstração', () => {
  it('inicializa migrations, seed e consultas usando o mesmo caminho do servidor', async () => {
    process.env.DEMO_MODE = 'true';
    process.env.DEMO_DATABASE_DIR = '.data/runtime-test-postgres';
    const { getDb } = await import('../../lib/db');
    const db = await getDb();
    const [accounts] = await db.select({ value: count() }).from(adAccounts);
    const [insights] = await db.select({ value: count() }).from(metaDailyInsights);
    expect(accounts.value).toBe(8);
    expect(insights.value).toBeGreaterThan(4_000);
  }, 60_000);
});
