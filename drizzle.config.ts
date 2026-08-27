import { defineConfig } from 'drizzle-kit';
export default defineConfig({ schema: './db/schema/index.ts', out: './db/migrations', dialect: 'postgresql', dbCredentials: { url: process.env.DATABASE_URL ?? 'postgresql://meta_bi:meta_bi@localhost:5432/meta_bi' }, strict: true });
