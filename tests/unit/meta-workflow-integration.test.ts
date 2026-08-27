import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { count, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../../db/schema';
import { beginMetaAuthorization, completeMetaAuthorization, disconnectMeta, getMetaIntegrationState, linkMetaAccounts, testMetaConnection, unlinkMetaAccount } from '../../services/meta/integration';
import { syncAllAccounts } from '../../services/meta/sync';

vi.mock('server-only', () => ({}));

const actor = { id: '00000000-0000-4000-8000-000000000001', role: 'admin' as const, name: 'Admin' };
let client: PGlite;

async function migrate(db: PGlite) {
  for (const tag of ['0000_initial', '0001_freezing_exiles', '0002_left_frog_thor', '0003_woozy_starhawk']) {
    const sql = await readFile(resolve(process.cwd(), `db/migrations/${tag}.sql`), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint').map((part) => part.trim()).filter(Boolean)) await db.exec(statement);
  }
}

function oauthMock(permissions = ['ads_read', 'read_insights', 'business_management']) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/oauth/access_token')) return Response.json({ access_token: url.searchParams.has('grant_type') ? 'EAA-long-lived-token' : 'EAA-short-token', expires_in: 5_184_000 });
    if (url.pathname.endsWith('/me/permissions')) return Response.json({ data: permissions.map((permission) => ({ permission, status: 'granted' })) });
    if (url.pathname.endsWith('/me/businesses')) return Response.json({ data: [] });
    if (url.pathname.endsWith('/me/adaccounts')) return Response.json({ data: [
      { id: 'act_111', account_id: '111', name: 'Conta Um', account_status: 1, currency: 'BRL', timezone_name: 'America/Sao_Paulo' },
      { id: 'act_222', account_id: '222', name: 'Conta Dois', account_status: 1, currency: 'BRL', timezone_name: 'America/Sao_Paulo' },
    ] });
    if (url.pathname.endsWith('/me')) return Response.json({ id: 'user-meta', name: 'Responsável Meta' });
    return Response.json({ error: { message: 'Endpoint inesperado', code: 100 } }, { status: 400 });
  });
}

beforeEach(async () => {
  client = await PGlite.create(); await migrate(client); const db = drizzle({ client, schema });
  globalThis.__metaBiDbPromise = Promise.resolve(db as never);
  await db.insert(schema.users).values({ id: actor.id, name: 'Admin', email: 'admin@company.test', passwordHash: 'hash', role: 'admin' });
  await db.insert(schema.brands).values([{ id: '00000000-0000-4000-8000-000000000101', name: 'Marca A', code: 'A' }, { id: '00000000-0000-4000-8000-000000000102', name: 'Marca B', code: 'B' }]);
  await db.insert(schema.analysts).values({ id: '00000000-0000-4000-8000-000000000201', name: 'Analista', email: 'analista@company.test' });
  vi.stubEnv('META_APP_ID', '123'); vi.stubEnv('META_APP_SECRET', 'server-secret'); vi.stubEnv('META_REDIRECT_URI', 'https://bi.example.com/api/meta/callback'); vi.stubEnv('META_GRAPH_API_VERSION', 'v25.0'); vi.stubEnv('META_TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 9).toString('base64')); vi.stubEnv('CRON_SECRET', 'cron-secret'); vi.stubEnv('DATABASE_URL', 'postgresql://not-used'); vi.stubEnv('DEMO_MODE', 'false');
}, 30_000);

afterEach(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); globalThis.__metaBiDbPromise = undefined; await client.close(); });

