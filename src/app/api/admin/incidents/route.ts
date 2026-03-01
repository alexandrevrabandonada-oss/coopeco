import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || session.user.app_metadata.role !== "operator") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { kind, cell_id, neighborhood_id, notes } = body;

        // Get severity from playbook card
        const { data: card } = await supabase
            .from("eco_playbook_cards")
            .select("severity")
            .eq("key", kind)
            .single();

        if (!card) return NextResponse.json({ error: "Playbook card not found" }, { status: 404 });

        let finalCellId = cell_id;
        if (!finalCellId && neighborhood_id) {
            const { data: cn } = await supabase
                .from("eco_cell_neighborhoods")
                .select("cell_id")
                .eq("neighborhood_id", neighborhood_id)
                .single();
            if (cn) finalCellId = cn.cell_id;
        }

        const { data, error } = await supabase
            .from("eco_incidents")
            .insert({
                cell_id: finalCellId,
                neighborhood_id,
                kind,
                severity: card.severity,
                status: 'open',
                opened_by: session.user.id,
                notes
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
