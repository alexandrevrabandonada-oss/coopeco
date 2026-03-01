-- Migration: A50 — Matching Leve + Execução com “Recibo de Tarefa”

-- A) eco_common_tasks: The actual task instance
CREATE TABLE IF NOT EXISTS public.eco_common_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
    call_id uuid REFERENCES public.eco_calls(id) ON DELETE SET NULL,
    interest_id uuid REFERENCES public.eco_call_interests(id) ON DELETE SET NULL,
    kind text NOT NULL, -- (volunteer|mutirao|logistics|curation|comms|ops)
    title text NOT NULL CHECK (char_length(title) <= 120),
    description_md text CHECK (char_length(description_md) <= 1200),
    status text NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'in_progress', 'done', 'cancelled')),
    assignee_id uuid REFERENCES auth.users(id),
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS for tasks
ALTER TABLE public.eco_common_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can manage tasks in their cell"
    ON public.eco_common_tasks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.eco_mandates m
            WHERE m.user_id = auth.uid()
              AND m.cell_id = public.eco_common_tasks.cell_id
              AND m.status = 'active'
        )
    );

CREATE POLICY "Assignees can read and update their own tasks"
    ON public.eco_common_tasks
    FOR SELECT
    USING (assignee_id = auth.uid());

CREATE POLICY "Assignees can update status/metadata of their own tasks"
    ON public.eco_common_tasks
    FOR UPDATE
    USING (assignee_id = auth.uid())
    WITH CHECK (assignee_id = auth.uid());

-- B) eco_task_actions (Checklist items)
CREATE TABLE IF NOT EXISTS public.eco_task_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid REFERENCES public.eco_common_tasks(id) ON DELETE CASCADE,
    action_key text NOT NULL,
    title text NOT NULL CHECK (char_length(title) <= 120),
    status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'done', 'skipped')),
    completed_at timestamptz,
    UNIQUE(task_id, action_key)
);

ALTER TABLE public.eco_task_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consistent with task access"
    ON public.eco_task_actions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.eco_common_tasks t
            WHERE t.id = public.eco_task_actions.task_id
              AND (
                  t.assignee_id = auth.uid() 
                  OR EXISTS (
                      SELECT 1 FROM public.eco_mandates m 
                      WHERE m.user_id = auth.uid() AND m.cell_id = t.cell_id AND m.status = 'active'
                  )
              )
        )
    );

-- C) eco_task_receipts (Lightweight receipts)
CREATE TABLE IF NOT EXISTS public.eco_task_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid REFERENCES public.eco_common_tasks(id) ON DELETE CASCADE,
    summary text NOT NULL CHECK (char_length(summary) <= 300),
    evidence_links jsonb DEFAULT '[]'::jsonb,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.eco_task_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators and assignees can read receipts"
    ON public.eco_task_receipts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.eco_common_tasks t
            WHERE t.id = public.eco_task_receipts.task_id
              AND (
                  t.assignee_id = auth.uid() 
                  OR EXISTS (
                      SELECT 1 FROM public.eco_mandates m 
                      WHERE m.user_id = auth.uid() AND m.cell_id = t.cell_id AND m.status = 'active'
                  )
              )
        )
    );

CREATE POLICY "Assignees can create receipts for their tasks"
    ON public.eco_task_receipts
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.eco_common_tasks t
            WHERE t.id = task_id AND t.assignee_id = auth.uid()
        )
    );

-- D) eco_task_rollups_weekly (Aggregated metrics)
CREATE TABLE IF NOT EXISTS public.eco_task_rollups_weekly (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    week_start date NOT NULL,
    done_count int DEFAULT 0,
    kinds jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    UNIQUE(cell_id, week_start)
);

ALTER TABLE public.eco_task_rollups_weekly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can manage rollups"
    ON public.eco_task_rollups_weekly
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.eco_mandates m
            WHERE m.user_id = auth.uid()
              AND m.cell_id = public.eco_task_rollups_weekly.cell_id
              AND m.status = 'active'
        )
    );

-- Automation: Trigger to create task when interest is accepted

CREATE OR REPLACE FUNCTION public.fn_on_call_interest_accepted()
RETURNS TRIGGER AS $$
DECLARE
    v_call_record public.eco_calls%ROWTYPE;
    v_task_id uuid;
BEGIN
    IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
        -- Get call details
        SELECT * INTO v_call_record FROM public.eco_calls WHERE id = NEW.call_id;
        
        -- Create task
        INSERT INTO public.eco_common_tasks (
            cell_id, 
            neighborhood_id, 
            call_id, 
            interest_id, 
            kind, 
            title, 
            description_md, 
            assignee_id
        ) VALUES (
            v_call_record.cell_id,
            v_call_record.neighborhood_id,
            NEW.call_id,
            NEW.id,
            v_call_record.kind,
            v_call_record.title,
            v_call_record.body_md,
            NEW.user_id
        ) RETURNING id INTO v_task_id;

        -- Seed default actions based on kind
        CASE v_call_record.kind
            WHEN 'logistics' THEN
                INSERT INTO public.eco_task_actions (task_id, action_key, title) VALUES
                (v_task_id, 'confirm_stock', 'Confirmar estoque'),
                (v_task_id, 'move_item', 'Movimentar item'),
                (v_task_id, 'update_checklist', 'Atualizar checklist');
            WHEN 'comms' THEN
                INSERT INTO public.eco_task_actions (task_id, action_key, title) VALUES
                (v_task_id, 'gen_card', 'Gerar card'),
                (v_task_id, 'publish_text', 'Publicar texto'),
                (v_task_id, 'register_campaign', 'Registrar em campanha');
            WHEN 'curation' THEN
                INSERT INTO public.eco_task_actions (task_id, action_key, title) VALUES
                (v_task_id, 'review_media', 'Revisar mídia'),
                (v_task_id, 'add_transcription', 'Adicionar transcrição'),
                (v_task_id, 'publish_content', 'Publicar conteúdo');
            WHEN 'ops' THEN
                INSERT INTO public.eco_task_actions (task_id, action_key, title) VALUES
                (v_task_id, 'runbook_step', 'Executar passo do runbook'),
                (v_task_id, 'log_action', 'Registrar incidente/ação');
            ELSE
                INSERT INTO public.eco_task_actions (task_id, action_key, title) VALUES
                (v_task_id, 'execute', 'Executar tarefa principal');
        END CASE;

        -- Log in audit
        INSERT INTO public.admin_audit_log (admin_id, action, target_table, target_id, details)
        VALUES (
            auth.uid(),
            'CREATE_TASK_FROM_INTEREST',
            'eco_common_tasks',
            v_task_id,
            jsonb_build_object('interest_id', NEW.id, 'assignee_id', NEW.user_id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_on_call_interest_accepted
AFTER UPDATE OF status ON public.eco_call_interests
FOR EACH ROW
EXECUTE FUNCTION public.fn_on_call_interest_accepted();
