-- Seed Pricing Rules for Payout Implementation
INSERT INTO public.coop_pricing_rules (material_kind, unit_kind, amount_cents, active)
VALUES 
    ('paper', 'bag_p', 50, true),
    ('plastic', 'bag_m', 120, true),
    ('glass', 'bag_g', 30, true),
    ('metal', 'bag_p', 400, true),
    ('oil', 'oil_liters', 200, true)
ON CONFLICT (material_kind, unit_kind) WHERE (active = true) DO NOTHING;

-- Seed an Initial Payout Period
INSERT INTO public.coop_payout_periods (period_start, period_end, status)
VALUES ('2026-02-01', '2026-02-28', 'open')
ON CONFLICT DO NOTHING;
