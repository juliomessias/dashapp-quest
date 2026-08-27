import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { count } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../../db/schema';
import { seedDemoDatabase } from '../../lib/demo-seed';

async function migrate(db: PGlite) {
  for (const tag of ['0000_initial', '0001_freezing_exiles', '0002_left_frog_thor', '0003_woozy_starhawk']) {
    const sql = await readFile(resolve(process.cwd(), `db/migrations/${tag}.sql`), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint').map((part) => part.trim()).filter(Boolean)) await db.exec(statement);
  }
}

describe('migrações e restrições PostgreSQL', () => {
  it('migra do esquema inicial sem reset e garante unicidade/validação', async () => {
    const db = await PGlite.create();
    try {
      await migrate(db);
      await db.exec(`
        insert into users (id,name,email,password_hash,role) values ('00000000-0000-4000-8000-000000000001','Admin','admin@test.local','hash','admin');
        insert into brands (id,name,code) values ('00000000-0000-4000-8000-000000000101','Marca','MAR');
        insert into analysts (id,name,email) values ('00000000-0000-4000-8000-000000000201','Analista','analista@test.local');
        insert into ad_accounts (id,meta_account_id,name,brand_id,market,analyst_id) values ('00000000-0000-4000-8000-000000000301','act_test','Conta','00000000-0000-4000-8000-000000000101','Brasil','00000000-0000-4000-8000-000000000201');
        insert into metric_goals (year,month,account_id,metric_key,value,source,changed_by_user_id) values (2026,null,'00000000-0000-4000-8000-000000000301','reach',100,'manual','00000000-0000-4000-8000-000000000001');
      `);
      await expect(db.exec(`insert into metric_goals (year,month,account_id,metric_key,value,source) values (2026,null,'00000000-0000-4000-8000-000000000301','reach',200,'manual')`)).rejects.toThrow();
      await expect(db.exec(`insert into monthly_budgets (year,month,account_id,budget,source) values (2026,8,'00000000-0000-4000-8000-000000000301',-1,'manual')`)).rejects.toThrow();
      const columns = await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name='metric_goals' and column_name in ('note','changed_by_user_id') order by column_name`);
      expect(columns.rows.map((row) => row.column_name)).toEqual(['changed_by_user_id', 'note']);
      const orm = drizzle({ client: db, schema });
      await seedDemoDatabase(orm as never);
      const [accounts] = await orm.select({ value: count() }).from(schema.adAccounts);
      const [insights] = await orm.select({ value: count() }).from(schema.metaDailyInsights);
      expect(accounts.value).toBe(8);
      expect(insights.value).toBeGreaterThan(4_000);
    } finally { await db.close(); }
  }, 60_000);
});
