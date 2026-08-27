import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';
import { adAccounts, analysts, auditLogs, brands, metaAccountLinks, metaAvailableAccounts, metaConnections, metaOauthStates, syncRuns } from '../../db/schema';
import { getDb } from '../../lib/db';
import { metaConfigurationStatus, requiredMetaPermissions, requireMetaConfig } from '../../lib/meta-config';
import type { SessionActor } from '../../lib/server-auth';
import { decryptMetaToken, encryptMetaToken } from '../../lib/token-crypto';
import { MetaClient, MetaApiError } from './client';
import { createMetaAuthorizationUrl, exchangeMetaAuthorizationCode } from './oauth';

type MetaBusiness = { id: string; name: string };
type MetaAdAccount = { id: string; account_id?: string; name: string; account_status?: number; currency?: string; timezone_name?: string; business?: MetaBusiness };
type MetaPermission = { permission: string; status: string };

function stateHash(state: string) { return createHash('sha256').update(state).digest('hex'); }
export function sanitizeMetaError(error: unknown) {
  let sanitized = error instanceof Error ? error.message : 'Falha desconhecida na integração Meta.';
  sanitized = sanitized.replace(/(access_token|client_secret|fb_exchange_token)(["']?\s*[:=]\s*["']?)([^&\s"',}]+)/gi, '$1$2[REDACTED]').replace(/EAA[A-Za-z0-9_-]{8,}/g, '[REDACTED]');
  for (const secret of [process.env.META_APP_SECRET, process.env.META_TOKEN_ENCRYPTION_KEY]) {
    const value = secret?.trim();
    if (value && value.length >= 8) sanitized = sanitized.split(value).join('[REDACTED]');
  }
  return sanitized.slice(0, 1000);
}
function externalStatus(value?: number) { return value === 1 ? 'active' : value === 2 ? 'disabled' : value === 3 ? 'unsettled' : value === 7 ? 'pending_review' : value === 9 ? 'in_grace_period' : value === 101 ? 'closed' : 'unknown'; }
function expiryDate(seconds: number | null) { return seconds ? new Date(Date.now() + seconds * 1000) : null; }

async function inspectAccess(client: MetaClient) {
  const [profile, permissions] = await Promise.all([
    client.get<{ id: string; name: string }>('me', { fields: 'id,name' }),
    client.get<{ data: MetaPermission[] }>('me/permissions'),
  ]);
  const granted = permissions.data.filter((item) => item.status === 'granted').map((item) => item.permission);
  const missingPermissions = requiredMetaPermissions.filter((permission) => !granted.includes(permission));
  return { profile, granted, missingPermissions };
}

async function discoverAssets(client: MetaClient) {
  const businesses: MetaBusiness[] = []; const accounts = new Map<string, MetaAdAccount>();
  for await (const business of client.paginate<MetaBusiness>('me/businesses', { fields: 'id,name', limit: 100 })) businesses.push(business);
  for await (const account of client.paginate<MetaAdAccount>('me/adaccounts', { fields: 'id,account_id,name,account_status,currency,timezone_name,business{id,name}', limit: 100 })) accounts.set(account.account_id ?? account.id.replace(/^act_/, ''), account);
  for (const business of businesses) {
    for (const edge of ['owned_ad_accounts', 'client_ad_accounts']) {
      for await (const account of client.paginate<MetaAdAccount>(`${business.id}/${edge}`, { fields: 'id,account_id,name,account_status,currency,timezone_name,business{id,name}', limit: 100 })) {
        accounts.set(account.account_id ?? account.id.replace(/^act_/, ''), { ...account, business: account.business ?? business });
      }
    }
  }
  return { businesses, accounts: Array.from(accounts.values()) };
}

