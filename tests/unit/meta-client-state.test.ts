import { describe, expect, it } from 'vitest';
import { canStartMetaAuthorization, metaDisplayStatus } from '../../lib/meta-client-state';

describe('estado da interface de integração Meta', () => {
  it('mantém conexão bloqueada enquanto a configuração estiver incompleta', () => {
    expect(canStartMetaAuthorization(false, '')).toBe(false);
    expect(metaDisplayStatus(false, null)).toBe('not_configured');
  });

  it('habilita conexão e informa que aguarda autorização quando a configuração estiver completa', () => {
    expect(canStartMetaAuthorization(true, '')).toBe(true);
    expect(canStartMetaAuthorization(true, 'oauth-start')).toBe(false);
    expect(metaDisplayStatus(true, null)).toBe('ready_to_connect');
  });

  it('preserva estados reais retornados pelo backend', () => {
    expect(metaDisplayStatus(true, 'connected')).toBe('connected');
    expect(metaDisplayStatus(true, 'authorization_expired')).toBe('authorization_expired');
    expect(metaDisplayStatus(true, 'insufficient_permissions')).toBe('insufficient_permissions');
    expect(metaDisplayStatus(true, 'connection_error')).toBe('connection_error');
  });
});
