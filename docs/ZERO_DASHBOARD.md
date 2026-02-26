# ZERO Dashboard Workflow

Este projeto roda setup de banco, seed e prova de RLS sem usar Supabase Dashboard/SQL Editor.

## Variaveis em `.env.local`

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `ECO_DB_TLS_MODE` (`verify` padrao, `no-verify` apenas dev)

## Comandos

```bash
npm run db:apply
npm run test:pack
npm run verify:all
npm run cleanup:dryrun
npm run test:ui
npm run verify:ops
```

## Avisos

- Nunca commitar `.env.local`.
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_DB_URL` em logs ou relatorios.
- `ECO_DB_TLS_MODE=verify` e o padrao recomendado (TLS validado).
- Use `ECO_DB_TLS_MODE=no-verify` somente em dev/local e com warning explicito.