async function persistDiscoveredAssets(connectionId: string, client: MetaClient) {
  const db = await getDb(); const assets = await discoverAssets(client);
  await db.update(metaAvailableAccounts).set({ externalStatus: 'unavailable', updatedAt: new Date() }).where(eq(metaAvailableAccounts.connectionId, connectionId));
  for (const item of assets.accounts) {
    const metaAccountId = item.account_id ?? item.id.replace(/^act_/, '');
    await db.insert(metaAvailableAccounts).values({ connectionId, metaAccountId, name: item.name, businessId: item.business?.id, businessName: item.business?.name, externalStatus: externalStatus(item.account_status), currency: item.currency, timezone: item.timezone_name, rawData: { id: item.id, accountStatus: item.account_status }, updatedAt: new Date() })
      .onConflictDoUpdate({ target: [metaAvailableAccounts.connectionId, metaAvailableAccounts.metaAccountId], set: { name: item.name, businessId: item.business?.id, businessName: item.business?.name, externalStatus: externalStatus(item.account_status), currency: item.currency, timezone: item.timezone_name, rawData: { id: item.id, accountStatus: item.account_status }, updatedAt: new Date() } });
  }
  const businessName = assets.businesses.length === 1 ? assets.businesses[0].name : assets.businesses.length > 1 ? `${assets.businesses.length} empresas acessíveis` : null;
  const businessId = assets.businesses.length === 1 ? assets.businesses[0].id : null;
  await db.update(metaConnections).set({ businessId, businessName, updatedAt: new Date() }).where(eq(metaConnections.id, connectionId));
  return assets;
}

export async function beginMetaAuthorization(actor: SessionActor) {
  requireMetaConfig(); const db = await getDb();
  const [connection] = await db.insert(metaConnections).values({ createdByUserId: actor.id, status: 'awaiting_authorization', updatedAt: new Date() })
    .onConflictDoUpdate({ target: metaConnections.createdByUserId, set: { status: 'awaiting_authorization', updatedAt: new Date() } }).returning();
  await db.delete(metaOauthStates).where(eq(metaOauthStates.connectionId, connection.id));
  const state = randomBytes(32).toString('base64url');
  await db.insert(metaOauthStates).values({ connectionId: connection.id, stateHash: stateHash(state), expiresAt: new Date(Date.now() + 10 * 60_000) });
  await db.insert(auditLogs).values({ userId: actor.id, action: 'meta.oauth.start', entity: 'meta_connection', afterValues: { connectionId: connection.id } });
  return createMetaAuthorizationUrl(state);
}

export async function completeMetaAuthorization(state: string, code: string) {
  const db = await getDb(); const [oauthState] = await db.select().from(metaOauthStates).where(and(eq(metaOauthStates.stateHash, stateHash(state)), isNull(metaOauthStates.consumedAt), gt(metaOauthStates.expiresAt, new Date()))).limit(1);
  if (!oauthState) throw new Error('STATE_INVALID');
  await db.update(metaOauthStates).set({ consumedAt: new Date() }).where(eq(metaOauthStates.id, oauthState.id));
  try {
    const config = requireMetaConfig(); const token = await exchangeMetaAuthorizationCode(code); const encrypted = encryptMetaToken(token.accessToken, config.tokenEncryptionKey); const client = new MetaClient(token.accessToken, config.graphApiVersion);
    const access = await inspectAccess(client); const status = access.missingPermissions.length ? 'insufficient_permissions' : 'connected';
    await db.update(metaConnections).set({ encryptedAccessToken: encrypted, tokenExpiresAt: expiryDate(token.expiresIn), grantedPermissions: access.granted, status, lastCheckedAt: new Date(), updatedAt: new Date() }).where(eq(metaConnections.id, oauthState.connectionId));
    if (!access.missingPermissions.length) await persistDiscoveredAssets(oauthState.connectionId, client);
    await db.insert(auditLogs).values({ action: 'meta.oauth.complete', entity: 'meta_connection', afterValues: { connectionId: oauthState.connectionId, status, permissions: access.granted } });
    return { connectionId: oauthState.connectionId, status };
  } catch (error) {
    await db.update(metaConnections).set({ status: 'connection_error', lastCheckedAt: new Date(), updatedAt: new Date(), lastSyncResult: { error: sanitizeMetaError(error) } }).where(eq(metaConnections.id, oauthState.connectionId));
    throw error;
  }
}

async function activeConnection() {
  const db = await getDb(); const [connection] = await db.select().from(metaConnections).orderBy(desc(metaConnections.updatedAt)).limit(1);
  return connection ?? null;
}

