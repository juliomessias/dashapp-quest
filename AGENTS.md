# AGENTS.md

## Projeto

Dashboard monolítico Next.js para BI de Meta Ads. Preserve TypeScript strict, App Router, formatação pt-BR e o modo demonstração sem dependência de credenciais.

## Regras de implementação

- Segredos existem somente no servidor e são lidos de variáveis de ambiente.
- Fórmulas de negócio ficam em `lib/formulas.ts` e precisam de teste.
- Alcance não pode ser somado entre dias; intervalos usam alcance agregado e cache.
- Metas anuais consideram apenas janeiro a outubro.
- Novembro e dezembro não recebem metas.
- Alterações administrativas devem gerar auditoria.
- Componentes visuais devem permanecer acessíveis por teclado e responsivos.

## Validação

Execute `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` antes de concluir.
