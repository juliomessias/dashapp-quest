import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDemoMode, isLocalDatabaseMode, metaCallbackPath, metaConfigurationStatus, metaIntegrationAdminUrl, requiredMetaPermissions, requireMetaConfig } from '../../lib/meta-config';
import { decryptMetaToken, encryptMetaToken } from '../../lib/token-crypto';
import { MetaClient } from '../../services/meta/client';
import { createMetaAuthorizationUrl, exchangeMetaAuthorizationCode } from '../../services/meta/oauth';
import { sanitizeMetaError } from '../../services/meta/integration';

vi.mock('server-only', () => ({}));

const env = { NODE_ENV: 'test', META_APP_ID: '123', META_APP_SECRET: 'server-secret', META_REDIRECT_URI: 'https://bi.example.com/api/meta/callback', META_GRAPH_API_VERSION: 'v25.0', META_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), CRON_SECRET: 'cron-secret', DATABASE_URL: 'postgresql://example' } as NodeJS.ProcessEnv;

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('configuração e proteção da integração Meta', () => {
  it('informa variáveis ausentes sem revelar valores', () => {
    const status = metaConfigurationStatus({ NODE_ENV: 'test', META_APP_ID: '123' } as NodeJS.ProcessEnv);
    expect(status.configured).toBe(false); expect(status.missing).toContain('META_APP_SECRET'); expect(JSON.stringify(status)).not.toContain('123');
  });

  it.each(['META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI', 'META_TOKEN_ENCRYPTION_KEY'] as const)('bloqueia quando %s está ausente', (key) => {
    const candidate = { ...env, [key]: '' } as NodeJS.ProcessEnv;
    const status = metaConfigurationStatus(candidate);
    expect(status.configured).toBe(false); expect(status.missing).toContain(key);
  });

  it('considera valores vazios ou com espaços como ausentes', () => {
    const status = metaConfigurationStatus({ ...env, META_APP_ID: '   ', META_APP_SECRET: '\t' } as NodeJS.ProcessEnv);
    expect(status.configured).toBe(false); expect(status.missing).toEqual(expect.arrayContaining(['META_APP_ID', 'META_APP_SECRET']));
  });

  it('normaliza credenciais no servidor, mas não tolera espaços na URL', () => {
    const padded = { ...env, META_APP_ID: '  123  ', META_APP_SECRET: '  server-secret  ' } as NodeJS.ProcessEnv;
    expect(metaConfigurationStatus(padded)).toMatchObject({ configured: true, missing: [], invalid: [] });
    expect(requireMetaConfig(padded)).toEqual({ appId: '123', appSecret: 'server-secret', redirectUri: 'https://bi.example.com/api/meta/callback', graphApiVersion: 'v25.0', tokenEncryptionKey: env.META_TOKEN_ENCRYPTION_KEY });
    const unsafe = metaConfigurationStatus({ ...env, META_REDIRECT_URI: ' https://bi.example.com/api/meta/callback ' } as NodeJS.ProcessEnv);
    expect(unsafe.configured).toBe(false); expect(unsafe.issues).toContainEqual(expect.objectContaining({ code: 'whitespace_not_allowed' }));
  });

  it('rejeita callback incompatível, versão inválida e chave com tamanho incorreto', () => {
    expect(metaConfigurationStatus({ ...env, META_REDIRECT_URI: 'https://bi.example.com/api/integrations/meta/callback' } as NodeJS.ProcessEnv).invalid).toContain('META_REDIRECT_URI');
    expect(metaConfigurationStatus({ ...env, META_REDIRECT_URI: 'ftp://bi.example.com/api/meta/callback' } as NodeJS.ProcessEnv).invalid).toContain('META_REDIRECT_URI');
    expect(metaConfigurationStatus({ ...env, META_GRAPH_API_VERSION: '25' } as NodeJS.ProcessEnv).invalid).toContain('META_GRAPH_API_VERSION');
    expect(metaConfigurationStatus({ ...env, META_TOKEN_ENCRYPTION_KEY: 'curta' } as NodeJS.ProcessEnv).invalid).toContain('META_TOKEN_ENCRYPTION_KEY');
  });

  it.each([
    ['HTTP', 'http://bi.example.com/api/meta/callback', 'must_use_https'],
    ['URL relativa', '/api/meta/callback', 'invalid_format'],
    ['localhost', 'https://localhost/api/meta/callback', 'invalid_public_host'],
    ['IPv4 de loopback', 'https://127.0.0.1/api/meta/callback', 'invalid_public_host'],
    ['IP privado', 'https://192.168.1.15/api/meta/callback', 'invalid_public_host'],
    ['credenciais embutidas', 'https://user:password@bi.example.com/api/meta/callback', 'credentials_not_allowed'],
    ['barra final', 'https://bi.example.com/api/meta/callback/', 'callback_path_mismatch'],
    ['query', 'https://bi.example.com/api/meta/callback?source=meta', 'query_or_fragment_not_allowed'],
  ])('rejeita callback insegura: %s', (_label, redirectUri, issueCode) => {
    const status = metaConfigurationStatus({ ...env, NODE_ENV: 'production', META_REDIRECT_URI: redirectUri } as NodeJS.ProcessEnv);
    expect(status.configured).toBe(false);
    expect(status.callback.secure).toBe(false);
    expect(status.issues).toContainEqual(expect.objectContaining({ variable: 'META_REDIRECT_URI', code: issueCode }));
  });

  it('aceita somente a callback HTTPS pública exata e não expõe valores no status', () => {
    const status = metaConfigurationStatus(env);
    expect(status).toMatchObject({ configured: true, callback: { secure: true, reason: null } });
    expect(JSON.stringify(status)).not.toContain(env.META_APP_SECRET!);
    expect(JSON.stringify(status)).not.toContain(env.META_TOKEN_ENCRYPTION_KEY!);
  });

  it('retorna a mensagem administrativa específica para callback HTTP', () => {
    expect(() => requireMetaConfig({ ...env, META_REDIRECT_URI: 'http://bi.example.com/api/meta/callback' } as NodeJS.ProcessEnv)).toThrow('Não foi possível iniciar a conexão com a Meta porque a URL de callback não utiliza HTTPS. Configure META_REDIRECT_URI com uma URL pública e segura.');
  });

  it('lê novamente o ambiente a cada validação, sem congelar valores do build', () => {
    const runtime = { ...env, META_APP_ID: '' } as NodeJS.ProcessEnv;
    expect(metaConfigurationStatus(runtime).configured).toBe(false); runtime.META_APP_ID = 'runtime-app-id'; expect(metaConfigurationStatus(runtime).configured).toBe(true);
  });

  it('bloqueia modo de demonstração em produção', () => {
    expect(() => isDemoMode({ NODE_ENV: 'production', DEMO_MODE: 'true' })).toThrow(/não pode ser habilitado/i);
    expect(isDemoMode({ NODE_ENV: 'development', DEMO_MODE: 'true' })).toBe(true);
  });

  it('aceita banco embutido somente fora de produção', () => {
    expect(() => isLocalDatabaseMode({ NODE_ENV: 'production', LOCAL_DATABASE_MODE: 'true' })).toThrow(/não pode ser habilitado/i);
    expect(isLocalDatabaseMode({ NODE_ENV: 'development', LOCAL_DATABASE_MODE: 'true' })).toBe(true);
    expect(isLocalDatabaseMode({ NODE_ENV: 'development', LOCAL_DATABASE_MODE: 'false' })).toBe(false);
  });

  it('criptografa tokens com autenticação e detecta chave incorreta', () => {
    const key = Buffer.alloc(32, 3).toString('base64'); const encrypted = encryptMetaToken('EAA-token-super-secreto', key);
    expect(encrypted).not.toContain('EAA-token'); expect(decryptMetaToken(encrypted, key)).toBe('EAA-token-super-secreto');
    expect(() => decryptMetaToken(encrypted, Buffer.alloc(32, 4).toString('base64'))).toThrow();
  });

  it('gera OAuth com state, callback e somente escopos documentados', () => {
    const proxyEnv = { ...env, HOST: 'internal:3000', ORIGIN: 'http://internal:3000', HTTP_X_FORWARDED_PROTO: 'http' } as NodeJS.ProcessEnv;
    const url = new URL(createMetaAuthorizationUrl('state-value', proxyEnv));
    expect(url.searchParams.get('state')).toBe('state-value'); expect(url.searchParams.get('redirect_uri')).toBe(env.META_REDIRECT_URI);
    expect(url.searchParams.get('scope')?.split(',').sort()).toEqual([...requiredMetaPermissions].sort());
    expect(url.pathname).toContain('/dialog/oauth'); expect(new URL(url.searchParams.get('redirect_uri')!).pathname).toBe(metaCallbackPath); expect(url.toString()).not.toContain(env.META_APP_SECRET!);
    expect(metaIntegrationAdminUrl(proxyEnv).toString()).toBe('https://bi.example.com/admin/integracoes/meta');
  });

  it('troca o código no backend e prefere o token de longa duração', async () => {
    const seen: URL[] = [];
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input)); seen.push(url); const long = url.searchParams.get('grant_type') === 'fb_exchange_token';
      return Response.json({ access_token: long ? 'EAA-long' : 'EAA-short', expires_in: long ? 5_184_000 : 3_600 });
    }) as typeof fetch;
    await expect(exchangeMetaAuthorizationCode('one-time-code', fetcher, env)).resolves.toEqual({ accessToken: 'EAA-long', expiresIn: 5_184_000 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(seen[0].searchParams.get('redirect_uri')).toBe(env.META_REDIRECT_URI);
    expect(seen[0].searchParams.get('client_secret')).toBe(env.META_APP_SECRET);
    expect(seen[1].searchParams.has('redirect_uri')).toBe(false);
  });

  it('falha na troca de código sem devolver segredo', async () => {
    const fetcher = vi.fn(async () => Response.json({ error: { message: 'Código inválido', code: 100 } }, { status: 400 })) as typeof fetch;
    await expect(exchangeMetaAuthorizationCode('bad-code', fetcher, env)).rejects.toThrow('Código inválido');
  });

  it('pagina com bearer token e remove tokens de URLs de paginação', async () => {
    const seen: Array<{ url: string; authorization: string | null }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input); seen.push({ url, authorization: new Headers(init?.headers).get('authorization') });
      return Response.json(url.includes('after=2') ? { data: [{ id: '2' }] } : { data: [{ id: '1' }], paging: { next: 'https://graph.facebook.com/v25.0/me/adaccounts?after=2&access_token=URL_TOKEN' } });
    }));
    const rows = []; for await (const row of new MetaClient('EAA-secret', 'v25.0').paginate<{ id: string }>('me/adaccounts')) rows.push(row.id);
    expect(rows).toEqual(['1', '2']); expect(seen.every((item) => item.authorization === 'Bearer EAA-secret')).toBe(true); expect(seen.some((item) => item.url.includes('URL_TOKEN'))).toBe(false);
  });

  it('sanitiza tokens de mensagens antes de logs ou respostas', () => {
    vi.stubEnv('META_APP_SECRET', 'app-secret-that-must-not-leak'); vi.stubEnv('META_TOKEN_ENCRYPTION_KEY', 'encryption-key-that-must-not-leak');
    const value = sanitizeMetaError(new Error('access_token=EAAabcdefghijklmnop&client_secret=abc123 app-secret-that-must-not-leak encryption-key-that-must-not-leak'));
    expect(value).not.toContain('EAA'); expect(value).not.toContain('abc123'); expect(value).not.toContain('must-not-leak'); expect(value).toContain('[REDACTED]');
  });
});
