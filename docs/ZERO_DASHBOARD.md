# ZERO Dashboard Workflow

Este projeto roda setup de banco, seed e prova de RLS sem usar Supabase Dashboard/SQL Editor.

## Variaveis em `.env.local`

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `ECO_DB_TLS_MODE` (`verify` padrao, `no-verify` apenas dev)
- `ECO_DB_SSL_ROOT_CERT_PATH` (opcional; PEM da CA para TLS verified em dev)
- `ECO_SMOKE_BASE_URL` (staging remoto para smoke)
- `ECO_SMOKE_STAGING_PASS` (senha do gate de staging, se ativo)

## Comandos

```bash
npm run db:apply
npm run test:pack
npm run verify:all
npm run cleanup:dryrun
npm run test:ui
npm run verify:ops
npm run tls:provision
npm run smoke:staging
```

## Avisos

- Nunca commitar `.env.local`.
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_DB_URL` em logs ou relatorios.
- `ECO_DB_TLS_MODE=verify` e o padrao recomendado (TLS validado).
- `ECO_DB_TLS_MODE=no-verify` e bloqueado.

## TLS verified dev

1. Rode uma vez: `npm run tls:provision`
2. O script salva a cadeia TLS em `tools/_tls/eco-supabase-ca.pem`.
3. Depois rode `npm run db:apply` com `ECO_DB_TLS_MODE=verify`.
4. Se quiser caminho customizado, defina `ECO_DB_SSL_ROOT_CERT_PATH` para um PEM existente.