async function connectionClient() {
  const config = requireMetaConfig();
  const connection = await activeConnection();
  if (!connection?.encryptedAccessToken) throw new Error('Nenhuma autorização Meta ativa.');
  if (connection.tokenExpiresAt && connection.tokenExpiresAt <= new Date()) {
    const db = await getDb(); await db.update(metaConnections).set({ status: 'authorization_expired', updatedAt: new Date() }).where(eq(metaConnections.id, connection.id));
    throw new Error('A autorização Meta expirou. Reconecte a conta.');
  }
  return { connection, client: new MetaClient(decryptMetaToken(connection.encryptedAccessToken, config.tokenEncryptionKey), config.graphApiVersion) };
}

export async function testMetaConnection(actor: SessionActor) {
  const db = await getDb(); const { connection, client } = await connectionClient();
  try {
    const access = await inspectAccess(client); const status = access.missingPermissions.length ? 'insufficient_permissions' : 'connected';
    await db.update(metaConnections).set({ status, grantedPermissions: access.granted, lastCheckedAt: new Date(), updatedAt: new Date(), lastSyncResult: access.missingPermissions.length ? { missingPermissions: access.missingPermissions } : null }).where(eq(metaConnections.id, connection.id));
    await db.insert(auditLogs).values({ userId: actor.id, action: 'meta.connection.test', entity: 'meta_connection', afterValues: { connectionId: connection.id, status } });
    return { status, missingPermissions: access.missingPermissions };
  } catch (error) {
    const status = error instanceof MetaApiError && [190, 102].includes(error.code ?? 0) ? 'authorization_expired' : 'connection_error';
    await db.update(metaConnections).set({ status, lastCheckedAt: new Date(), updatedAt: new Date(), lastSyncResult: { error: sanitizeMetaError(error) } }).where(eq(metaConnections.id, connection.id));
    throw error;
  }
}

export async function refreshMetaAccounts(actor: SessionActor) {
  const db = await getDb(); const { connection, client } = await connectionClient(); const assets = await persistDiscoveredAssets(connection.id, client);
  await db.update(metaConnections).set({ status: 'connected', lastCheckedAt: new Date(), updatedAt: new Date() }).where(eq(metaConnections.id, connection.id));
  await db.insert(auditLogs).values({ userId: actor.id, action: 'meta.accounts.refresh', entity: 'meta_connection', afterValues: { connectionId: connection.id, accounts: assets.accounts.length } });
  return { count: assets.accounts.length };
}

export async function disconnectMeta(actor: SessionActor) {
  const db = await getDb(); const connection = await activeConnection(); if (!connection) return;
  let revoked = false;
  if (connection.encryptedAccessToken) {
    try { const config = requireMetaConfig(); const client = new MetaClient(decryptMetaToken(connection.encryptedAccessToken, config.tokenEncryptionKey), config.graphApiVersion); await client.delete('me/permissions'); revoked = true; } catch { revoked = false; }
  }
  await db.transaction(async (tx) => {
    await tx.update(metaConnections).set({ encryptedAccessToken: null, tokenExpiresAt: null, status: 'disconnected', updatedAt: new Date() }).where(eq(metaConnections.id, connection.id));
    await tx.update(metaAccountLinks).set({ syncEnabled: false, updatedAt: new Date() }).where(eq(metaAccountLinks.connectionId, connection.id));
    await tx.insert(auditLogs).values({ userId: actor.id, action: 'meta.connection.disconnect', entity: 'meta_connection', beforeValues: { connectionId: connection.id, status: connection.status }, afterValues: { status: 'disconnected', authorizationRevokedAtMeta: revoked } });
  });
}

