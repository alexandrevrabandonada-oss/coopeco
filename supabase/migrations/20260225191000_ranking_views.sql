-- 1. Neighborhood Ranking (Last 30 days)
CREATE OR REPLACE VIEW public.v_rank_neighborhood_30d AS
SELECT 
    n.id,
    n.slug,
    n.name,
    SUM(m.impact_score) as impact_score,
    SUM(m.receipts_count) as receipts_count,
    SUM(m.mutiroes_count) as mutiroes_count,
    SUM(m.chamados_count) as chamados_count
FROM public.neighborhoods n
LEFT JOIN public.metrics_daily m ON n.id = m.neighborhood_id
WHERE m.day >= (CURRENT_DATE - INTERVAL '30 days') OR m.day IS NULL
GROUP BY n.id, n.slug, n.name
ORDER BY impact_score DESC NULLS LAST;

-- 2. Partner Ranking (Last 30 days)
CREATE OR REPLACE VIEW public.v_rank_partner_30d AS
SELECT 
    p.id,
    p.name,
    SUM(m.impact_score) as impact_score,
    SUM(m.receipts_count) as receipts_count
FROM public.partners p
LEFT JOIN public.metrics_daily m ON p.id = m.partner_id
WHERE m.day >= (CURRENT_DATE - INTERVAL '30 days') OR m.day IS NULL
GROUP BY p.id, p.name
ORDER BY impact_score DESC NULLS LAST;

-- 3. Transparency Neighborhood Month (6 months)
CREATE OR REPLACE VIEW public.v_transparency_neighborhood_month AS
SELECT 
    neighborhood_id,
    to_char(day, 'YYYY-MM') as month,
    SUM(receipts_count) as receipts_count,
    SUM(mutiroes_count) as mutiroes_count,
    SUM(chamados_count) as chamados_count,
    SUM(impact_score) as impact_score
FROM public.metrics_daily
GROUP BY neighborhood_id, to_char(day, 'YYYY-MM')
ORDER BY month DESC;
