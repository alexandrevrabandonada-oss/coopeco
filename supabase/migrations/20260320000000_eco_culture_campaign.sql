-- Migration: A46 — Campanha de Cultura (ECO é cuidado, recibo é lei)
-- supabase/migrations/20260320000000_eco_culture_campaign.sql

-- 1. eco_campaign_packs: Containers for campaigns
CREATE TABLE IF NOT EXISTS public.eco_campaign_packs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    scope text NOT NULL CHECK (scope IN ('cell', 'neighborhood')),
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    title text NOT NULL,
    start_date date DEFAULT current_date,
    duration_days int DEFAULT 7,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'running', 'done')),
    created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    CONSTRAINT one_of_entity CHECK (
        (scope = 'cell' AND cell_id IS NOT NULL AND neighborhood_id IS NULL) OR
        (scope = 'neighborhood' AND neighborhood_id IS NOT NULL AND cell_id IS NULL)
    )
);

ALTER TABLE public.eco_campaign_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators manage campaign packs" ON public.eco_campaign_packs FOR ALL TO authenticated 
    USING (public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role]));

-- 2. eco_campaign_items: Daily assets
CREATE TABLE IF NOT EXISTS public.eco_campaign_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    pack_id uuid NOT NULL REFERENCES public.eco_campaign_packs(id) ON DELETE CASCADE,
    day_index int NOT NULL CHECK (day_index >= 1 AND day_index <= 30),
    kind text NOT NULL, -- manifesto, next_window, etc.
    text_template_kind text, -- reference to A44 kind
    card_kind text, -- reference to A19 card kind
    print_kind text,
    generated_text text,
    generated_card_url text, -- /api/share/card?kind=...
    status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'generated', 'published', 'skipped')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    CONSTRAINT unique_day_in_pack UNIQUE (pack_id, day_index)
);

ALTER TABLE public.eco_campaign_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators manage campaign items" ON public.eco_campaign_items FOR ALL TO authenticated 
    USING (public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role]));

-- 3. rpc_generate_campaign_pack: Initialize the 7-day schedule
CREATE OR REPLACE FUNCTION public.rpc_generate_campaign_pack(p_pack_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pack record;
BEGIN
    SELECT * INTO v_pack FROM public.eco_campaign_packs WHERE id = p_pack_id;
    IF NOT FOUND THEN RETURN '{"error": "Pack not found"}'::jsonb; END IF;

    -- Delete existing items to reset
    DELETE FROM public.eco_campaign_items WHERE pack_id = p_pack_id;

    -- Day 1: Manifesto
    INSERT INTO public.eco_campaign_items (pack_id, day_index, kind, text_template_kind, card_kind)
    VALUES (p_pack_id, 1, 'manifesto', 'invite_text', 'manifesto');

    -- Day 2: Próxima Janela
    INSERT INTO public.eco_campaign_items (pack_id, day_index, kind, text_template_kind, card_kind)
    VALUES (p_pack_id, 2, 'next_window', 'next_window_text', 'window_alert');

    -- Day 3: Ponto Recomendado
    INSERT INTO public.eco_campaign_items (pack_id, day_index, kind, text_template_kind, card_kind, print_kind)
    VALUES (p_pack_id, 3, 'drop_point', 'recommended_point_text', 'point_focus', 'placa');

    -- Day 4: Foco Educativo
    INSERT INTO public.eco_campaign_items (pack_id, day_index, kind, text_template_kind, card_kind)
    VALUES (p_pack_id, 4, 'learning_focus', 'learning_focus_week_text', 'edu_focus');

    -- Day 5: Missões
    INSERT INTO public.eco_campaign_items (pack_id, day_index, kind, text_template_kind, card_kind)
    VALUES (p_pack_id, 5, 'missions', 'missions_text', 'mission_box');

    -- Day 6: Boletim/Transparência
    INSERT INTO public.eco_campaign_items (pack_id, day_index, kind, text_template_kind, card_kind)
    VALUES (p_pack_id, 6, 'weekly_bulletin', 'weekly_bulletin_text', 'stats_summary');

    -- Day 7: Ritual/Convite
    INSERT INTO public.eco_campaign_items (pack_id, day_index, kind, text_template_kind, card_kind, print_kind)
    VALUES (p_pack_id, 7, 'runbook_public', 'runbook_notice_text', 'invite_final', 'sticker');

    UPDATE public.eco_campaign_packs SET status = 'ready', updated_at = now() WHERE id = p_pack_id;

    RETURN '{"status": "ok", "items_created": 7}'::jsonb;
END;
$$;

NOTIFY pgrst, 'reload schema';
