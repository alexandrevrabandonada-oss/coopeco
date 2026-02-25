# DECISIONS: ECO Technical & Product Rules

## Stack Técnica
- **Framework**: Next.js (App Router) + TypeScript.
- **Backend/Auth**: Supabase.
- **Estilização**: Vanilla CSS (CSS Modules) ou Tailwind (conforme suporte).
- **Deploy**: Vercel.

## Regras de Produto

### 1. Sistema de Reações (Ações)
Não existe o botão "Curtir" tradicional. As interações devem ser significativas:
- **Confirmar**: Validar que uma ação ocorreu.
- **Apoiar**: Demonstrar suporte moral ou financeiro.
- **Replicar**: Mostrar que você fez o mesmo em seu território.
- **Chamado**: Solicitar ajuda ou denunciar ponto de descarte irregular.
- **Gratidão**: Feedback positivo direto entre usuários e cooperados.

### 2. Recibo ECO
- É a prova real de descarte correto.
- Gerado após a confirmação da coleta pelo cooperado.
- Contém: ID único, Peso Estimado, Data, Local e Hash de validação.
- Sem Recibo ECO vinculado, o usuário não sobe no ranking de "Sustentabilidade Real".

### 3. Ranking e Bairros
- O ranking é calculado com base no volume/frequência de Recibos ECO.
- Existe um ranking global e rankings específicos por Bairro para incentivar o orgulho local.

### 4. Privacidade
- Identidade leve. O usuário pode usar apelidos.
- Dados sensíveis (como endereço de coleta) são visíveis apenas para a cooperativa designada.

---
**Recursos Técnicos:**
- [Briefing do Produto](./BRIEFING.md)
- [Schema do Banco de Dados](./supabase_migration.sql)

