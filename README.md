# Dashboard de Performance Meta Ads

Aplicação de Business Intelligence para acompanhar mídia, metas e orçamento de múltiplas contas Meta Ads. O ciclo corporativo vai de 1º de janeiro a 31 de outubro; novembro e dezembro não recebem metas.

## Stack

Next.js App Router, TypeScript strict, PostgreSQL, Drizzle ORM, Tailwind CSS, Recharts, TanStack Table, Zod, Auth.js, Argon2id, Vitest e Playwright. O serviço web é monolítico; PostgreSQL é o único serviço adicional.

## Execução local real

No Windows, dê duplo clique em `iniciar-dashboard.bat`. Na primeira execução, ele instala as dependências, cria um `.env.local` com segredos aleatórios, prepara um banco local embutido vazio e solicita o nome, e-mail e senha do primeiro administrador. A senha não é gravada no arquivo. Depois, a aplicação inicia em `http://127.0.0.1:3000`.

Para habilitar a conexão oficial, execute `configurar-meta.bat`. O assistente pede o App ID, recebe o App Secret com entrada oculta, exige uma URL pública HTTPS de callback e grava somente as cinco variáveis Meta no `.env.local`, sem alterar banco, administrador ou outras configurações. Depois reinicie o dashboard. O iniciador também oferece esse assistente automaticamente quando detectar credenciais ausentes. `localhost`, `127.0.0.1`, endereços IP e callbacks HTTP são recusados inclusive em desenvolvimento: o OAuth real deve passar por HTTPS.

### OAuth local com túnel HTTPS

A aplicação continua rodando localmente na porta 3000, mas a Meta deve acessar essa porta por uma origem HTTPS pública. Use um túnel de sua preferência; a URL temporária nunca é gravada no código nem versionada.

Exemplo com Cloudflare Tunnel, depois de instalar o `cloudflared`:

```powershell
cloudflared tunnel --url http://127.0.0.1:3000
```

Exemplo com ngrok, depois de instalar e autenticar o cliente:

```powershell
ngrok http 3000
```

Copie a origem HTTPS exibida pelo túnel e acrescente o caminho exato `/api/meta/callback`. Por exemplo, se o túnel informar `https://endereco-gerado-pelo-tunel.example`, configure:

```env
META_REDIRECT_URI=https://endereco-gerado-pelo-tunel.example/api/meta/callback
```

Execute `configurar-meta.bat`, informe essa URL completa e cadastre a mesma string em **Valid OAuth Redirect URIs** no Meta for Developers. Inicie o dashboard antes do túnel e mantenha ambos em execução durante todo o OAuth. Se a origem temporária mudar, atualize a variável, reinicie a aplicação e atualize também o painel da Meta. Para manter a sessão e a navegação inteiramente na origem pública, acesse o dashboard pelo próprio endereço do túnel e configure `NEXTAUTH_URL` com essa origem HTTPS.

Esse fluxo usa `LOCAL_DATABASE_MODE=true` somente para execução local e mantém `DEMO_MODE=false`: nenhum dado ou login fictício é criado. Para validar os pré-requisitos sem iniciar, execute `iniciar-dashboard.bat --verificar`; para apenas concluir a preparação inicial, use `iniciar-dashboard.bat --preparar`.

Para usar PostgreSQL, configure manualmente `.env.local` a partir de `.env.example`, mantenha `LOCAL_DATABASE_MODE=false`, preencha os valores e execute:

```bash
pnpm install
pnpm db:migrate
pnpm admin:create
pnpm dev
```

`pnpm admin:create` usa `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` apenas no processo local e grava uma senha Argon2id. Depois da criação, remova esses três valores do ambiente.

Para desenvolvimento/testes isolados, `DEMO_MODE=true` usa PGlite em `.data/demo-postgres` e permite `pnpm db:seed`. Essa opção é recusada quando `NODE_ENV=production`, não aparece na interface e nunca deve apontar para o banco real.

## Variáveis de ambiente

- `DATABASE_URL`: conexão PostgreSQL persistente.
- `LOCAL_DATABASE_MODE`: usa um banco PGlite local vazio quando `true`, apenas fora de produção.
- `LOCAL_DATABASE_DIR`: diretório opcional do banco local embutido.
- `AUTH_SECRET`: segredo aleatório com pelo menos 32 bytes.
- `NEXTAUTH_URL`: origem pública da aplicação; em produção ou durante o OAuth pelo túnel, use a origem HTTPS externa.
- `DEMO_MODE`: `false` por padrão; `true` somente em desenvolvimento/testes isolados.
- `META_APP_ID`: identificador do aplicativo Business na Meta.
- `META_APP_SECRET`: segredo do aplicativo, exclusivamente server-side.
- `META_REDIRECT_URI`: callback público HTTPS exato, por exemplo `https://bi.exemplo.com/api/meta/callback`; não aceita origem local ou IP.
- `META_GRAPH_API_VERSION`: versão fixada e revisada da Graph API; a implementação atual usa `v25.0`.
- `META_TOKEN_ENCRYPTION_KEY`: 32 bytes em base64 ou 64 caracteres hexadecimais para AES-256-GCM.
- `CRON_SECRET`: segredo exclusivo do endpoint de sincronização.
- `INITIAL_ADMIN_*`: valores one-shot usados apenas por `pnpm admin:create`.

