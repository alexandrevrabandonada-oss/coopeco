-- Migration: A23-ECO — Logística Física (Kits, Placas, Stickers, Reposição)
-- Created: 2026-02-27

-- 1. Assets Catalog
CREATE TABLE IF NOT EXISTS public.eco_assets_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'pcs',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Asset Stocks
CREATE TABLE IF NOT EXISTS public.eco_asset_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id UUID REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
    drop_point_id UUID REFERENCES public.eco_drop_points(id) ON DELETE SET NULL,
    asset_id UUID REFERENCES public.eco_assets_catalog(id) ON DELETE CASCADE,
    qty_on_hand INT NOT NULL DEFAULT 0,
    qty_min INT NOT NULL DEFAULT 10,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(cell_id, neighborhood_id, drop_point_id, asset_id)
);

-- 3. Asset Movements
CREATE TABLE IF NOT EXISTS public.eco_asset_moves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id UUID NOT NULL REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    from_scope TEXT NOT NULL CHECK (from_scope IN ('cell', 'neighborhood', 'drop_point', 'external')),
    from_id UUID, -- References cell/neighborhood/drop_point depending on scope
    to_scope TEXT NOT NULL CHECK (to_scope IN ('cell', 'neighborhood', 'drop_point', 'external')),
    to_id UUID,
    asset_id UUID NOT NULL REFERENCES public.eco_assets_catalog(id) ON DELETE CASCADE,
    qty INT NOT NULL CHECK (qty > 0),
    reason TEXT NOT NULL CHECK (reason IN ('restock', 'deploy_point', 'event', 'damage', 'loss', 'print_batch')),
    notes TEXT, -- max 200 via UI/Check
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT asset_move_notes_length CHECK (char_length(notes) <= 200)
);

-- 4. RLS Policies
ALTER TABLE public.eco_assets_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_asset_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_asset_moves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read assets catalog" ON public.eco_assets_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage assets catalog" ON public.eco_assets_catalog FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin')));

CREATE POLICY "Operators view asset stocks" ON public.eco_asset_stocks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin', 'moderator', 'cooperado')));
CREATE POLICY "Operators manage asset stocks" ON public.eco_asset_stocks FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin')));

CREATE POLICY "Operators view asset moves" ON public.eco_asset_moves FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin', 'moderator', 'cooperado')));
CREATE POLICY "Operators record asset moves" ON public.eco_asset_moves FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin')));

-- 5. Trigger for updated_at in stocks
CREATE TRIGGER set_asset_stocks_updated_at
    BEFORE UPDATE ON public.eco_asset_stocks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 6. Operational View: Restock Needed
CREATE OR REPLACE VIEW public.v_asset_restock_needed AS
SELECT 
    s.id as stock_id,
    s.cell_id,
    s.neighborhood_id,
    s.drop_point_id,
    a.slug as asset_slug,
    a.name as asset_name,
    s.qty_on_hand,
    s.qty_min,
    (s.qty_min - s.qty_on_hand) as deficit,
    c.name as cell_name,
    n.name as neighborhood_name,
    dp.name as drop_point_name
FROM public.eco_asset_stocks s
JOIN public.eco_assets_catalog a ON s.asset_id = a.id
JOIN public.eco_cells c ON s.cell_id = c.id
LEFT JOIN public.neighborhoods n ON s.neighborhood_id = n.id
LEFT JOIN public.eco_drop_points dp ON s.drop_point_id = dp.id
WHERE (s.qty_min - s.qty_on_hand) > 0;

-- 7. Automated Stock Adjustment Trigger
CREATE OR REPLACE FUNCTION public.proc_update_stock_on_move()
RETURNS TRIGGER AS $$
BEGIN
    -- Update "From" stock if not external
    IF NEW.from_scope <> 'external' THEN
        -- We use COALESCE IDs to match the UNIQUE index
        UPDATE public.eco_asset_stocks
        SET qty_on_hand = qty_on_hand - NEW.qty
        WHERE cell_id = NEW.cell_id
          AND ( (NEW.from_scope = 'cell' AND neighborhood_id IS NULL AND drop_point_id IS NULL)
             OR (NEW.from_scope = 'neighborhood' AND neighborhood_id = NEW.from_id AND drop_point_id IS NULL)
             OR (NEW.from_scope = 'drop_point' AND drop_point_id = NEW.from_id) );
    END IF;

    -- Update "To" stock if not external
    IF NEW.to_scope <> 'external' THEN
        -- Upsert "To" stock
        INSERT INTO public.eco_asset_stocks (cell_id, neighborhood_id, drop_point_id, asset_id, qty_on_hand)
        VALUES (
            NEW.cell_id,
            CASE WHEN NEW.to_scope = 'neighborhood' THEN NEW.to_id ELSE NULL END,
            CASE WHEN NEW.to_scope = 'drop_point' THEN NEW.to_id ELSE NULL END,
            NEW.asset_id,
            NEW.qty
        )
        ON CONFLICT (cell_id, neighborhood_id, drop_point_id, asset_id)
        DO UPDATE SET qty_on_hand = public.eco_asset_stocks.qty_on_hand + EXCLUDED.qty_on_hand;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_on_move
    AFTER INSERT ON public.eco_asset_moves
    FOR EACH ROW
    EXECUTE FUNCTION public.proc_update_stock_on_move();

-- 8. Seeding Catalog
INSERT INTO public.eco_assets_catalog (slug, name, unit, description) VALUES
('a4_drop_point_sign', 'Placa Ponto ECO (A4)', 'pcs', 'Placa de identificação laminada para drop points.'),
('sticker_qr', 'Adesivo QR ECO (10x10)', 'pcs', 'Adesivo com QR code para pontos e baldes.'),
('operator_badge', 'Crachá Operador', 'pcs', 'Identificação oficial do cooperado.'),
('operator_checklist', 'Checklist Operador (Daily)', 'pcs', 'Roteiro de ritual diário impresso.'),
('drop_point_checklist', 'Checklist Manutenção Ponto', 'pcs', 'Formulário de conferência de limpeza e baldes.'),
('pilot_day_script', 'Roteiro Dia de Piloto', 'pcs', 'Guia para eventos de lançamento e mutirões.')
ON CONFLICT (slug) DO NOTHING;
