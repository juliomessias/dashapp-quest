export type MetaDisplayStatus = 'not_configured' | 'ready_to_connect' | string;

export function metaDisplayStatus(configured: boolean, connectionStatus?: string | null): MetaDisplayStatus {
  if (!configured) return 'not_configured';
  return connectionStatus ?? 'ready_to_connect';
}

export function canStartMetaAuthorization(configured: boolean, busy: string) {
  return configured && !busy;
}