Gere segredos de forma segura e mantenha `.env.local` fora do Git. A página de integração informa somente o nome da variável e o motivo seguro da falha, nunca seus valores. O botão **Conectar com Meta** permanece bloqueado até a callback ser uma URL pública HTTPS válida.

## Configurar o aplicativo na Meta

A versão e os requisitos devem ser revistos antes de cada atualização no [changelog oficial da Graph API](https://developers.facebook.com/docs/graph-api/changelog/). Em 26/08/2026, a integração está fixada em `v25.0`.

1. Crie ou selecione um aplicativo do tipo Business no [Meta for Developers](https://developers.facebook.com/apps/).
2. Em **Configurações → Básico**, copie o **ID do aplicativo** para `META_APP_ID`. Revele o **Chave secreta do aplicativo** e grave-a diretamente em `META_APP_SECRET` no servidor ou gerenciador de segredos; não a envie por chat e não a coloque no frontend.
3. Adicione Facebook Login for Business e Marketing API.
4. Em Facebook Login, cadastre `META_REDIRECT_URI` exatamente em **Valid OAuth Redirect URIs**. A rota realmente implementada é `/api/meta/callback`; use a origem HTTPS pública seguida desse caminho. Não use `localhost`, `127.0.0.1`, IP privado, HTTP, query ou barra final.
5. Defina `META_GRAPH_API_VERSION=v25.0` e gere `META_TOKEN_ENCRYPTION_KEY` com exatamente 32 bytes, em base64 ou 64 caracteres hexadecimais.
6. Configure domínios do aplicativo, URL da política de privacidade, exclusão de dados e demais campos exigidos pela Meta.
7. Solicite `ads_read` e `read_insights` para leitura de estrutura e métricas. A aplicação também solicita `business_management` porque lista Business Managers e as contas próprias/de clientes; ela não solicita permissões de escrita de anúncios, Página ou Instagram.
8. Para ativos de terceiros, solicite Advanced Access/App Review para as permissões aplicáveis e conclua a verificação empresarial quando exigida pela Meta.
9. Reinicie o servidor e acesse **Integrações → Meta Ads** como administrador. Quando as cinco variáveis estiverem válidas, o estado muda para **Configurada, aguardando conexão** e o botão **Conectar com Meta** é habilitado.

### Onde configurar as variáveis

- **Desenvolvimento local:** publique a porta 3000 por um túnel HTTPS, execute `configurar-meta.bat`, edite somente `.env.local` se necessário e reinicie completamente `iniciar-dashboard.bat` ou `pnpm dev`. O Next.js prioriza variáveis já presentes no processo, depois arquivos locais específicos do ambiente e por último `.env`; por isso um valor vazio em `.env.local` não deve ser confundido com uma credencial configurada em outro arquivo.
- **Docker Compose:** crie um `.env` ao lado de `docker-compose.yml` ou exporte as cinco variáveis no processo do Compose. O arquivo encaminha exatamente `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_GRAPH_API_VERSION` e `META_TOKEN_ENCRYPTION_KEY` ao contêiner.
- **Preview e produção:** cadastre cada variável separadamente no gerenciador de segredos da hospedagem, no ambiente correto. Variáveis de preview não são copiadas automaticamente para produção. Depois, faça um novo deploy para que o processo de runtime receba os valores. O balanceador ou proxy deve terminar TLS com certificado válido e redirecionar HTTP para HTTPS preservando caminho e query (preferencialmente 308). A aplicação não deriva a callback de `Host`, `request.url` ou `X-Forwarded-Proto`: autorização, troca do código e retorno administrativo usam a origem HTTPS explícita de `META_REDIRECT_URI`, evitando downgrade pela comunicação HTTP interna do proxy.

Para testar, abra **Integrações → Meta Ads**, confirme o indicador **Callback HTTPS — Segura e válida**, clique **Conectar com Meta** e inspecione `redirect_uri` na URL aberta. Ela deve ser byte a byte igual a `META_REDIRECT_URI`. Depois conclua a autorização e use **Testar conexão**; a aplicação consulta `/me` e `/me/permissions` no backend antes de informar sucesso. Se o callback falhar, confirme protocolo, domínio, subdomínio, porta, caminho, caixa das letras e ausência de query ou barra final. Nenhum desses passos exige colocar App Secret, chave de criptografia ou token no navegador.

Fluxo implementado:

1. **Conectar com Meta** gera `state` aleatório, grava somente seu hash com expiração de dez minutos e abre o OAuth oficial.
2. `/api/meta/callback` consome o `state` uma única vez e troca o código no backend.
3. O token é estendido quando possível e armazenado com AES-256-GCM; não entra em HTML, JSON do navegador, localStorage ou logs.
4. O backend verifica `/me` e `/me/permissions`, lista `/me/businesses`, `/me/adaccounts`, `/{business-id}/owned_ad_accounts` e `/{business-id}/client_ad_accounts` com paginação.
5. O administrador associa cada conta disponível a marca, mercado e analista e escolhe a data inicial do histórico.
6. A vinculação cria/atualiza a conta interna e executa o backfill inicial. Desvincular pausa a conta, mas preserva Insights, metas, orçamentos e histórico.

Os dados de desempenho vêm de `/act_{account-id}/insights`, com granularidade diária e nível de anúncio. O cliente usa bearer token server-side, timeout, paginação, retry exponencial para 429/5xx e mensagens sanitizadas.

## Banco e migrations

As migrations são incrementais e ficam em `db/migrations`:

```bash
pnpm db:generate
pnpm db:migrate
```

`0002_left_frog_thor.sql` adiciona `meta_connections`, `meta_oauth_states`, `meta_available_accounts`, `meta_account_links` e amplia `sync_runs` com conexão/vínculo. `0003_woozy_starhawk.sql` impede Business Managers duplicados. Outros índices únicos evitam conexão duplicada por responsável e vínculos conflitantes para a mesma conta Meta ou conta interna. A unicidade original de Insights continua garantindo reprocessamento idempotente.

## Sincronização

O botão **Sincronizar dados agora** e o endpoint protegido processam cada conta separadamente. Uma falha registra o erro sanitizado e mantém os últimos dados válidos. Sem período explícito, são reprocessados os últimos sete dias para capturar atrasos de atribuição.

Comando local:

```bash
pnpm sync:meta
pnpm sync:meta 2026-01-01 2026-01-31
```

Agendamento:

```http
POST /api/sync/meta
Authorization: Bearer <CRON_SECRET>
Content-Type: application/json

{"start":"2026-09-24","end":"2026-09-30"}
```

Agende diariamente após o fechamento da Meta. O endpoint também aceita uma sessão administrativa, mas nunca aceita usuários analyst/viewer.

## Metas, orçamentos e importação

Administração → Metas e Administração → Orçamentos são os fluxos principais. Ambos validam duplicidades, persistem autoria e alimentam as páginas analíticas. A importação CSV permanece opcional, transacional e auditada; contas Meta precisam existir antes da importação.

Cabeçalho CSV:

```text
ano,mes,meta_account_id,conta,marca,pais,analista,meta_alcance,meta_impressoes,meta_engajamento,meta_video,meta_curtidores,meta_seguidores,orcamento_mensal
```

## Qualidade

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Os testes Meta usam respostas controladas e nunca chamam a API real. Eles cobrem configuração ausente, OAuth/state, troca de token, expiração, permissões, listagem, vínculo múltiplo, constraints, desvínculo sem perda, sincronização, falha e upsert.

## Segurança e operação

- Cookies de sessão são `httpOnly`, `sameSite=lax` e `secure` em produção.
- Login local usa Argon2id e limite de cinco tentativas por 15 minutos.
- Administradores gerenciam e sincronizam; analyst/viewer permanecem somente leitura.
- Alterações administrativas geram `audit_logs` sem segredos.
- O build e o runtime de produção recusam `DEMO_MODE=true`.
- Rotacione `META_TOKEN_ENCRYPTION_KEY` somente com um plano de recriptografia; trocar a chave invalida tokens já armazenados.
- Defina retenção, controle de acesso e base legal LGPD antes do uso em produção.

## Limitações externas

- O OAuth real depende de aplicativo Meta configurado, redirect URI válido, usuários/ativos atribuídos e permissões aprovadas no painel da Meta.
- A data de expiração depende de `expires_in`; alguns tipos de token podem não fornecer esse campo.
- Métricas sociais de Página/Instagram não são solicitadas nesta etapa para manter o menor privilégio. Elas exigem permissões e sincronização próprias antes de serem habilitadas.
- Alcance não deve ser somado entre dias ou contas; o cache de alcance agregado permanece como fonte correta para intervalos suportados.

Consulte `docs/arquitetura.md` e `docs/dicionario-de-metricas.md` para regras adicionais.
