import { getServerSession } from 'next-auth';
import { and, eq } from 'drizzle-orm';
import { adAccounts, auditLogs, metricGoals, monthlyBudgets } from '@/db/schema';
import { authOptions } from '@/lib/auth';
import { parseImportCsv, type ImportRow } from '@/lib/csv';
import { getDb } from '@/lib/db';

const importedGoals: Array<[keyof ImportRow, string]> = [
  ['meta_alcance', 'reach'],
  ['meta_impressoes', 'impressions'],
  ['meta_engajamento', 'engagement'],
  ['meta_video', 'video_views'],
  ['meta_curtidores', 'likes_growth'],
  ['meta_seguidores', 'followers_growth'],
];

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const demoMode = process.env.DEMO_MODE === 'true';
  if (session?.user.role !== 'admin') {
    return Response.json({ error: 'Apenas administradores podem importar.' }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'Arquivo CSV obrigatório.' }, { status: 400 });
  if (file.size > 2_000_000) return Response.json({ error: 'Arquivo maior que 2 MB.' }, { status: 413 });

  try {
    const rows = parseImportCsv(await file.text());
    const db = await getDb();
    await db.transaction(async (tx) => {
      for (const [index, row] of rows.entries()) {
        const [account] = await tx.select({ id: adAccounts.id, brandId: adAccounts.brandId })
          .from(adAccounts)
          .where(eq(adAccounts.metaAccountId, row.meta_account_id))
          .limit(1);

        if (!account) throw new Error(`Linha ${index + 2}: conta Meta ${row.meta_account_id} não cadastrada.`);

        await tx.insert(monthlyBudgets).values({
          year: row.ano,
          month: row.mes,
          accountId: account.id,
          budget: row.orcamento_mensal.toString(),
          source: `csv:${file.name}`,
          changedByUserId: session.user.id,
        }).onConflictDoUpdate({
          target: [monthlyBudgets.year, monthlyBudgets.month, monthlyBudgets.accountId],
          set: { budget: row.orcamento_mensal.toString(), source: `csv:${file.name}`, changedByUserId: session.user.id, changedAt: new Date() },
        });

        for (const [column, metricKey] of importedGoals) {
          const value = Number(row[column]);
          await tx.insert(metricGoals).values({
            year: row.ano,
            month: row.mes,
            accountId: account.id,
            brandId: null,
            metricKey,
            value: value.toString(),
            source: `csv:${file.name}`,
            changedByUserId: session.user.id,
          }).onConflictDoNothing();
          await tx.update(metricGoals).set({ value: value.toString(), source: `csv:${file.name}`, changedByUserId: session.user.id, changedAt: new Date() })
            .where(and(eq(metricGoals.year, row.ano), eq(metricGoals.month, row.mes), eq(metricGoals.accountId, account.id), eq(metricGoals.metricKey, metricKey)));
        }
      }

      await tx.insert(auditLogs).values({
        userId: session?.user.id,
        action: 'csv.import',
        entity: 'monthly_goals_and_budgets',
        afterValues: { fileName: file.name, importedRows: rows.length },
      });
    });

    return Response.json({ imported: rows.length, mode: demoMode ? 'demo' : 'real', message: 'Metas e orçamentos importados e persistidos com sucesso.' });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'CSV inválido.' }, { status: 400 });
  }
}
