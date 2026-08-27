import { expect, test, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('admin@demo.local');
  await page.getByLabel('Senha').fill('Demo@2026');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Visão consolidada' })).toBeVisible({ timeout: 60_000 });
}

test('login exige sessão e abre o consolidado sem aparência demonstrativa', async ({ page }) => {
  await page.goto('/'); await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Acesse o dashboard' })).toBeVisible();
  await expect(page.getByText(/Demonstração|Dados fictícios|Ambiente demo/i)).toHaveCount(0);
  await page.getByLabel('E-mail').fill('admin@demo.local'); await page.getByLabel('Senha').fill('Demo@2026');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Visão consolidada' })).toBeVisible({ timeout: 60_000 });
});

test.describe('fluxos autenticados', () => {
  test.beforeEach(async ({ page }) => login(page));

  test('filtros atualizam resultados e persistem na navegação/URL', async ({ page }) => {
    await expect(page.getByLabel('Marca')).toBeEnabled({ timeout: 60_000 });
    await page.getByLabel('Marca').selectOption({ label: 'Conti Cola' });
    await expect(page).toHaveURL(/marca=00000000-0000-4000-8000-000000000102/);
    await expect(page.getByText('#BR · CDC · Conti Cola')).toBeVisible();
    await page.getByRole('link', { name: 'Controle de saldos' }).click();
    await expect(page).toHaveURL(/marca=00000000-0000-4000-8000-000000000102/);
    await page.reload(); await expect(page.getByLabel('Marca')).toHaveValue('00000000-0000-4000-8000-000000000102');
  });

  test('dia, mês, YTD, personalizado e limpeza usam o mesmo intervalo da API', async ({ page }) => {
    await expect(page.getByLabel('Período')).toBeEnabled({ timeout: 60_000 });
    const investment = page.locator('article').filter({ hasText: 'Investimento' }).first(); const ytdValue = await investment.locator('p').nth(1).textContent();
    await page.getByLabel('Período').selectOption('mes'); await expect(page).toHaveURL(/periodo=mes/); await expect(investment.locator('p').nth(1)).not.toHaveText(ytdValue ?? '');
    await page.getByLabel('Período').selectOption('dia'); await expect(page).toHaveURL(/periodo=dia/);
    await page.getByLabel('Período').selectOption('ytd'); await page.getByLabel('Data final').fill('2026-12-15');
    const ytd = await page.evaluate(() => fetch('/api/analytics?' + location.search.slice(1)).then((response) => response.json())); expect(ytd.range.end).toBe('2026-10-31');
    await page.getByLabel('Período').selectOption('personalizado'); await page.getByLabel('Data inicial').fill('2026-07-01'); await page.getByLabel('Data final personalizada').fill('2026-07-31');
    const custom = await page.evaluate(() => fetch('/api/analytics?' + location.search.slice(1)).then((response) => response.json())); expect(custom.range).toEqual({ start: '2026-07-01', end: '2026-07-31' });
    await page.getByRole('button', { name: 'Limpar filtros' }).click(); await expect(page).not.toHaveURL(/periodo=/); await expect(page.getByLabel('Período')).toHaveValue('ytd');
  });

  test('marca, conta e analista ficam encadeados', async ({ page }) => {
    await expect(page.getByLabel('Marca')).toBeEnabled({ timeout: 60_000 }); await page.getByLabel('Marca').selectOption({ label: 'Casa Di Conti' });
    await expect(page.getByLabel('Conta').locator('option')).toHaveCount(4); await page.getByLabel('Analista').selectOption({ label: 'Luigi Ferreira' });
    await page.getByLabel('Marca').selectOption({ label: 'Burguesa' }); await expect(page).not.toHaveURL(/analista=/);
    await page.getByLabel('Conta').selectOption({ label: '#BR · CDC · Burguesa' }); await expect(page).toHaveURL(/accountId=00000000-0000-4000-8000-000000000304/);
  });

  test('seletor pesquisável troca a conta e mantém os filtros', async ({ page }) => {
    await page.getByRole('link', { name: 'Visão por conta' }).click();
    await expect(page.getByText('Evolução de performance')).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: /Conta visualizada/ }).click();
    await page.getByPlaceholder('Pesquisar conta ou marca').fill('Moinho');
    await page.getByRole('option', { name: /Moinho Real/ }).click();
    await expect(page).toHaveURL(/accountId=00000000-0000-4000-8000-000000000306/);
    await expect(page.getByRole('heading', { name: '#BR · CDC · Moinho Real' })).toBeVisible();
    await page.reload(); await expect(page.getByRole('heading', { name: '#BR · CDC · Moinho Real' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByLabel('Conta', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Conta visualizada/ })).toHaveCount(1);
    await expect(page.getByLabel('Marca')).toBeVisible(); await expect(page.getByLabel('Mercado')).toBeVisible(); await expect(page.getByLabel('Analista')).toBeVisible();
  });

  test('admin abre Integrações Meta sem expor segredos', async ({ page }) => {
    await page.getByRole('link', { name: 'Integrações' }).click(); await expect(page.getByRole('heading', { name: 'Meta Ads' })).toBeVisible();
    await expect(page.getByText('Meta não configurada')).toBeVisible(); await expect(page.getByRole('button', { name: 'Conectar com Meta' })).toBeDisabled(); const content = await page.locator('body').innerText(); expect(content).not.toContain('server-secret'); expect(content).not.toContain('EAA');
  });

  test('visão por conta abre diretamente e trata accountId inválido', async ({ page }) => {
    await page.goto('/contas/visao'); await expect(page).toHaveURL(/accountId=00000000-0000-4000-8000-/); await expect(page.getByText('Evolução de performance')).toBeVisible({ timeout: 60_000 });
    await page.goto('/contas/invalida?accountId=00000000-0000-4000-8000-999999999999'); await expect(page.getByText('Conta inválida ou não autorizada')).toBeVisible({ timeout: 60_000 });
  });

  test('exportação cria CSV filtrado', async ({ page }) => {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exportar CSV' }).click();
    expect((await download).suggestedFilename()).toBe('performance-meta-ads.csv');
  });

  test('admin persiste orçamento manual e registra histórico', async ({ page }) => {
    await page.getByRole('link', { name: 'Administração' }).click(); await page.getByRole('tab', { name: 'Orçamentos' }).click();
    await page.getByLabel('Conta').selectOption({ label: '#AR · CDC · Casa Di Conti' });
    await page.getByLabel('Mês').selectOption('9'); await page.getByLabel('Orçamento').fill('R$ 12.345,67');
    page.once('dialog', (prompt) => prompt.accept());
    await page.getByRole('button', { name: 'Salvar orçamento' }).click();
    await expect(page.getByRole('status')).toContainText(/salvo|substituído/);
    await page.getByRole('tab', { name: 'Logs e histórico' }).click(); await expect(page.getByText(/Orçamento (criado|atualizado)/).first()).toBeVisible();
  });

  test('admin cria, bloqueia duplicidade, edita e exclui metas anual e mensal', async ({ page }) => {
    const year=String(2080+Math.floor(Date.now()/1000)%20);
    await page.getByRole('link', { name: 'Administração' }).click(); await page.getByRole('tab', { name: 'Metas' }).click();
    await page.getByLabel('Ano').fill(year); await page.getByLabel('Conta').selectOption({ label: '#AR · CDC · Casa Di Conti' }); await page.getByLabel('Valor').fill('123456'); await page.getByLabel('Observação').fill('Teste E2E anual'); await page.getByRole('button', { name: 'Salvar meta' }).click();
    await expect(page.getByRole('status')).toContainText('salva'); await page.reload(); await page.getByRole('tab', { name: 'Metas' }).click(); const annualRow=page.getByRole('row').filter({hasText:year}).filter({hasText:'#AR · CDC · Casa Di Conti'}); await expect(annualRow).toBeVisible({ timeout: 60_000 });
    await page.getByLabel('Ano').fill(year); await page.getByLabel('Conta').selectOption({ label: '#AR · CDC · Casa Di Conti' }); await page.getByLabel('Valor').fill('999'); page.once('dialog', (dialog) => dialog.dismiss()); await page.getByRole('button', { name: 'Salvar meta' }).click(); await expect(page.getByRole('alert')).toContainText('Já existe');
    await annualRow.getByRole('button', { name: 'Editar meta' }).click(); await page.getByLabel('Valor').fill('654321'); await page.getByRole('button', { name: 'Salvar meta' }).click(); await expect(page.getByRole('status')).toContainText('salva');
    await page.getByLabel('Ano').fill(year); await page.getByLabel('Conta').selectOption({ label: '#BO · CDC · Casa Di Conti' }); await page.getByLabel('Tipo').selectOption('monthly'); await page.getByLabel('Mês').selectOption('10'); await page.getByLabel('Valor').fill('777'); await page.getByLabel('Observação').fill('Teste E2E mensal'); await page.getByRole('button', { name: 'Salvar meta' }).click(); await expect(page.getByRole('status')).toContainText('salva');
    const monthlyRow=page.getByRole('row').filter({hasText:year}).filter({hasText:'#BO · CDC · Casa Di Conti'}).filter({hasText:'Out'});page.once('dialog', (dialog) => dialog.accept()); await monthlyRow.getByRole('button', { name: 'Excluir meta' }).click(); await expect(monthlyRow).not.toBeVisible();
    page.once('dialog',(dialog)=>dialog.accept());await page.getByRole('row').filter({hasText:year}).filter({hasText:'#AR · CDC · Casa Di Conti'}).getByRole('button',{name:'Excluir meta'}).click();
  });

  test('admin cria, edita, persiste e exclui orçamento em formato brasileiro', async ({ page }) => {
    await page.getByRole('link', { name: 'Administração' }).click(); await page.getByRole('tab', { name: 'Orçamentos' }).click(); await page.getByLabel('Conta').selectOption({ label: '#UY · CDC · Zero Grau' }); await expect(page.getByLabel('Marca vinculada')).toHaveValue('Zero Grau');
    await page.getByLabel('Ano').fill('2099'); await page.getByLabel('Mês').selectOption('12'); await page.getByLabel('Orçamento').fill('R$ 15.000,50'); await page.getByLabel('Saldo pré-pago').fill('15000,50'); await page.getByLabel('Observação').fill('Teste E2E orçamento'); await page.getByRole('button', { name: 'Salvar orçamento' }).click(); await expect(page.getByRole('status')).toContainText('salvo');
    await page.reload(); await page.getByRole('tab', { name: 'Orçamentos' }).click(); const row = page.getByRole('row').filter({ hasText: 'Teste E2E orçamento' }); await expect(row).toContainText('R$ 15.000,50'); await row.getByRole('button', { name: 'Editar orçamento' }).click(); await page.getByLabel('Orçamento').fill('16000'); await page.getByRole('button', { name: 'Salvar orçamento' }).click(); await expect(page.getByRole('status')).toContainText('salvo');
    page.once('dialog', (dialog) => dialog.accept()); await page.getByRole('row').filter({ hasText: 'Teste E2E orçamento' }).getByRole('button', { name: 'Excluir orçamento' }).click(); await expect(page.getByText('Teste E2E orçamento')).not.toBeVisible();
  });

  test('usuário não administrador é bloqueado na rota e na API administrativa', async ({ page }) => {
    const email=`viewer-${Date.now()}@demo.local`;await page.getByRole('link', { name: 'Administração' }).click(); await page.getByRole('button', { name: 'Usuários' }).click(); await page.getByLabel('Nome').fill('Viewer E2E'); await page.getByLabel('E-mail').fill(email); await page.getByLabel('Senha').fill('Viewer@2026'); await page.getByRole('button', { name: 'Criar cadastro' }).click();
    await page.getByRole('button', { name: 'Sair' }).click(); await page.getByLabel('E-mail').fill(email); await page.getByLabel('Senha').fill('Viewer@2026'); await page.getByRole('button', { name: 'Entrar' }).click(); await expect(page.getByRole('heading', { name: 'Visão consolidada' })).toBeVisible({ timeout: 60_000 });
    await page.goto('/admin'); await expect(page).toHaveURL(/erro=acesso-negado/); const statuses = await page.evaluate(() => Promise.all([fetch('/api/admin/goals').then((response) => response.status), fetch('/api/admin/meta').then((response) => response.status)])); expect(statuses).toEqual([403, 403]);
  });

  test('importação administrativa grava a planilha', async ({ page }) => {
    await page.getByRole('link', { name: 'Administração' }).click(); await page.getByRole('tab', { name: 'Importação' }).click();
    await page.locator('input[type=file]').setInputFiles('public/examples/metas-orcamentos-exemplo.csv');
    await expect(page.getByText('1 linhas válidas')).toBeVisible(); await page.getByRole('button', { name: 'Validar e importar' }).click();
    await expect(page.getByRole('status')).toContainText('gravadas no banco');
  });
});
