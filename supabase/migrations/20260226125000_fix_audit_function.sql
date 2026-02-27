-- Fix for Phase A9 Audit Function to match actual admin_audit_log schema

create or replace function public.fn_audit_pilot_changes()
returns trigger as $$
begin
    insert into public.admin_audit_log (actor_id, action, target_type, target_id, meta)
    values (
        coalesce(auth.uid(), '2d9a5d94-0447-4838-8318-4ac4e0999de3'), -- Fallback for system operations
        case 
            when tg_table_name = 'eco_pilot_configs' then 'pilot_config_changed'
            when tg_table_name = 'eco_pilot_goals_weekly' then 'pilot_goal_set'
            when tg_table_name = 'eco_ops_day_runs' then 'ops_day_started'
            when tg_table_name = 'eco_ops_day_tasks' and new.status = 'done' then 'ops_task_done'
            when tg_table_name = 'eco_weekly_bulletins' and new.is_published = true then 'weekly_bulletin_published'
            when tg_table_name = 'profile_badges' then 'badge_earned'
            else 'pilot_activity'
        end,
        'system', -- Or appropriate target type
        case 
            when tg_table_name = 'eco_pilot_configs' then new.neighborhood_id
            when tg_table_name = 'profile_badges' then new.profile_id
            else new.id
        end,
        jsonb_build_object('table', tg_table_name, 'op', tg_op, 'new', row_to_json(new))
    );
    return new;
end;
$$ language plpgsql security definer;
