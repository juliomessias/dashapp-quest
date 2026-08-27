import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const completeMetaAuthorization = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/services/meta/integration', () => ({
  completeMetaAuthorization,
  sanitizeMetaError: (error: unknown) => error instanceof Error ? error.message.replace(/EAA[A-Za-z0-9_-]+/g, '[REDACTED]') : 'erro',
}));

import { GET } from '../../app/api/meta/callback/route';

function callback(query = '') { return GET(new Request(`http://127.0.0.1:3000/api/meta/callback${query}`)); }
function destination(response: Response) { return new URL(response.headers.get('location')!); }

beforeEach(() => {
  completeMetaAuthorization.mockReset();
  vi.stubEnv('META_APP_ID', '123456');
  vi.stubEnv('META_APP_SECRET', 'server-secret-value');
  vi.stubEnv('META_REDIRECT_URI', 'https://bi.example.com/api/meta/callback');
  vi.stubEnv('META_GRAPH_API_VERSION', 'v25.0');
  vi.stubEnv('META_TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 8).toString('base64'));
});

afterEach(() => { vi.unstubAllEnvs(); });

describe('callback OAuth Meta', () => {
  it('recusa callback sem state ou sem código', async () => {
    expect(destination(await callback('?state=abc')).searchParams.get('meta')).toBe('invalid_callback');
    expect(destination(await callback('?code=abc')).searchParams.get('meta')).toBe('invalid_callback');
    expect(completeMetaAuthorization).not.toHaveBeenCalled();
  });

  it('diferencia autorização negada e state inválido', async () => {
    expect(destination(await callback('?error=access_denied')).searchParams.get('meta')).toBe('denied');
    completeMetaAuthorization.mockRejectedValueOnce(new Error('STATE_INVALID'));
    expect(destination(await callback('?state=invalid&code=code')).searchParams.get('meta')).toBe('invalid_state');
  });

  it('redireciona com o estado validado pelo backend', async () => {
    completeMetaAuthorization.mockResolvedValueOnce({ status: 'connected' });
    const redirect = destination(await callback('?state=valid&code=code'));
    expect(redirect.searchParams.get('meta')).toBe('connected');
    expect(redirect.origin).toBe('https://bi.example.com');
    expect(completeMetaAuthorization).toHaveBeenCalledWith('valid', 'code');
  });

  it('ignora o protocolo HTTP interno do proxy ao formar o retorno', async () => {
    completeMetaAuthorization.mockResolvedValueOnce({ status: 'connected' });
    const response = await GET(new Request('http://app-interna:3000/api/meta/callback?state=valid&code=code', { headers: { host: 'app-interna:3000', 'x-forwarded-proto': 'http' } }));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://bi.example.com/admin/integracoes/meta?meta=connected');
  });

  it('não redireciona para HTTP quando a configuração segura está ausente', async () => {
    vi.stubEnv('META_REDIRECT_URI', 'http://127.0.0.1:3000/api/meta/callback');
    const response = await callback('?state=valid&code=code');
    expect(response.status).toBe(503);
    expect(response.headers.get('location')).toBeNull();
    expect(completeMetaAuthorization).not.toHaveBeenCalled();
  });

  it('não registra token quando a troca falha', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    completeMetaAuthorization.mockRejectedValueOnce(new Error('access_token=EAAverysecrettoken'));
    expect(destination(await callback('?state=valid&code=invalid')).searchParams.get('meta')).toBe('connection_error');
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('EAAverysecrettoken');
    expect(JSON.stringify(consoleError.mock.calls)).toContain('[REDACTED]');
    consoleError.mockRestore();
  });
});
