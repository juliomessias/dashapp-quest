# Arquitetura

## Visão geral

A aplicação é um monólito modular Next.js. Páginas e rotas HTTP vivem em `app/`; regras de negócio em `lib/`; integração externa em `services/meta/`; persistência em `db/`; sincronizações executáveis em `jobs/`.

```text
Navegador → Next.js App Router → Auth.js/RBAC → Serviços → Drizzle → PostgreSQL
                                          ↘ Meta Marketing API
```

## Segurança

- Tokens Meta e segredos nunca entram em componentes cliente.
- O OAuth usa `state` aleatório de uso único; tokens são trocados no backend e cifrados com AES-256-GCM no PostgreSQL.
- Sessões usam cookie `httpOnly`, `sameSite=lax` e `secure` em produção.
- Senhas são Argon2id e login possui limite de tentativas.
- Rotas de sincronização exigem administrador autenticado ou `CRON_SECRET`.
- Erros de sincronização preservam os últimos dados válidos.
- Importações são validadas com Zod antes da persistência e devem ser auditadas.

## Alcance

Alcance diário é armazenado somente para consulta diária. Intervalos mensais, YTD e personalizados solicitam um agregado único à Meta e usam `reach_period_cache`; períodos atuais expiram em seis horas, períodos históricos encerrados não precisam expirar.

## Dados de desenvolvimento

`DEMO_MODE=false` é o padrão. `DEMO_MODE=true` isola um conjunto fictício somente para testes e desenvolvimento local, é recusado em produção e nunca aparece como alternativa na interface. Nunca combine as duas origens na mesma consulta.

## Integração Meta

`meta_connections` guarda o estado e o token cifrado; `meta_oauth_states` impede replay do callback; `meta_available_accounts` mantém a descoberta; `meta_account_links` relaciona a conta externa ao cadastro interno. `sync_runs` registra cada conta e período. Desvincular remove apenas o vínculo ativo e pausa a conta, preservando Insights, metas e orçamentos.
