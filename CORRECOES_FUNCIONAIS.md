# Correções funcionais — Dashboard de Performance Meta Ads

Data da validação: 25/08/2026.

## Causas raiz

1. Os filtros apenas alteravam a URL. As três páginas analíticas continuavam renderizando constantes de `lib/demo-data.ts`, sem consulta compartilhada ao banco.
2. A navegação reconstruía os links sem a query string, descartando período e escopo. Marca, conta e analista também não eram encadeados.
3. A Visão por conta dependia do segmento da rota e fazia fallback silencioso. Não havia seletor local nem validação de autorização do `accountId`.
4. A Administração era uma demonstração visual: botões e tabelas não estavam ligados a CRUD persistente. O CSV era a única entrada e, em demo, não gravava.
5. O índice de metas usava colunas anuláveis diretamente, permitindo duplicar metas anuais no PostgreSQL. Faltavam observação e autoria em metas/orçamentos, e situação em analistas.
6. A rota administrativa não possuía bloqueio server-side na própria página, embora parte da API já verificasse sessão.

## Funcionalidades corrigidas

- Consulta analítica única, alimentada pelo banco, para Consolidado, Visão por conta e Controle de saldos.
- Ano, dia, mês, 12 meses móveis, YTD limitado a 31 de outubro e período personalizado centralizados em `lib/filters.ts` e `lib/formulas.ts`.
- Conta, marca, mercado e analista persistidos na URL e preservados na navegação.
- Filtros dependentes, loading, vazio, erro, cancelamento de requisições antigas e remoção imediata de resultados obsoletos.
- Valores ausentes exibidos como “N/A”, “Sem dados” ou “Meta não cadastrada”, sem conversão silenciosa para zero.
- Seletor pesquisável na Visão por conta, com contas ativas/autorizadas, `accountId`, preservação de filtros e estado explícito para conta inválida.
- CRUD persistente de contas, marcas, analistas e usuários.
- CRUD manual de metas anuais/mensais e grade rápida, com janeiro–outubro, precedência mensal, confirmação de duplicidade e autoria.
- CRUD manual de orçamentos, com marca automática e moeda brasileira normalizada.
- CSV mantido como opção e agora persistente também no PostgreSQL embarcado do modo demo.
- Auditoria administrativa, invalidação dos dados analíticos e recarga do registro após salvamento.
- Administração e mutações protegidas no servidor; sincronização manual restrita a admin ou segredo de cron.
- Modo demo persistente com PGlite/PostgreSQL embarcado e migrations automáticas, sem misturar dados reais.

## Banco e migration

Migration incremental: `db/migrations/0001_freezing_exiles.sql`.

Ela preserva os registros existentes e:

- adiciona `analysts.active`;
- adiciona `note` e `changed_by_user_id` a metas e orçamentos;
- adiciona FKs de autoria com `ON DELETE SET NULL`;
- corrige a unicidade de metas com `COALESCE` para escopos/meses anuláveis;
- adiciona checks de escopo exclusivo, meses permitidos e valores não negativos.

## Arquivos modificados ou criados

- Configuração: `.gitignore`, `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `proxy.ts`.
- Banco: `db/schema/index.ts`, `db/migrations/0001_freezing_exiles.sql`, `db/seed.ts`.
- Servidor: `lib/db.ts`, `lib/auth.ts`, `lib/server-auth.ts`, `lib/admin-validation.ts`, `lib/admin-types.ts`, `lib/analytics-types.ts`, `lib/demo-fixtures.ts`, `lib/demo-seed.ts`, `lib/filters.ts`, `services/analytics.ts`, `services/meta/sync.ts`.
- APIs: `app/api/analytics/route.ts`, `app/api/admin/[resource]/route.ts`, `app/api/import/route.ts`, `app/api/sync/meta/route.ts`.
- Interface: `app/layout.tsx`, `app/admin/page.tsx`, `components/app-shell.tsx`, `components/auth-provider.tsx`, `components/global-filters.tsx`, `components/dashboard-view.tsx`, `components/account-view.tsx`, `components/account-selector.tsx`, `components/balances-view.tsx`, `components/metric-card.tsx`, `components/admin-view.tsx`, `components/admin-catalog.tsx`, `components/admin-goals.tsx`, `components/admin-budgets.tsx`, `components/admin-import.tsx`, `components/admin-logs.tsx`.
- Estado cliente: `lib/use-analytics-data.ts`, `lib/use-admin-resource.ts`.
- Testes: `tests/unit/admin-validation.test.ts`, `tests/unit/database-integration.test.ts`, `tests/unit/business-rules.test.ts`, `tests/e2e/main-flows.spec.ts`, `playwright.config.ts`.
- Documentação: `README.md`, `PLANS.md`, este relatório.

## Evidências e resultados

- `pnpm lint`: aprovado.
- `pnpm typecheck`: aprovado.
- `pnpm test`: 4 arquivos, 22/22 testes aprovados.
- Integração: migrations `0000` + `0001` executadas em PostgreSQL/PGlite, constraints de duplicidade/valores verificadas e seed confirmado com 8 contas e mais de 4.000 insights.
- `pnpm build`: aprovado; 9 páginas geradas e rotas dinâmicas administrativas/analíticas compiladas.
- O build emite um aviso não bloqueante de rastreamento NFT porque o modo demo lê os arquivos SQL no runtime; os arquivos são incluídos explicitamente em `outputFileTracingIncludes`.
- A suíte E2E foi ampliada para filtros, URLs, conta direta/inválida, CRUD, reload, autorização, CSV e exportação.

## Limitação da validação nesta sessão

A preferência salva do navegador bloqueou acesso a `127.0.0.1`, e a política do ambiente também recusou a abertura posterior da porta local. Por isso, a suíte Playwright e a inspeção visual/rede pós-correção não foram executadas nesta sessão. Não foi tentado nenhum desvio por outro navegador ou cliente HTTP. Os cenários estão prontos em `tests/e2e/main-flows.spec.ts` para execução local.

## Aplicar e executar

```bash
pnpm install
cp .env.example .env.local
```

Modo demonstração persistente:

```bash
# DEMO_MODE=true em .env.local
pnpm dev
```

O modo demo aplica as migrations e cria `.data/demo-postgres` automaticamente. Login: `admin@demo.local` / `Demo@2026`.

PostgreSQL externo:

```bash
# Configure DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL e DEMO_MODE=false
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Validação completa em uma máquina com navegador local liberado:

```bash
pnpm check
pnpm test:e2e
```

Nenhum reset destrutivo é necessário. Faça backup do banco de produção antes de qualquer migration, como prática operacional padrão.
