# BRIEFING: ECO PWA

## Visão do Produto
O **ECO** é um Super-App Mobile-First (PWA) que une rede social de impacto positivo com logística de logística reversa sob demanda. O objetivo é gamificar a sustentabilidade e facilitar a conexão entre cidadãos, cooperativas e parceiros comerciais.

## Pilares
1. **Rede Social do Bem**: Foco em ações, não apenas em posts. Reações são verbos: Confirmar, Apoiar, Replicar, Chamado, Gratidão.
2. **Coleta Sob Demanda**: Interface simples para solicitar coleta de materiais recicláveis pela cooperativa local.
3. **Recibo ECO**: O documento mestre que valida o impacto. Sem recibo, não há pontuação no ranking.
4. **Ranking e Território**: Visibilidade por bairro e por parceiro, criando um senso de comunidade e competição saudável.

## Roadmap (MVPs)

### MVP-0 (Fundação)
- [ ] Cadastro/Login via Supabase.
- [ ] Placeholder de todas as rotas principais.
- [ ] Layout mobile-first funcional.
- [ ] Conexão básica com Supabase.

### MVP-1 (Operacional)
- [ ] Fluxo de "Pedir Coleta".
- [ ] Painel do Cooperado para aceitar pedidos.
- [ ] Geração do primeiro "Recibo ECO" (PDF/Digital).
- [ ] Mural de ações sociais (Postar ação -> Receber Gratidão).

### MVP-2 (Ecossistema)
- [ ] Mapa interativo de pontos de coleta e parceiros.
- [ ] Ranking dinâmico por bairro.
- [ ] Integração de benefícios com Parceiros.

---
**Recursos Técnicos:**
- [Decisões de Projeto](./DECISIONS.md)
- [Schema do Banco de Dados](./supabase_migration.sql)

