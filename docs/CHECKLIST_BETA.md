# CHECKLIST PRE-BETA

## Seguranca
- [ ] RLS validada em 100% dos modulos criticos (`eco-rls-proof` sem FAIL).
- [ ] Storage privado (`eco-media`) sem leitura publica direta.
- [ ] TLS em modo `verify` por padrao; `no-verify` bloqueado em CI/prod.
- [ ] Staging protegido (gate ativo com `ECO_ENV=staging` + `ECO_STAGING_PASS`).

## Privacidade
- [ ] Endereco completo isolado e liberado somente apos aceite.
- [ ] Midia acessada apenas por Signed URL com expiracao curta.
- [ ] Exportacoes sem PII desnecessaria; acesso somente operador.

## Operacao
- [ ] Dry-run payout executado e reconciliacao fechando em zero.
- [ ] Cleanup DRYRUN funcionando sem tocar dados reais.
- [ ] `admin_audit_log` registrando export/cleanup e acoes administrativas.

## UX minima
- [ ] Fluxo principal completo (pedido -> coleta -> recibo -> mural) sem quebra.
- [ ] Erros de permissao/fluxo exibem mensagem clara para operador/cooperado.

## Observabilidade minima
- [ ] Logs sem PII e sem segredos.
- [ ] Endpoints criticos (`signed-url`, `export CSV`, RPCs payout) respondendo conforme esperado.

## CI / Staging smoke
- [ ] Smoke sem fallback service-role para acoes normais (resident/cooperado/operator).
- [ ] `ECO_SMOKE_BASE_URL` configurado quando smoke remoto for exigido.
- [ ] `ECO_SMOKE_STAGING_PASS` configurado quando gate de staging estiver ativo.

## Secrets GitHub Actions (sem valores no repo)
- [ ] `SUPABASE_DB_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (apenas bootstrap de usuarios de teste)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `ECO_SMOKE_BASE_URL` (opcional)
- [ ] `ECO_SMOKE_STAGING_PASS` (opcional)
