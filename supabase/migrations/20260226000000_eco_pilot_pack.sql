-- Phase A9: Pilot Pack VR (Operational Ritual)

-- A) eco_pilot_configs
create table if not exists public.eco_pilot_configs (
    neighborhood_id uuid primary key references public.neighborhoods(id) on delete cascade,
    active boolean default false,
    pilot_name text default 'Bairro Piloto',
    intro_md text,
    weekly_bulletin_weekday int default 1, -- 1 = Monday
    weekly_bulletin_hour int default 18,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- B) eco_pilot_goals_weekly
create table if not exists public.eco_pilot_goals_weekly (
    id uuid primary key default gen_random_uuid(),
    neighborhood_id uuid references public.neighborhoods(id) on delete cascade,
    week_start date not null,
    target_receipts int default 50,
    target_ok_rate numeric(5,2) default 80.00,
    target_recurring_coverage_pct numeric(5,2) default 40.00,
    target_drop_point_share_pct numeric(5,2) default 30.00,
    target_anchor_partners int default 2,
    notes text,
    created_at timestamp with time zone default now(),
    unique(neighborhood_id, week_start)
);

-- C) eco_ops_day_runs
create table if not exists public.eco_ops_day_runs (
    id uuid primary key default gen_random_uuid(),
    neighborhood_id uuid references public.neighborhoods(id) on delete cascade,
    op_date date not null,
    status text default 'open' check (status in ('open', 'closed')),
    notes text,
    created_by uuid references public.profiles(user_id),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    unique(neighborhood_id, op_date)
);

-- D) eco_ops_day_tasks
create table if not exists public.eco_ops_day_tasks (
    id uuid primary key default gen_random_uuid(),
    run_id uuid references public.eco_ops_day_runs(id) on delete cascade,
    task_key text not null, -- generate_recurring | open_lot | assign_receipts | close_lot | publish_bulletin
    status text default 'todo' check (status in ('todo', 'done', 'skipped')),
    meta jsonb,
    completed_at timestamp with time zone,
    unique(run_id, task_key)
);

-- E) eco_weekly_bulletins
create table if not exists public.eco_weekly_bulletins (
    id uuid primary key default gen_random_uuid(),
    neighborhood_id uuid references public.neighborhoods(id) on delete cascade,
    week_start date not null,
    title text not null,
    body_md text not null,
    highlights jsonb,
    is_published boolean default false,
    published_at timestamp with time zone,
    published_by uuid references public.profiles(user_id),
    created_at timestamp with time zone default now(),
    unique(neighborhood_id, week_start)
);

-- RLS & Policies
alter table public.eco_pilot_configs enable row level security;
alter table public.eco_pilot_goals_weekly enable row level security;
alter table public.eco_ops_day_runs enable row level security;
alter table public.eco_ops_day_tasks enable row level security;
alter table public.eco_weekly_bulletins enable row level security;

-- Policies for eco_pilot_configs
create policy "Operators can manage pilot configs"
    on public.eco_pilot_configs
    to authenticated
    using ( exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'operator') )
    with check ( exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'operator') );

create policy "Public can read active pilot configs"
    on public.eco_pilot_configs
    for select
    using ( active = true );

-- Policies for eco_pilot_goals_weekly
create policy "Operators can manage weekly goals"
    on public.eco_pilot_goals_weekly
    to authenticated
    using ( exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'operator') )
    with check ( exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'operator') );

-- Policies for eco_ops_day_runs
create policy "Operators can manage day runs"
    on public.eco_ops_day_runs
    to authenticated
    using ( exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'operator') )
    with check ( exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'operator') );

-- Policies for eco_ops_day_tasks
create policy "Operators can manage day tasks"
    on public.eco_ops_day_tasks
    to authenticated
    using ( exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'operator') )
    with check ( exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'operator') );

-- Policies for eco_weekly_bulletins
create policy "Operators can manage bulletins"
    on public.eco_weekly_bulletins
    to authenticated
    using ( exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'operator') )
    with check ( exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'operator') );

create policy "Public can read published bulletins"
    on public.eco_weekly_bulletins
    for select
    using ( is_published = true );

-- Views
drop view if exists public.v_pilot_public_config;
create view public.v_pilot_public_config as
select 
    neighborhood_id,
    pilot_name,
    intro_md,
    active
from public.eco_pilot_configs
where active = true;

drop view if exists public.v_neighborhood_weekly_snapshot;
create view public.v_neighborhood_weekly_snapshot as
with week_metrics as (
    select
        pr.neighborhood_id,
        date_trunc('week', r.created_at)::date as week_start,
        count(r.id) as receipts_count,
        count(r.id) filter (where r.final_notes is not null) as receipts_ok, -- Temporary check for OK
        count(r.id) filter (where pr.id in (select request_id from public.pickup_request_private)) as receipts_doorstep, -- Approximate
        0 as receipts_drop_point -- Placeholder
    from public.receipts r
    join public.pickup_requests pr on pr.id = r.request_id
    group by 1, 2
)
select
    wm.neighborhood_id,
    wm.week_start,
    wm.receipts_count,
    case when wm.receipts_count > 0 then (wm.receipts_ok::numeric / wm.receipts_count * 100) else 0 end as ok_rate,
    case when wm.receipts_count > 0 then (wm.receipts_drop_point::numeric / wm.receipts_count * 100) else 0 end as drop_point_share_pct,
    (select 0) as active_anchors_count -- Placeholder until anchors are implemented
from week_metrics wm;

-- Audit Logging (Reusing admin_audit_log if exists)
create or replace function public.fn_audit_pilot_changes()
returns trigger as $$
begin
    insert into public.admin_audit_log (operator_id, event_type, table_name, record_id, metadata)
    values (
        auth.uid(),
        case 
            when tg_table_name = 'eco_pilot_configs' then 'pilot_config_changed'
            when tg_table_name = 'eco_pilot_goals_weekly' then 'pilot_goal_set'
            when tg_table_name = 'eco_ops_day_runs' then 'ops_day_started'
            when tg_table_name = 'eco_ops_day_tasks' and new.status = 'done' then 'ops_task_done'
            when tg_table_name = 'eco_weekly_bulletins' and new.is_published = true then 'weekly_bulletin_published'
            else 'pilot_activity'
        end,
        tg_table_name,
        case 
            when tg_table_name = 'eco_pilot_configs' then new.neighborhood_id::text
            else new.id::text
        end,
        jsonb_build_object('op', tg_op, 'new', row_to_json(new))
    );
    return new;
end;
$$ language plpgsql security definer;

create trigger tr_audit_pilot_configs after insert or update on public.eco_pilot_configs for each row execute function public.fn_audit_pilot_changes();
create trigger tr_audit_pilot_goals after insert or update on public.eco_pilot_goals_weekly for each row execute function public.fn_audit_pilot_changes();
create trigger tr_audit_ops_day after insert or update on public.eco_ops_day_runs for each row execute function public.fn_audit_pilot_changes();
create trigger tr_audit_ops_tasks after update of status on public.eco_ops_day_tasks for each row when (new.status = 'done') execute function public.fn_audit_pilot_changes();
create trigger tr_audit_bulletins after update of is_published on public.eco_weekly_bulletins for each row when (new.is_published = true) execute function public.fn_audit_pilot_changes();
