import { z } from 'zod';
import { requireAdminActor } from '@/lib/server-auth';
import { beginMetaAuthorization, disconnectMeta, getMetaIntegrationState, linkMetaAccounts, refreshMetaAccounts, sanitizeMetaError, testMetaAccount, testMetaConnection, unlinkMetaAccount, updateMetaLink } from '@/services/meta/integration';
import { syncAllAccounts } from '@/services/meta/sync';

export const dynamic = 'force-dynamic';

const linkSchema = z.object({ availableAccountId: z.string().uuid(), brandId: z.string().uuid(), market: z.string().trim().min(2).max(100), analystId: z.string().uuid().nullable().optional(), historyStartDate: z.iso.date(), syncEnabled: z.boolean().optional() });
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('oauth-start') }), z.object({ action: z.literal('test-connection') }), z.object({ action: z.literal('refresh-accounts') }), z.object({ action: z.literal('disconnect') }),
  z.object({ action: z.literal('link'), links: z.array(linkSchema).min(1).max(100), initialSync: z.boolean().default(true) }),
  z.object({ action: z.literal('unlink'), linkId: z.string().uuid() }),
  z.object({ action: z.literal('update-link'), linkId: z.string().uuid(), changes: linkSchema.omit({ availableAccountId: true }).partial() }),
  z.object({ action: z.literal('test-account'), linkId: z.string().uuid() }),
  z.object({ action: z.literal('sync-data'), start: z.iso.date().optional(), end: z.iso.date().optional(), linkIds: z.array(z.string().uuid()).optional() }),
]);

async function actorOrResponse() { try { return await requireAdminActor(); } catch { return Response.json({ error: 'Apenas administradores podem gerenciar a integração Meta.' }, { status: 403 }); } }
function dateDaysAgo(days: number) { return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10); }

export async function GET() {
  const actor = await actorOrResponse(); if (actor instanceof Response) return actor;
  return Response.json(await getMetaIntegrationState(), { headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: Request) {
  const actor = await actorOrResponse(); if (actor instanceof Response) return actor;
  try {
    const input = actionSchema.parse(await request.json());
    if (input.action === 'oauth-start') return Response.json({ authorizationUrl: await beginMetaAuthorization(actor) });
    if (input.action === 'test-connection') return Response.json(await testMetaConnection(actor));
    if (input.action === 'refresh-accounts') return Response.json(await refreshMetaAccounts(actor));
    if (input.action === 'disconnect') { await disconnectMeta(actor); return Response.json({ ok: true }); }
    if (input.action === 'unlink') { await unlinkMetaAccount(actor, input.linkId); return Response.json({ ok: true, historyPreserved: true }); }
    if (input.action === 'update-link') { await updateMetaLink(actor, input.linkId, input.changes); return Response.json({ ok: true }); }
    if (input.action === 'test-account') { await testMetaAccount(actor, input.linkId); return Response.json({ ok: true }); }
    if (input.action === 'link') {
      const linkIds = await linkMetaAccounts(actor, input.links); let sync = null;
      if (input.initialSync) { const start = input.links.map((item) => item.historyStartDate).sort()[0]; sync = await syncAllAccounts({ start, end: new Date().toISOString().slice(0, 10) }, linkIds); }
      return Response.json({ ok: true, linkIds, sync });
    }
    const end = input.end ?? new Date().toISOString().slice(0, 10); const start = input.start ?? dateDaysAgo(6);
    if (start > end) return Response.json({ error: 'O início não pode ser posterior ao fim.' }, { status: 400 });
    const result = await syncAllAccounts({ start, end }, input.linkIds);
    return Response.json({ status: result.some((item) => item.status === 'failed') ? 'partial' : 'success', result });
  } catch (error) {
    const message = sanitizeMetaError(error);
    return Response.json({ error: message }, { status: message.includes('já está vinculada') ? 409 : 400 });
  }
}