export type MetaLinkInput = { availableAccountId: string; brandId: string; market: string; analystId?: string | null; historyStartDate: string; syncEnabled?: boolean };
export async function linkMetaAccounts(actor: SessionActor, inputs: MetaLinkInput[]) {
  const db = await getDb(); const saved: string[] = [];
  await db.transaction(async (tx) => {
    for (const input of inputs) {
      const [available] = await tx.select().from(metaAvailableAccounts).where(eq(metaAvailableAccounts.id, input.availableAccountId)).limit(1); if (!available) throw new Error('Conta Meta disponível não encontrada.');
      const [existing] = await tx.select().from(metaAccountLinks).where(eq(metaAccountLinks.metaAccountId, available.metaAccountId)).limit(1);
      if (existing && existing.availableAccountId !== available.id) throw new Error('Esta conta Meta já está vinculada por outra conexão.');
      const [account] = await tx.insert(adAccounts).values({ metaAccountId: available.metaAccountId, name: available.name, brandId: input.brandId, market: input.market, analystId: input.analystId ?? null, currency: available.currency ?? 'BRL', timezone: available.timezone ?? 'America/Sao_Paulo', status: 'active' })
        .onConflictDoUpdate({ target: adAccounts.metaAccountId, set: { name: available.name, brandId: input.brandId, market: input.market, analystId: input.analystId ?? null, currency: available.currency ?? 'BRL', timezone: available.timezone ?? 'America/Sao_Paulo', status: 'active' } }).returning();
      const [link] = await tx.insert(metaAccountLinks).values({ connectionId: available.connectionId, availableAccountId: available.id, metaAccountId: available.metaAccountId, accountId: account.id, brandId: input.brandId, market: input.market, analystId: input.analystId ?? null, historyStartDate: new Date(`${input.historyStartDate}T00:00:00`), syncEnabled: input.syncEnabled ?? true, updatedAt: new Date() })
        .onConflictDoUpdate({ target: metaAccountLinks.metaAccountId, set: { brandId: input.brandId, market: input.market, analystId: input.analystId ?? null, historyStartDate: new Date(`${input.historyStartDate}T00:00:00`), syncEnabled: input.syncEnabled ?? true, updatedAt: new Date() } }).returning();
      saved.push(link.id);
    }
    await tx.insert(auditLogs).values({ userId: actor.id, action: 'meta.accounts.link', entity: 'meta_account_link', afterValues: { linkIds: saved, count: saved.length } });
  });
  return saved;
}

export async function unlinkMetaAccount(actor: SessionActor, linkId: string) {
  const db = await getDb(); await db.transaction(async (tx) => {
    const [link] = await tx.select().from(metaAccountLinks).where(eq(metaAccountLinks.id, linkId)).limit(1); if (!link) throw new Error('Vinculação não encontrada.');
    await tx.delete(metaAccountLinks).where(eq(metaAccountLinks.id, linkId)); await tx.update(adAccounts).set({ status: 'paused' }).where(eq(adAccounts.id, link.accountId));
    await tx.insert(auditLogs).values({ userId: actor.id, action: 'meta.accounts.unlink', entity: 'meta_account_link', beforeValues: { ...link, historyPreserved: true } });
  });
}

export async function updateMetaLink(actor: SessionActor, linkId: string, changes: Partial<Pick<MetaLinkInput, 'brandId' | 'market' | 'analystId' | 'historyStartDate' | 'syncEnabled'>>) {
  const db = await getDb(); const [link] = await db.select().from(metaAccountLinks).where(eq(metaAccountLinks.id, linkId)).limit(1); if (!link) throw new Error('Vinculação não encontrada.');
  const values = { brandId: changes.brandId ?? link.brandId, market: changes.market ?? link.market, analystId: changes.analystId === undefined ? link.analystId : changes.analystId, historyStartDate: changes.historyStartDate ? new Date(`${changes.historyStartDate}T00:00:00`) : link.historyStartDate, syncEnabled: changes.syncEnabled ?? link.syncEnabled, updatedAt: new Date() };
  await db.transaction(async (tx) => { await tx.update(metaAccountLinks).set(values).where(eq(metaAccountLinks.id, linkId)); await tx.update(adAccounts).set({ brandId: values.brandId, market: values.market, analystId: values.analystId, status: values.syncEnabled ? 'active' : 'paused' }).where(eq(adAccounts.id, link.accountId)); await tx.insert(auditLogs).values({ userId: actor.id, action: 'meta.accounts.update', entity: 'meta_account_link', beforeValues: link, afterValues: values }); });
}

