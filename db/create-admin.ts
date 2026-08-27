import { argon2id, hash } from 'argon2';
import { z } from 'zod';
import { users } from './schema';
import { getDb } from '../lib/db';
import { isDemoMode } from '../lib/meta-config';

const input = z.object({ name: z.string().trim().min(2).max(160), email: z.string().email().transform((value) => value.toLowerCase()), password: z.string().min(12).max(200) }).parse({ name: process.env.INITIAL_ADMIN_NAME, email: process.env.INITIAL_ADMIN_EMAIL, password: process.env.INITIAL_ADMIN_PASSWORD });

async function createAdmin() {
  if (isDemoMode()) throw new Error('Desative DEMO_MODE para criar o administrador real.');
  const db = await getDb(); const passwordHash = await hash(input.password, { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  await db.insert(users).values({ name: input.name, email: input.email, passwordHash, role: 'admin', active: true }).onConflictDoUpdate({ target: users.email, set: { name: input.name, passwordHash, role: 'admin', active: true } });
  console.info(`Administrador criado ou atualizado: ${input.email}`);
}

createAdmin().catch((error) => { console.error(error instanceof Error ? error.message : 'Falha ao criar administrador.'); process.exitCode = 1; });
