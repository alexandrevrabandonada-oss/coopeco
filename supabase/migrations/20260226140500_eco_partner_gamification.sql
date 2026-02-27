-- Phase A14: Partner Gamification Summary

drop view if exists public.v_partner_gamification_summary;
create view public.v_partner_gamification_summary as
with partner_stats as (
    select 
        pa.id as partner_id,
        pa.name,
        coalesce(stats.total_impact, 0) as impact_score
    from public.partners pa
    left join (
        select partner_id, sum(weight) as total_impact
        from public.impact_events
        where partner_id is not null
        group by 1
    ) stats on stats.partner_id = pa.id
),
level_calc as (
    select 
        ps.*,
        gl.id as level_id,
        gl.name as level_name,
        gl.color_hex as level_color,
        gl.min_score as level_min,
        next_gl.min_score as next_level_min
    from partner_stats ps
    left join lateral (
        select * from public.gamification_levels 
        where min_score <= ps.impact_score 
        order by min_score desc limit 1
    ) gl on true
    left join lateral (
        select * from public.gamification_levels 
        where min_score > ps.impact_score 
        order by min_score asc limit 1
    ) next_gl on true
)
select * from level_calc;

-- RLS
create policy "Partner gamification is public" on public.gamification_levels for select using (true);
-- (Already exists above, but ensuring consistency)
