-- 1) Table: eco_playbook_cards
-- Static reference for standard operational responses.
CREATE TABLE IF NOT EXISTS public.eco_playbook_cards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    key text UNIQUE NOT NULL, -- e.g. capacity_warning
    title text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('info', 'warn', 'critical')),
    diagnosis_md text NOT NULL,
    immediate_actions jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of strings
    next_24h_actions jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of strings
    comms_templates jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of card keys from A19
    pause_launch_recommended boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2) Table: eco_incidents
-- Tracks active operational incidents.
CREATE TABLE IF NOT EXISTS public.eco_incidents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cell_id uuid NOT NULL REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
    kind text NOT NULL REFERENCES public.eco_playbook_cards(key),
    severity text NOT NULL CHECK (severity IN ('info', 'warn', 'critical')),
    status text DEFAULT 'open' CHECK (status IN ('open', 'mitigating', 'resolved')),
    opened_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    opened_by uuid REFERENCES auth.users(id),
    notes text, -- Limited to 300 chars via app/trigger if needed
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3) Table: eco_incident_actions
-- Specific checklist items for an incident.
CREATE TABLE IF NOT EXISTS public.eco_incident_actions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    incident_id uuid NOT NULL REFERENCES public.eco_incidents(id) ON DELETE CASCADE,
    action_key text NOT NULL, -- Short key or the action text itself
    description text NOT NULL,
    status text DEFAULT 'todo' CHECK (status IN ('todo', 'done', 'skipped')),
    meta jsonb DEFAULT '{}'::jsonb,
    completed_at timestamptz,
    UNIQUE(incident_id, action_key)
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_incidents_cell_status ON public.eco_incidents(cell_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_neighborhood ON public.eco_incidents(neighborhood_id) WHERE neighborhood_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.eco_playbook_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_incident_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read for playbook cards" ON public.eco_playbook_cards
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write for operators on playbook cards" ON public.eco_playbook_cards
    FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'moderator')));

CREATE POLICY "Allow operators to read/write incidents" ON public.eco_incidents
    FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'moderator')));

CREATE POLICY "Allow operators to read/write incident actions" ON public.eco_incident_actions
    FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'moderator')));

-- Seed Data: Standard Response Cards
INSERT INTO public.eco_playbook_cards (key, title, severity, diagnosis_md, immediate_actions, next_24h_actions, comms_templates, pause_launch_recommended)
VALUES 
('capacity_warning', '⚠️ Capacidade Alta (70-89%)', 'warn', 
'A janela operacional está atingindo o limite de processamento digno. Risco de atrasos na coleta.',
'["Verificar se há pontos recomendados para promover", "Preparar aviso de janela quase cheia no card de bairro", "Avaliar necessidade de janela extra"]',
'["Sincronizar com logística para garantir EPIs extras", "Verificar se há voluntários/cooperados de prontidão"]',
'["capacity_warning_card"]', false),

('capacity_critical', '🚨 Lotação Crítica (>=90%)', 'critical', 
'A janela atingiu o limite técnico. Impossível aceitar novos pedidos sem comprometer o trabalho digno.',
'["Ativar Janela Extra (A15.3)", "Promover Ponto de Entrega Recomendado (A15.4)", "Pausar novos pedidos manuais"]',
'["Revisar zoneamento da célula", "Aumentar número de pontos ativos permanentemente"]',
'["capacity_critical_card", "extra_window_announcement"]', true),

('quality_drop', '📉 Queda de Qualidade (OK Rate Baixa)', 'warn', 
'O índice de conformidade da coleta caiu abaixo da meta. Muitos rejeitos ou separação inadequada.',
'["Acionar Educação Comunitária (A8)", "Triagem reforçada no galpão", "Publicar card Top Flags de Bairro (A19)"]',
'["Realizar oficina de separação no ponto focal", "Revisar instruções no Kit de Onboarding"]',
'["quality_education_alert"]', false),

('drop_point_inactive', '📍 Ponto de Entrega Inativo', 'warn', 
'Um Ponto do Bem (Eco-ponto) está sem movimentação ou bloqueado fisicamente.',
'["Visita técnica ao local", "Verificar integridade da Placa/Sticker", "Reativar no Painel de Inteligência"]',
'["Checklist de Ponto (A20)", "Substituir sinalização danificada"]',
'["point_status_update"]', false),

('stock_deficit', '📦 Falta de Estoque (Lacre/Bag)', 'critical', 
'O saldo de ativos para reposição está abaixo do mínimo operacional.',
'["Repor via Painel de Logística (A23)", "Imprimir Kits de Emergência (A20)", "Redirecionar estoque de célula vizinha"]',
'["Atualizar inventário físico", "Solicitar compra centralizada"]',
'["stock_refill_notice"]', false),

('obs_critical_burst', '💻 Instabilidade Técnica Crítica', 'critical', 
'Pico de falhas técnicas detectado (Sync, RPC ou API). Risco de perda de dados.',
'["Checar Painel de Observabilidade (A31)", "Verificar status do Banco de Dados/Edge", "Notificar equipe de infra"]',
'["Orientar modo Offline total para operadores", "Forçar logout/login se for erro de Auth"]',
'["tech_maintenance_alert"]', true),

('signedurl_errors', '🔑 Erro de Acesso a Mídia', 'warn', 
'Falha recorrente ao gerar URLs de visualização de fotos/comprovantes.',
'["Limpar cache de Signed URLs local", "Verificar permissões do bucket de storage", "Fallbak para renovação forçada"]',
'["Revisar limites de expiração de token", "Check de conectividade S3/Supabase"]',
'[]', false),

('offline_sync_fail', '📡 Falha de Sincronização Offline', 'error', 
'Pedidos locais não estão integrando com o servidor após retorno da conexão.',
'["Verificar Outbox no dispositivo do operador", "Acionar Trigger Sync manual", "Check de conflito de ID"]',
'["Reiniciar navegador (Service Worker reload)", "Exportar dump manual da outbox se persistir"]',
'[]', false)
ON CONFLICT (key) DO UPDATE SET 
    title = EXCLUDED.title,
    diagnosis_md = EXCLUDED.diagnosis_md,
    immediate_actions = EXCLUDED.immediate_actions,
    next_24h_actions = EXCLUDED.next_24h_actions;

-- Trigger to create actions automatically when an incident is opened
CREATE OR REPLACE FUNCTION public.fn_on_incident_opened()
RETURNS TRIGGER AS $$
DECLARE
    v_playbook record;
    v_action text;
BEGIN
    SELECT * INTO v_playbook FROM public.eco_playbook_cards WHERE key = NEW.kind;
    
    IF FOUND THEN
        -- Add immediate actions
        FOR v_action IN SELECT jsonb_array_elements_text(v_playbook.immediate_actions) LOOP
            INSERT INTO public.eco_incident_actions (incident_id, action_key, description)
            VALUES (NEW.id, 'immediate:' || md5(v_action), v_action)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_incident_opened
AFTER INSERT ON public.eco_incidents
FOR EACH ROW EXECUTE FUNCTION public.fn_on_incident_opened();

NOTIFY pgrst, 'reload schema';
