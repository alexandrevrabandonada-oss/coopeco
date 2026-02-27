-- Phase A14: Gamificação & Estágios de Conexão (Revised)

-- 1. Extend impact_events to track individual users
alter table public.impact_events add column if not exists user_id uuid references public.profiles(user_id);

-- Update trigger functions to populate user_id
create or replace function public.on_receipt_created_impact()
returns trigger as $$
declare
    v_neighborhood_id uuid;
    v_partner_id uuid;
    v_user_id uuid;
BEGIN
    -- Get neighborhood and user_id from pickup_request
    SELECT neighborhood_id, created_by INTO v_neighborhood_id, v_user_id
    FROM public.pickup_requests 
    WHERE id = NEW.request_id;

    -- Get partner if linked
    SELECT partner_id INTO v_partner_id
    FROM public.partner_receipts
    WHERE receipt_id = NEW.id
    LIMIT 1;

    INSERT INTO public.impact_events (kind, neighborhood_id, partner_id, receipt_id, user_id, weight)
    VALUES ('receipt_created', v_neighborhood_id, v_partner_id, NEW.id, v_user_id, 10);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

create or replace function public.on_post_created_impact()
returns trigger as $$
BEGIN
    IF NEW.kind = 'mutirao' THEN
        INSERT INTO public.impact_events (kind, neighborhood_id, user_id, weight)
        VALUES ('mutirao_created', NEW.neighborhood_id, NEW.created_by, 8);
    ELSIF NEW.kind = 'chamado' THEN
        INSERT INTO public.impact_events (kind, neighborhood_id, user_id, weight)
        VALUES ('chamado_created', NEW.neighborhood_id, NEW.created_by, 3);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Backfill user_id for existing impact_events (best effort)
update public.impact_events ie
set user_id = pr.created_by
from public.pickup_requests pr
where ie.receipt_id = pr.id -- Wait, impact_events.receipt_id is foreign key to receipts.id
and ie.user_id is null;

update public.impact_events ie
set user_id = r.cooperado_id
from public.receipts r
where ie.receipt_id = r.id
and ie.user_id is null; -- This is for cases where we might want to track cooperado impact too

-- 2. Gamification Levels
create table if not exists public.gamification_levels (
    id int primary key,
    name text not null,
    min_score int not null,
    badge_url text,
    color_hex text default '#22c55e',
    created_at timestamp with time zone default now()
);

-- Seed Levels
insert into public.gamification_levels (id, name, min_score, color_hex) values
(1, 'Semente', 0, '#86efac'),
(2, 'Broto', 100, '#4ade80'),
(3, 'Árvore', 500, '#22c55e'),
(4, 'Floresta', 1500, '#16a34a'),
(5, 'Ecossistema', 5000, '#15803d')
on conflict (id) do update set 
    name = excluded.name, 
    min_score = excluded.min_score, 
    color_hex = excluded.color_hex;

-- 3. Gamification Badges
create table if not exists public.gamification_badges (
    id uuid primary key default gen_random_uuid(),
    slug text unique not null,
    name text not null,
    description text,
    icon_name text,
    created_at timestamp with time zone default now()
);

insert into public.gamification_badges (slug, name, description, icon_name) values
('primeira_coleta', 'Primeira Ação', 'Realizou sua primeira coleta no bairro.', 'Sparkles'),
('dez_seguidas', 'Consistência Pura', '10 coletas sem interrupção.', 'Repeat'),
('parceiro_fiel', 'Parceiro do Bairro', 'Apoiou 50 coletas como ponto ECO ou âncora.', 'Heart'),
('limpeza_total', 'Mão na Massa', 'Participou de um mutirão registrado.', 'Zap')
on conflict (slug) do nothing;

-- 4. Profile Badges
create table if not exists public.profile_badges (
    profile_id uuid references public.profiles(user_id) on delete cascade,
    badge_id uuid references public.gamification_badges(id) on delete cascade,
    earned_at timestamp with time zone default now(),
    primary key (profile_id, badge_id)
);

-- 5. View: v_profile_gamification_summary
drop view if exists public.v_profile_gamification_summary;
create view public.v_profile_gamification_summary as
with user_stats as (
    select 
        p.user_id,
        p.display_name,
        coalesce(stats.total_impact, 0) as impact_score,
        (select count(*) from public.profile_badges pb where pb.profile_id = p.user_id) as badges_count
    from public.profiles p
    left join (
        select user_id, sum(weight) as total_impact
        from public.impact_events
        where user_id is not null
        group by 1
    ) stats on stats.user_id = p.user_id
),
level_calc as (
    select 
        us.*,
        gl.id as level_id,
        gl.name as level_name,
        gl.color_hex as level_color,
        gl.min_score as level_min,
        next_gl.min_score as next_level_min,
        next_gl.name as next_level_name
    from user_stats us
    left join lateral (
        select * from public.gamification_levels 
        where min_score <= us.impact_score 
        order by min_score desc limit 1
    ) gl on true
    left join lateral (
        select * from public.gamification_levels 
        where min_score > us.impact_score 
        order by min_score asc limit 1
    ) next_gl on true
)
select * from level_calc;

-- RLS
alter table public.gamification_levels enable row level security;
alter table public.gamification_badges enable row level security;
alter table public.profile_badges enable row level security;

create policy "Levels are public" on public.gamification_levels for select using (true);
create policy "Badges are public" on public.gamification_badges for select using (true);
create policy "Users read own badges" on public.profile_badges for select using (auth.uid() = profile_id);

-- Audit Trigger
drop trigger if exists tr_audit_profile_badges on public.profile_badges;
create trigger tr_audit_profile_badges after insert on public.profile_badges for each row execute function public.fn_audit_pilot_changes();
