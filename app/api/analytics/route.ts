import { getAnalytics } from '@/services/analytics';
import { getSessionActor } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const actor = await getSessionActor();
  if (!actor) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
  try {
    const data = await getAnalytics(new URL(request.url).searchParams, actor);
    return Response.json(data, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('[analytics] Falha ao consultar dados:', error instanceof Error ? error.message : error);
    const message = error instanceof Error ? error.message : 'Não foi possível carregar os dados.';
    return Response.json({ error: message }, { status: message.includes('data final') || message.includes('datas inicial') ? 400 : 500 });
  }
}