describe('fluxo persistente da integração Meta', () => {
  it('valida state, persiste token cifrado, lista, vincula, sincroniza e preserva histórico', async () => {
    await expect(completeMetaAuthorization('state-inexistente', 'code')).rejects.toThrow('STATE_INVALID');
    vi.stubGlobal('fetch', oauthMock());
    const authorizationUrl = new URL(await beginMetaAuthorization(actor)); const state = authorizationUrl.searchParams.get('state')!;
    await expect(completeMetaAuthorization(state, 'valid-code')).resolves.toMatchObject({ status: 'connected' });
    await expect(completeMetaAuthorization(state, 'reused-code')).rejects.toThrow('STATE_INVALID');

    const db = drizzle({ client, schema }); const [storedConnection] = await db.select().from(schema.metaConnections);
    expect(storedConnection.encryptedAccessToken).toBeTruthy(); expect(storedConnection.encryptedAccessToken).not.toContain('EAA-long-lived-token');
    const stateResponse = await getMetaIntegrationState(); expect(stateResponse.counts.available).toBe(2); expect(JSON.stringify(stateResponse)).not.toContain('EAA-'); expect(JSON.stringify(stateResponse)).not.toContain('encryptedAccessToken');

    const available = await db.select().from(schema.metaAvailableAccounts); const historyStartDate = '2026-08-01';
    const linkIds = await linkMetaAccounts(actor, available.map((account, index) => ({ availableAccountId: account.id, brandId: index ? '00000000-0000-4000-8000-000000000102' : '00000000-0000-4000-8000-000000000101', market: 'Brasil', analystId: '00000000-0000-4000-8000-000000000201', historyStartDate })));
    expect(linkIds).toHaveLength(2);
    await linkMetaAccounts(actor, [{ availableAccountId: available[0].id, brandId: '00000000-0000-4000-8000-000000000101', market: 'Brasil', analystId: null, historyStartDate }]);
    const [linkCount] = await db.select({ value: count() }).from(schema.metaAccountLinks); expect(linkCount.value).toBe(2);

    const links = await db.select().from(schema.metaAccountLinks); await db.insert(schema.metaDailyInsights).values({ insightDate: new Date('2026-08-20T00:00:00'), accountId: links[0].accountId, campaignId: 'historic', adsetId: 'set', adId: 'ad', spend: '12.00', impressions: '50', dailyReach: '30', engagements: '2', videoViews: '1', clicks: '1', results: '0', rawData: {} });
    await unlinkMetaAccount(actor, links[0].id); const [historyCount] = await db.select({ value: count() }).from(schema.metaDailyInsights).where(eq(schema.metaDailyInsights.accountId, links[0].accountId)); expect(historyCount.value).toBe(1);
    const [paused] = await db.select().from(schema.adAccounts).where(eq(schema.adAccounts.id, links[0].accountId)); expect(paused.status).toBe('paused');

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: [{ date_start: '2026-08-20', date_stop: '2026-08-20', account_id: '222', campaign_id: 'cmp', adset_id: 'set', ad_id: 'ad', spend: '20.50', impressions: '100', reach: '80', clicks: '4', actions: [{ action_type: 'post_engagement', value: '8' }] }] })));
    await syncAllAccounts({ start: '2026-08-20', end: '2026-08-20' }); await syncAllAccounts({ start: '2026-08-20', end: '2026-08-20' });
    const [insightCount] = await db.select({ value: count() }).from(schema.metaDailyInsights); expect(insightCount.value).toBe(2);
    const [activeAccount] = await db.select().from(schema.adAccounts).where(eq(schema.adAccounts.id, links[1].accountId)); expect(activeAccount.lastSuccessfulSyncAt).toBeTruthy();

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { message: 'access_token=EAAshould-not-leak', code: 100 } }, { status: 400 })));
    const failure = await syncAllAccounts({ start: '2026-08-20', end: '2026-08-20' }); expect(failure[0].status).toBe('failed');
    const [afterFailure] = await db.select({ value: count() }).from(schema.metaDailyInsights); expect(afterFailure.value).toBe(2);
    const failedRuns = await db.select().from(schema.syncRuns).where(eq(schema.syncRuns.status, 'failed')); expect(failedRuns[0].errorMessage).not.toContain('EAAshould');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: true }))); await disconnectMeta(actor);
    const [disconnected] = await db.select().from(schema.metaConnections); expect(disconnected.encryptedAccessToken).toBeNull(); expect(disconnected.status).toBe('disconnected');
    const [remainingLink] = await db.select().from(schema.metaAccountLinks); expect(remainingLink.syncEnabled).toBe(false);
  }, 60_000);

  it('classifica permissão insuficiente, token expirado e falha de troca', async () => {
    vi.stubGlobal('fetch', oauthMock(['ads_read'])); let url = new URL(await beginMetaAuthorization(actor));
    await expect(completeMetaAuthorization(url.searchParams.get('state')!, 'code')).resolves.toMatchObject({ status: 'insufficient_permissions' });
    let [connection] = await drizzle({ client, schema }).select().from(schema.metaConnections); expect(connection.status).toBe('insufficient_permissions');

    await drizzle({ client, schema }).update(schema.metaConnections).set({ tokenExpiresAt: new Date(Date.now() - 1_000), status: 'connected' }).where(eq(schema.metaConnections.id, connection.id));
    await expect(testMetaConnection(actor)).rejects.toThrow(/expirou/i); [connection] = await drizzle({ client, schema }).select().from(schema.metaConnections); expect(connection.status).toBe('authorization_expired');

    url = new URL(await beginMetaAuthorization(actor)); vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { message: 'Falha controlada', code: 100 } }, { status: 400 })));
    await expect(completeMetaAuthorization(url.searchParams.get('state')!, 'bad')).rejects.toThrow('Falha controlada'); [connection] = await drizzle({ client, schema }).select().from(schema.metaConnections); expect(connection.status).toBe('connection_error');
  }, 60_000);
});
