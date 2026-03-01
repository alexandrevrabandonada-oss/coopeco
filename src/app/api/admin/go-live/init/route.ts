import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const INITIAL_ITEMS = [
    { item_key: 'pilot_active_set', title: 'Piloto Ativo & Status Set' },
    { item_key: 'windows_created', title: 'Janelas de Coleta Criadas' },
    { item_key: 'at_least_one_drop_point', title: 'Pelo menos um Ponto ECO Ativo' },
    { item_key: 'invite_codes_generated', title: 'Códigos de Convite Gerados' },
    { item_key: 'kits_printed', title: 'Kits Físicos (Placas/Badges) impressos' },
    { item_key: 'recurring_generation_tested', title: 'Geração de Recorrência Testada' },
    { item_key: 'lot_open_close_tested', title: 'Fluxo de Lote (Abertura/Fechamento) OK' },
    { item_key: 'bulletin_published', title: 'Boletim Semanal Zero publicado' },
    { item_key: 'partner_policy_published', title: 'Política de Parcerias Publicada' },
    { item_key: 'notifications_working', title: 'Notificações (Push/App) validadas' },
    { item_key: 'offline_mode_ready', title: 'Offline-Lite Sync Testado' },
    { item_key: 'logistics_stock_ok', title: 'Estoque Mínimo de Logística OK' }
];

export async function POST(request: NextRequest) {
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: "Server env missing." }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const { neighborhood_id } = body;

    if (!neighborhood_id) {
        return NextResponse.json({ error: "Missing neighborhood_id." }, { status: 400 });
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData } = await admin.auth.getUser(token);
    if (!userData?.user) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

    // Init Checklist
    const { data: checklist, error: checklistError } = await admin
        .from("eco_go_live_checklist")
        .upsert({ neighborhood_id, version: 'v1' }, { onConflict: 'neighborhood_id' })
        .select()
        .single();

    if (checklistError) return NextResponse.json({ error: checklistError.message }, { status: 500 });

    // Seed Items
    const itemsToInsert = INITIAL_ITEMS.map(item => ({
        checklist_id: checklist.id,
        item_key: item.item_key,
        title: item.title,
        status: 'todo'
    }));

    const { error: itemsError } = await admin
        .from("eco_go_live_items")
        .upsert(itemsToInsert, { onConflict: 'checklist_id,item_key' });

    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

    return NextResponse.json({ success: true, checklist_id: checklist.id });
}
