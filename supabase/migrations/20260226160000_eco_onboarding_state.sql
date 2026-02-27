-- Phase A16: Onboarding State

create table if not exists public.onboarding_state (
    user_id uuid primary key references public.profiles(user_id) on delete cascade,
    step text not null default 'start' check (step in ('start', 'neighborhood', 'mode', 'address', 'first_action', 'done')),
    chosen_mode text check (chosen_mode in ('drop_point', 'doorstep')),
    chosen_drop_point_id uuid references public.eco_drop_points(id),
    chosen_window_id uuid references public.route_windows(id),
    completed_at timestamp with time zone,
    updated_at timestamp with time zone default now()
);

-- RLS
alter table public.onboarding_state enable row level security;

create policy "Users can manage their own onboarding state" on public.onboarding_state
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Operators can read onboarding state without PII" on public.onboarding_state
    for select to authenticated
    using ( public.has_role(ARRAY['operator'::public.app_role]) );

-- Trigger for updated_at
create or replace function public.fn_update_onboarding_timestamp()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger tr_update_onboarding_timestamp
    before update on public.onboarding_state
    for each row execute function public.fn_update_onboarding_timestamp();

-- Audit Trigger (using existing audit function from A9/A14)
create trigger tr_audit_onboarding_state
    after insert or update on public.onboarding_state
    for each row execute function public.fn_audit_pilot_changes();

-- Notify PostgREST
notify pgrst, 'reload schema';
