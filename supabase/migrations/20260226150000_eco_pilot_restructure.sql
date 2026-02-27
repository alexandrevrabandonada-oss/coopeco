-- Phase A9: Pilot Pack VR (Refinement / Restructure)

-- 1. Pilot Programs
create table if not exists public.pilot_programs (
    id uuid primary key default gen_random_uuid(),
    city text not null,
    status text default 'planning' check (status in ('planning', 'active', 'paused', 'completed')),
    starts_on date,
    notes_public text,
    notes_ops text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- 2. Pilot Program Neighborhoods (Links programs to neighborhoods)
create table if not exists public.pilot_program_neighborhoods (
    id uuid primary key default gen_random_uuid(),
    program_id uuid references public.pilot_programs(id) on delete cascade,
    neighborhood_id uuid references public.neighborhoods(id) on delete cascade,
    priority int default 0,
    status text default 'active' check (status in ('active', 'inactive')),
    created_at timestamp with time zone default now(),
    unique(program_id, neighborhood_id)
);

-- 3. Pilot Checklists (Rituals)
create type public.ritual_kind as enum ('opening', 'before_window', 'during_window', 'closing_day', 'closing_week');

create table if not exists public.pilot_checklists (
    id uuid primary key default gen_random_uuid(),
    program_id uuid references public.pilot_programs(id) on delete cascade,
    kind public.ritual_kind not null,
    title text not null,
    created_at timestamp with time zone default now()
);

-- 4. Pilot Checklist Items (Tasks within Rituals)
create table if not exists public.pilot_checklist_items (
    id uuid primary key default gen_random_uuid(),
    checklist_id uuid references public.pilot_checklists(id) on delete cascade,
    neighborhood_id uuid references public.neighborhoods(id) on delete cascade,
    task_key text not null,
    title text not null,
    status text default 'todo' check (status in ('todo', 'done', 'skipped')),
    meta jsonb,
    completed_at timestamp with time zone,
    completed_by uuid references public.profiles(user_id),
    created_at timestamp with time zone default now(),
    -- Ensure task uniqueness per neighborhood/checklist if needed
    unique(checklist_id, neighborhood_id, task_key)
);

-- 5. Weekly Bulletins
create table if not exists public.weekly_bulletins (
    id uuid primary key default gen_random_uuid(),
    neighborhood_id uuid references public.neighborhoods(id) on delete cascade,
    year int not null,
    week_number int not null,
    status text default 'draft' check (status in ('draft', 'published', 'archived')),
    published_at timestamp with time zone,
    created_at timestamp with time zone default now(),
    unique(neighborhood_id, year, week_number)
);

-- 6. Weekly Bulletin Blocks (Modular Content)
create table if not exists public.weekly_bulletin_blocks (
    id uuid primary key default gen_random_uuid(),
    bulletin_id uuid references public.weekly_bulletins(id) on delete cascade,
    kind text not null, -- stats, contamination, decisions, highlights
    content jsonb not null,
    rank_order int default 0,
    created_at timestamp with time zone default now()
);

-- RLS & Policies
alter table public.pilot_programs enable row level security;
alter table public.pilot_program_neighborhoods enable row level security;
alter table public.pilot_checklists enable row level security;
alter table public.pilot_checklist_items enable row level security;
alter table public.weekly_bulletins enable row level security;
alter table public.weekly_bulletin_blocks enable row level security;

-- Operators manage all
create policy "Operators manage pilot programs" on public.pilot_programs to authenticated
    using ( public.has_role(ARRAY['operator'::public.app_role]) )
    with check ( public.has_role(ARRAY['operator'::public.app_role]) );

create policy "Operators manage pilot neighborhoods" on public.pilot_program_neighborhoods to authenticated
    using ( public.has_role(ARRAY['operator'::public.app_role]) )
    with check ( public.has_role(ARRAY['operator'::public.app_role]) );

create policy "Operators manage pilot checklists" on public.pilot_checklists to authenticated
    using ( public.has_role(ARRAY['operator'::public.app_role]) )
    with check ( public.has_role(ARRAY['operator'::public.app_role]) );

create policy "Operators manage pilot checklist items" on public.pilot_checklist_items to authenticated
    using ( public.has_role(ARRAY['operator'::public.app_role]) )
    with check ( public.has_role(ARRAY['operator'::public.app_role]) );

create policy "Operators manage weekly bulletins" on public.weekly_bulletins to authenticated
    using ( public.has_role(ARRAY['operator'::public.app_role]) )
    with check ( public.has_role(ARRAY['operator'::public.app_role]) );

create policy "Operators manage weekly bulletin blocks" on public.weekly_bulletin_blocks to authenticated
    using ( public.has_role(ARRAY['operator'::public.app_role]) )
    with check ( public.has_role(ARRAY['operator'::public.app_role]) );

-- Public read access to active programs and published bulletins
create policy "Public can read active pilot programs" on public.pilot_programs for select
    using ( status = 'active' );

create policy "Public can read pilot program neighborhoods" on public.pilot_program_neighborhoods for select
    using ( status = 'active' );

create policy "Public can read published bulletins" on public.weekly_bulletins for select
    using ( status = 'published' );

create policy "Public can read published bulletin blocks" on public.weekly_bulletin_blocks for select
    using ( exists (select 1 from public.weekly_bulletins wb where wb.id = bulletin_id and wb.status = 'published') );

-- Seed an Initial Program for Volta Redonda if not exists
insert into public.pilot_programs (city, status, notes_public, notes_ops)
values ('Volta Redonda', 'active', 'Iniciando o Piloto VR para transformar a reciclagem local.', 'Foco em VRB central e bairros adjacentes.')
on conflict do nothing;

-- Audit Logging
create trigger tr_audit_pilot_programs after insert or update on public.pilot_programs for each row execute function public.fn_audit_pilot_changes();
create trigger tr_audit_pilot_checklist_items after update or insert on public.pilot_checklist_items for each row execute function public.fn_audit_pilot_changes();
create trigger tr_audit_weekly_bulletins after update on public.weekly_bulletins for each row when (new.status = 'published') execute function public.fn_audit_pilot_changes();

-- Notify PostgREST
notify pgrst, 'reload schema';
