import 'server-only';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import type { Role } from './permissions';

export type SessionActor = { id: string; role: Role; name?: string | null; email?: string | null };

export async function getSessionActor(): Promise<SessionActor | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) return null;
  return { id: session.user.id, role: session.user.role, name: session.user.name, email: session.user.email };
}

export async function requireAdminActor(): Promise<SessionActor> {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') throw new Error('FORBIDDEN');
  return actor;
}
