import { completeMetaAuthorization, sanitizeMetaError } from '@/services/meta/integration';
import { metaIntegrationAdminUrl } from '../../../../lib/meta-config';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url); const state = url.searchParams.get('state'); const code = url.searchParams.get('code'); const denied = url.searchParams.get('error');
  let destination: URL;
  try { destination = metaIntegrationAdminUrl(); }
  catch (error) {
    console.error('[meta-oauth] Callback indisponível:', sanitizeMetaError(error));
    return Response.json({ error: 'A callback OAuth da Meta não está configurada com uma URL pública HTTPS válida.' }, { status: 503 });
  }
  if (denied) { destination.searchParams.set('meta', 'denied'); return Response.redirect(destination); }
  if (!state || !code) { destination.searchParams.set('meta', 'invalid_callback'); return Response.redirect(destination); }
  try {
    const result = await completeMetaAuthorization(state, code); destination.searchParams.set('meta', result.status === 'connected' ? 'connected' : result.status); return Response.redirect(destination);
  } catch (error) {
    const message = error instanceof Error && error.message === 'STATE_INVALID' ? 'invalid_state' : 'connection_error';
    console.error('[meta-oauth] Callback não concluído:', sanitizeMetaError(error)); destination.searchParams.set('meta', message); return Response.redirect(destination);
  }
}
