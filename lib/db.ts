import 'server-only';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzleNode, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import * as schema from '../db/schema';
import { seedDemoDatabase } from './demo-seed';
import { isDemoMode, isLocalDatabaseMode } from './meta-config';

export type AppDb = NodePgDatabase<typeof schema>;

declare global {
  var __metaBiDbPromise: Promise<AppDb> | undefined;
  var __metaBiPool: Pool | undefined;
}

async function applyEmbeddedMigrations(client: PGlite) {
  await client.exec('CREATE TABLE IF NOT EXISTS "__app_migrations" ("tag" text PRIMARY KEY, "applied_at" timestamptz NOT NULL DEFAULT now())');
  const applied = await client.query<{ tag: string }>('SELECT tag FROM "__app_migrations"');
  const tags = new Set(applied.rows.map((row) => row.tag));
  const migrationPaths = {
    '0000_initial': join(process.cwd(), 'db', 'migrations', '0000_initial.sql'),
    '0001_freezing_exiles': join(process.cwd(), 'db', 'migrations', '0001_freezing_exiles.sql'),
    '0002_left_frog_thor': join(process.cwd(), 'db', 'migrations', '0002_left_frog_thor.sql'),
    '0003_woozy_starhawk': join(process.cwd(), 'db', 'migrations', '0003_woozy_starhawk.sql'),
  } as const;
  for (const tag of Object.keys(migrationPaths) as Array<keyof typeof migrationPaths>) {
    if (tags.has(tag)) continue;
    const content = await readFile(migrationPaths[tag], 'utf8');
    const statements = content.split('--> statement-breakpoint').map((statement) => statement.trim()).filter(Boolean);
    await client.exec('BEGIN');
    try {
      for (const statement of statements) await client.exec(statement);
      await client.query('INSERT INTO "__app_migrations" (tag) VALUES ($1)', [tag]);
      await client.exec('COMMIT');
    } catch (error) {
      await client.exec('ROLLBACK');
      throw error;
    }
  }
}

async function createEmbeddedDb(dataDir: string, seedDemo: boolean): Promise<AppDb> {
  await mkdir(dirname(dataDir), { recursive: true });
  const client = await PGlite.create(dataDir);
  await applyEmbeddedMigrations(client);
  const db = drizzlePglite({ client, schema }) as unknown as AppDb;
  if (seedDemo) await seedDemoDatabase(db);
  return db;
}

function createDemoDb() {
  return createEmbeddedDb(process.env.DEMO_DATABASE_DIR ?? '.data/demo-postgres', true);
}

function createLocalDb() {
  return createEmbeddedDb(process.env.LOCAL_DATABASE_DIR ?? '.data/local-postgres', false);
}

async function createRealDb(): Promise<AppDb> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  globalThis.__metaBiPool ??= new Pool({
    connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
  });
  return drizzleNode(globalThis.__metaBiPool, { schema });
}

export function getDb(): Promise<AppDb> {
  globalThis.__metaBiDbPromise ??= isDemoMode() ? createDemoDb() : isLocalDatabaseMode() ? createLocalDb() : createRealDb();
  return globalThis.__metaBiDbPromise;
}
