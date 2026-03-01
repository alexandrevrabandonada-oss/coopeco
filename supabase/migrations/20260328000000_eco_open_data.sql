-- Migration: A54 - Dados Abertos Agregados (Open Data)
-- Description: Criação da tabela de controle para geração de feeds e links (JSON/CSV) públicos com tokens únicos.

-- 1. Tabela de Configuração de Feeds Open Data
CREATE TABLE IF NOT EXISTS public.eco_open_data_feeds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope TEXT NOT NULL CHECK (scope IN ('cell', 'neighborhood')),
    cell_id UUID REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    dataset TEXT NOT NULL CHECK (dataset IN ('impact_weekly', 'wins_weekly', 'bulletins', 'windows_ics')),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    public_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE NULLS NOT DISTINCT (scope, cell_id, neighborhood_id, dataset)
);

-- Trigger to update 'updated_at'
CREATE OR REPLACE FUNCTION update_eco_open_data_feeds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = TIMEZONE('utc'::text, NOW());
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_eco_open_data_feeds_updated_at
BEFORE UPDATE ON public.eco_open_data_feeds
FOR EACH ROW EXECUTE FUNCTION update_eco_open_data_feeds_updated_at();

-- RLS
ALTER TABLE public.eco_open_data_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso negado para anon e auth (via API REST)"
    ON public.eco_open_data_feeds FOR SELECT
    TO PUBLIC
    USING (false);

CREATE POLICY "Operadores podem ver configs de sua célula"
    ON public.eco_open_data_feeds FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.eco_mandates m
            WHERE m.user_id = auth.uid()
            AND m.cell_id = eco_open_data_feeds.cell_id
            AND m.status = 'active'
        )
    );

CREATE POLICY "Operadores podem editar configs de sua célula"
    ON public.eco_open_data_feeds FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.eco_mandates m
            WHERE m.user_id = auth.uid()
            AND m.cell_id = eco_open_data_feeds.cell_id
            AND m.status = 'active'
        )
    );

CREATE POLICY "Admins têm acesso total"
    ON public.eco_open_data_feeds FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'is_admin' = 'true'
        )
    );
