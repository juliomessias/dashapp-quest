import { getDb } from '../lib/db';
import { seedDemoDatabase } from '../lib/demo-seed';
import { isDemoMode } from '../lib/meta-config';

async function seed() {
  if (!isDemoMode()) throw new Error('O seed fictício só pode ser executado com DEMO_MODE=true fora de produção.');
  const db = await getDb();
  await seedDemoDatabase(db);
  console.info('Seed de desenvolvimento concluído.');
}

seed().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
