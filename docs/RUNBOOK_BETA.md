# RUNBOOK BETA (Zero Dashboard)

## Ambientes
- Local (dev): execucao de migrations, test pack, smoke e dryrun via terminal.
- Staging (Vercel preview/staging): ambiente protegido por gate de acesso e sem indexacao.
- Producao (futuro): mesma base de scripts, com TLS estrito e sem chaves sensiveis no runtime publico.

## Variaveis (.env local/CI)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (somente local/CI; nunca expor em frontend)
- `SUPABASE_DB_URL` (somente local/CI)
- `ECO_DB_TLS_MODE` (`verify` por padrao; `no-verify` somente em dev local)
- `ECO_ENV` (`dev|staging|prod`)
- `ECO_STAGING_PASS` (somente para `ECO_ENV=staging`)
- `ECO_SMOKE_BASE_URL` (opcional; roda smoke contra staging remoto)
- `ECO_SMOKE_STAGING_PASS` (opcional; senha do gate de staging usada no smoke)

## Comandos oficiais
- `npm run db:apply`
- `npm run test:pack`
- `npm run verify:ops`
- `npm run smoke:beta`
- `npm run cleanup:dryrun`

## Smoke em staging
- Defina `ECO_SMOKE_BASE_URL=https://seu-staging.vercel.app` para usar endpoints HTTP do app remoto (`signed-url`, `export CSV`, paginas de validacao).
- Se o gate de staging estiver ativo, defina `ECO_SMOKE_STAGING_PASS` para enviar `x-eco-staging-pass` automaticamente.
- Sem `ECO_SMOKE_BASE_URL`, o smoke sobe app local em `127.0.0.1` para validar endpoints do app.
- O smoke usa `SUPABASE_SERVICE_ROLE_KEY` apenas para bootstrap de usuarios de teste no Auth; o fluxo funcional roda com sessao normal e RLS real.

## Recuperacao / Troubleshooting
- Views nao aparecem:
  - `db:apply` ja envia `NOTIFY pgrst, 'reload schema'`.
  - Confirme com `npm run db:apply` e valide que nao houve erro na etapa de reload.
- RLS negando acesso:
  - Rode `node tools/eco-rls-proof.mjs`.
  - Leia a primeira linha `[FAIL]` e ajuste policy/role da entidade afetada.
- Storage image nao carrega:
  - Valide `GET /api/media/signed-url` (single ou batch) e status codes.
  - Em expiracao, o cliente deve renovar 1 vez (retry controlado) e nao entrar em loop.
- Payout divergente:
  - Rode reconciliacao (ledger + adjustments - payouts).
  - Ajustes devem ser feitos so por `rpc_add_adjustment` (sem alterar ledger).

## Politica de privacidade (curta)
- Endereco completo so pode aparecer apos aceite/atribuicao da coleta.
- Midia de prova fica em bucket privado e sai somente por Signed URL temporaria.
- Export CSV de payout e exclusivo de operador e gera trilha em `admin_audit_log`.

## Politica de logs
- Nao logar PII (endereco completo, telefone, tokens, segredos).
- Logs de erro devem registrar contexto tecnico minimo (etapa, status, causa provavel).

## Secrets no GitHub Actions (sem valores no repo)
- `SUPABASE_DB_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (somente para bootstrap de usuarios de teste)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ECO_SMOKE_BASE_URL` (opcional, para smoke remoto em staging)
- `ECO_SMOKE_STAGING_PASS` (opcional, quando gate de staging estiver ativo)
