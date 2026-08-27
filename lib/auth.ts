import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';
import { verify } from 'argon2';
import { z } from 'zod';
import { users } from '@/db/schema';
import { getDb } from './db';
import { demoAdminId } from './demo-fixtures';
import { isDemoMode } from './meta-config';

const credentialSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(200) });
const attempts = new Map<string, { count: number; resetAt: number }>();
function allowAttempt(key: string) { const now = Date.now(); const current = attempts.get(key); if (!current || current.resetAt < now) { attempts.set(key, { count: 1, resetAt: now + 15 * 60_000 }); return true; } if (current.count >= 5) return false; current.count += 1; return true; }

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60, updateAge: 60 * 60 },
  pages: { signIn: '/login' },
  providers: [CredentialsProvider({ name: 'Credenciais locais', credentials: { email: { label: 'E-mail', type: 'email' }, password: { label: 'Senha', type: 'password' } }, async authorize(credentials) {
    const parsed = credentialSchema.safeParse(credentials); if (!parsed.success) return null; const email = parsed.data.email.toLowerCase(); if (!allowAttempt(email)) throw new Error('Muitas tentativas. Aguarde 15 minutos.');
    if (isDemoMode() && email === 'admin@demo.local' && parsed.data.password === 'Demo@2026') { attempts.delete(email); return { id: demoAdminId, name: 'Marina Costa', email, role: 'admin' }; }
    const db = await getDb(); const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1); if (!user?.active || !(await verify(user.passwordHash, parsed.data.password))) return null; attempts.delete(email); return { id: user.id, name: user.name, email: user.email, role: user.role };
  } })],
  callbacks: {
    jwt({ token, user }) { if (user) { token.id = user.id; token.role = user.role; } return token; },
    session({ session, token }) { if (session.user) { session.user.id = String(token.id); session.user.role = token.role as 'admin' | 'analyst' | 'viewer'; } return session; },
  },
};