export async function testMetaAccount(actor: SessionActor, linkId: string) {
  const db = await getDb(); const [link] = await db.select().from(metaAccountLinks).where(eq(metaAccountLinks.id, linkId)).limit(1); if (!link) throw new Error('Vinculação não encontrada.');
  const { client } = await connectionClient(); await client.get(`act_${link.metaAccountId}`, { fields: 'id,name,account_status' });
  await db.update(metaAccountLinks).set({ accessStatus: 'available', lastAccessTestAt: new Date(), updatedAt: new Date() }).where(eq(metaAccountLinks.id, linkId));
  await db.insert(auditLogs).values({ userId: actor.id, action: 'meta.account.test', entity: 'meta_account_link', afterValues: { linkId, status: 'available' } });
}

export async function getMetaIntegrationState() {
  const db = await getDb(); const configuration = metaConfigurationStatus(); const connection = await activeConnection();
  const connectionStatus = connection?.encryptedAccessToken && connection.tokenExpiresAt && connection.tokenExpiresAt <= new Date() ? 'authorization_expired' : connection?.status;
  const [availableCount] = connection ? await db.select({ value: count() }).from(metaAvailableAccounts).where(eq(metaAvailableAccounts.connectionId, connection.id)) : [{ value: 0 }];
  const [linkedCount] = connection ? await db.select({ value: count() }).from(metaAccountLinks).where(eq(metaAccountLinks.connectionId, connection.id)) : [{ value: 0 }];
  const accounts = connection ? await db.select({ id: metaAvailableAccounts.id, metaAccountId: metaAvailableAccounts.metaAccountId, name: metaAvailableAccounts.name, businessId: metaAvailableAccounts.businessId, businessName: metaAvailableAccounts.businessName, externalStatus: metaAvailableAccounts.externalStatus, currency: metaAvailableAccounts.currency, timezone: metaAvailableAccounts.timezone, linkId: metaAccountLinks.id, accountId: metaAccountLinks.accountId, brandId: metaAccountLinks.brandId, brand: brands.name, market: metaAccountLinks.market, analystId: metaAccountLinks.analystId, analyst: analysts.name, syncEnabled: metaAccountLinks.syncEnabled, historyStartDate: metaAccountLinks.historyStartDate, accessStatus: metaAccountLinks.accessStatus, lastAccessTestAt: metaAccountLinks.lastAccessTestAt, lastSuccessfulSyncAt: adAccounts.lastSuccessfulSyncAt })
    .from(metaAvailableAccounts).leftJoin(metaAccountLinks, eq(metaAvailableAccounts.id, metaAccountLinks.availableAccountId)).leftJoin(adAccounts, eq(metaAccountLinks.accountId, adAccounts.id)).leftJoin(brands, eq(metaAccountLinks.brandId, brands.id)).leftJoin(analysts, eq(metaAccountLinks.analystId, analysts.id)).where(eq(metaAvailableAccounts.connectionId, connection.id)).orderBy(metaAvailableAccounts.name) : [];
  const [lastRun] = connection ? await db.select().from(syncRuns).where(eq(syncRuns.connectionId, connection.id)).orderBy(desc(syncRuns.startedAt)).limit(1) : [];
  return { configuration, connection: connection ? { id: connection.id, businessId: connection.businessId, businessName: connection.businessName, status: connectionStatus!, tokenExpiresAt: connection.tokenExpiresAt, grantedPermissions: connection.grantedPermissions, lastCheckedAt: connection.lastCheckedAt, lastSyncAt: connection.lastSyncAt, lastSyncResult: connection.lastSyncResult } : null, counts: { available: Number(availableCount.value), linked: Number(linkedCount.value) }, accounts, lastRun: lastRun ? { id: lastRun.id, status: lastRun.status, startedAt: lastRun.startedAt, finishedAt: lastRun.finishedAt, recordCount: lastRun.recordCount, errorMessage: lastRun.errorMessage } : null };
}

export async function getDashboardIntegrationState() {
  const state = await getMetaIntegrationState(); const linked = state.counts.linked;
  const hasSync = state.accounts.some((account) => Boolean(account.lastSuccessfulSyncAt));
  return { configured: state.configuration.configured, connectionStatus: state.connection?.status ?? 'not_connected', businessName: state.connection?.businessName ?? null, linkedAccounts: linked, hasSuccessfulSync: hasSync, lastSyncAt: state.connection?.lastSyncAt?.toISOString?.() ?? null, lastSyncResult: state.connection?.lastSyncResult ?? null };
}
