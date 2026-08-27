export type Role = 'admin' | 'analyst' | 'viewer';
export type Action = 'read' | 'manage' | 'sync' | 'import';
export function can(role: Role, action: Action) { if (role === 'admin') return true; if (role === 'analyst') return action === 'read'; return action === 'read'; }
export function canAccessAccount(role: Role, assignedAccountIds: string[], accountId: string) { return role === 'admin' || role === 'viewer' || assignedAccountIds.includes(accountId); }
