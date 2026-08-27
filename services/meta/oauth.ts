import 'server-only';
import { requiredMetaPermissions, requireMetaConfig } from '../../lib/meta-config';

type Fetcher = typeof fetch;
type TokenResponse = { access_token?: string; token_type?: string; expires_in?: number; error?: { message?: string; code?: number } };

function tokenError(body: TokenResponse, fallback: string) {
  const suffix = body.error?.code ? ` (código ${body.error.code})` : '';
  return new Error(`${body.error?.message ?? fallback}${suffix}`);
}

async function requestToken(url: URL, fetcher: Fetcher) {
  const response = await fetcher(url, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' });
  const body = await response.json() as TokenResponse;
  if (!response.ok || !body.access_token) throw tokenError(body, 'Não foi possível obter a autorização da Meta.');
  return body;
}

export function createMetaAuthorizationUrl(state: string, env: NodeJS.ProcessEnv = process.env) {
  const config = requireMetaConfig(env); const url = new URL(`https://www.facebook.com/${config.graphApiVersion}/dialog/oauth`);
  url.searchParams.set('client_id', config.appId); url.searchParams.set('redirect_uri', config.redirectUri); url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code'); url.searchParams.set('scope', requiredMetaPermissions.join(','));
  return url.toString();
}

export async function exchangeMetaAuthorizationCode(code: string, fetcher: Fetcher = fetch, env: NodeJS.ProcessEnv = process.env) {
  const config = requireMetaConfig(env);
  const shortUrl = new URL(`https://graph.facebook.com/${config.graphApiVersion}/oauth/access_token`);
  shortUrl.searchParams.set('client_id', config.appId); shortUrl.searchParams.set('client_secret', config.appSecret); shortUrl.searchParams.set('redirect_uri', config.redirectUri); shortUrl.searchParams.set('code', code);
  const short = await requestToken(shortUrl, fetcher);
  const longUrl = new URL(`https://graph.facebook.com/${config.graphApiVersion}/oauth/access_token`);
  longUrl.searchParams.set('grant_type', 'fb_exchange_token'); longUrl.searchParams.set('client_id', config.appId); longUrl.searchParams.set('client_secret', config.appSecret); longUrl.searchParams.set('fb_exchange_token', short.access_token!);
  try {
    const long = await requestToken(longUrl, fetcher);
    return { accessToken: long.access_token!, expiresIn: long.expires_in ?? short.expires_in ?? null };
  } catch {
    return { accessToken: short.access_token!, expiresIn: short.expires_in ?? null };
  }
}
