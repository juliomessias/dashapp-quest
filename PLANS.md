# Plano de implementação

## Decisões

- Arquitetura monolítica com Next.js App Router, PostgreSQL e Drizzle ORM.
- Modo demonstração isolado e ativado por `DEMO_MODE=true`; nenhuma mistura com dados reais.
- Sessões via Auth.js/JWT e senhas locais Argon2id.
- Filtros globais persistidos na URL para tornar visões compartilháveis.
- Alcance agregado solicitado à Meta e armazenado em cache por intervalo.
- Entrega local: nenhum deploy será executado sem autorização explícita.

## Tarefas

- [x] Inspecionar anexos e inicializar o projeto.
- [x] Construir a primeira visão consolidada funcional.
- [x] Modelar banco, migrations, seed e autenticação.
- [x] Implementar Consolidado, Conta, Saldos e Administração.
- [x] Preparar sincronização Meta, cron e importação CSV.
- [x] Criar documentação e arquivos de container.
- [x] Executar lint, typecheck, testes, build e revisão visual.

## Verificação final

- `pnpm lint`: aprovado sem avisos.
- `pnpm typecheck`: aprovado.
- `pnpm test`: 17 testes aprovados.
- `pnpm test:e2e`: 11 testes aprovados; 1 caso mobile ignorado no projeto desktop por desenho.
- `pnpm build`: aprovado.
- Revisão visual: Consolidado, Conta, Saldos e Administração; desktop e 390×844.

## Correções funcionais — 25/08/2026

### Diagnóstico

- Os filtros alteravam somente a URL; Consolidado, Conta e Saldos continuavam consumindo constantes de `lib/demo-data.ts`.
- Os links de navegação descartavam os parâmetros ativos e as opções de conta, marca e analista não eram encadeadas.
- A Visão por conta aceitava apenas o segmento da rota e fazia fallback silencioso para a primeira conta.
- Administração renderizava tabelas e botões sem operações de backend; somente o CSV possuía endpoint, e o modo demo não persistia.
- Não há repositório Git neste diretório, portanto não foi possível criar o checkpoint solicitado.
- A abertura interativa local foi bloqueada pela preferência de acesso ao navegador; o servidor e os logs confirmaram as rotas, e a validação automatizada será mantida no plano.

### Plano

- [x] Centralizar normalização, validação e encadeamento dos filtros.
- [x] Fazer as visões analíticas recalcularem todas as seções com o mesmo escopo e período.
- [x] Preservar filtros na navegação e adicionar seletor pesquisável por `accountId`.
- [x] Criar CRUD server-side de cadastros, metas e orçamentos com Zod, autorização e auditoria.
- [x] Criar migration incremental para observações, autoria e unicidade correta de metas anuais.
- [x] Conectar alterações administrativas aos dashboards e adicionar estados de carregamento, vazio e erro.
- [x] Ampliar testes unitários, de integração e E2E; executar lint, typecheck, testes e build.

### Verificação desta correção

- `pnpm lint`: aprovado.
- `pnpm typecheck`: aprovado.
- `pnpm test`: 22/22 testes aprovados, incluindo integração PostgreSQL/PGlite com migrations e seed.
- `pnpm build`: aprovado no Next.js 16.
- E2E Playwright e inspeção visual interativa: cenários atualizados, mas a execução foi bloqueada pela preferência de acesso do navegador ao endereço local nesta sessão.

## Integração Meta Ads e preparação para produção — 26/08/2026

### Diagnóstico

- O cliente Meta consumia `META_ACCESS_TOKEN` diretamente do ambiente e não possuía OAuth, armazenamento criptografado, descoberta de contas ou vínculo persistente.
- A interface, o login e o iniciador local expunham credenciais e textos de demonstração; `DEMO_MODE` também vinha habilitado por padrão.
- A Visão por conta mantinha o seletor pesquisável correto no cabeçalho e repetia a seleção de conta dentro dos filtros globais.
- A base já possui contas, Insights com unicidade e logs de sincronização; essas estruturas serão preservadas e ampliadas por migration incremental.

### Plano

- [x] Adicionar configuração validada, OAuth com `state` descartável e criptografia autenticada de tokens no servidor.
- [x] Criar migration incremental para conexões, contas disponíveis, vínculos e contexto adicional de sincronização.
- [x] Implementar descoberta, vínculo/desvínculo, teste de acesso e sincronização real por conexão/conta.
- [x] Criar “Integrações > Meta Ads” com status, gerenciamento de contas e ações administrativas funcionais.
- [x] Remover o seletor duplicado apenas da Visão por conta e preservar `accountId` e filtros na URL.
- [x] Desativar demonstração por padrão, retirar credenciais/dados fictícios da produção e incluir estados reais de onboarding.
- [x] Ampliar testes com mocks e executar as verificações automatizadas; a validação interativa local permaneceu bloqueada pela preferência salva de acesso do navegador a `127.0.0.1`.

### Verificação desta etapa

- `pnpm lint`: aprovado.
- `pnpm typecheck`: aprovado.
- `pnpm test`: 33/33 testes aprovados em 7 arquivos; nenhuma chamada à API real da Meta.
- `pnpm build --webpack`: compilação, TypeScript e geração das 11 páginas aprovados em modo produção com `DEMO_MODE=false`.
- `pnpm db:seed` com `NODE_ENV=production` e `DEMO_MODE=true`: recusado pela proteção de produção.
- `pnpm sync:meta`: o comando inicializa corretamente e valida `DATABASE_URL` antes de processar.
- E2E/inspeção visual: cenários Playwright foram ampliados, mas a execução e a inspeção no navegador não puderam ser realizadas porque a permissão salva do navegador bloqueia o endereço local; nenhuma superfície alternativa foi usada.
