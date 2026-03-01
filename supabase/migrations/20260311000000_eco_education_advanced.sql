-- A36 — Educação Avançada (Adaptativa por Bairro)
-- supabase/migrations/20260311000000_eco_education_advanced.sql

-- A) eco_neighborhood_learning_focus
CREATE TABLE IF NOT EXISTS public.eco_neighborhood_learning_focus (
    neighborhood_id uuid PRIMARY KEY REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    week_start date NOT NULL,
    focus_flag text CHECK (focus_flag IN ('food', 'liquids', 'mixed', 'sharp', 'volume', 'none')),
    focus_material text, -- Papel, Plástico, Metal, Vidro
    focus_tip_id uuid REFERENCES public.edu_tips(id), -- Dica principal da semana
    goal_ok_rate numeric(5,2) DEFAULT 80.00,
    created_at timestamptz DEFAULT now(),
    
    UNIQUE(neighborhood_id, week_start)
);

-- B) eco_first_week_rituals
CREATE TABLE IF NOT EXISTS public.eco_first_week_rituals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    ritual_key text NOT NULL CHECK (ritual_key IN ('week1_day1', 'week1_day3', 'week1_day7')),
    title text NOT NULL,
    body_md text NOT NULL,
    cta_kind text CHECK (cta_kind IN ('read_tip', 'do_mission', 'share_card', 'subscribe_recurring', 'use_drop_point')),
    created_at timestamptz DEFAULT now(),
    
    UNIQUE(neighborhood_id, ritual_key)
);

-- RLS
ALTER TABLE public.eco_neighborhood_learning_focus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_first_week_rituals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read focus" ON public.eco_neighborhood_learning_focus
    FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Operators manage focus" ON public.eco_neighborhood_learning_focus
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'operator'));

CREATE POLICY "Public read rituals" ON public.eco_first_week_rituals
    FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Operators manage rituals" ON public.eco_first_week_rituals
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'operator'));

-- C) View for suggested focus based on last 7 days of flags (A15)
CREATE OR REPLACE VIEW public.v_learning_focus_suggested_7d AS
WITH flag_stats AS (
    SELECT 
        neighborhood_id,
        unnest(flags) as flag,
        count(*) as flag_count
    FROM public.receipts
    WHERE created_at >= now() - interval '7 days'
      AND flags IS NOT NULL AND array_length(flags, 1) > 0
    GROUP BY 1, 2
),
top_flags AS (
    SELECT 
        neighborhood_id,
        flag,
        flag_count,
        rank() OVER (PARTITION BY neighborhood_id ORDER BY flag_count DESC) as rnk
    FROM flag_stats
),
neighborhood_stats AS (
    SELECT 
        neighborhood_id,
        avg(CASE WHEN status = 'ok' THEN 100 ELSE 0 END) as ok_rate_7d
    FROM public.receipts
    WHERE created_at >= now() - interval '7 days'
    GROUP BY 1
)
SELECT 
    n.id as neighborhood_id,
    tf.flag as suggested_flag,
    ns.ok_rate_7d
FROM public.neighborhoods n
LEFT JOIN top_flags tf ON tf.neighborhood_id = n.id AND tf.rnk = 1
LEFT JOIN neighborhood_stats ns ON ns.neighborhood_id = n.id;
