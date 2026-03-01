import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || session.user.app_metadata.role !== "operator") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: controls, error } = await supabase
        .from("eco_launch_controls")
        .select("*, neighborhoods(name), eco_cells(name)")
        .order("scope");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get telemetry summary
    const [telemetry, obsEvents, openIncidents] = await Promise.all([
        supabase
            .from("eco_launch_events")
            .select("event_kind, scope, neighborhood_id")
            .order("created_at", { ascending: false })
            .limit(100),
        supabase
            .from("eco_obs_events")
            .select("id, severity, cell_id, neighborhood_id")
            .eq("severity", "critical")
            .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString()),
        supabase
            .from("eco_incidents")
            .select("id, kind, severity, cell_id, neighborhood_id")
            .neq("status", "resolved")
    ]);

    return NextResponse.json({
        controls,
        telemetry: telemetry.data || [],
        obs_critical_hour: obsEvents.data || [],
        open_incidents: openIncidents.data || []
    });
}

export async function POST(req: NextRequest) {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || session.user.app_metadata.role !== "operator") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updates } = body;

    const { data, error } = await supabase
        .from("eco_launch_controls")
        .upsert({
            id: id || undefined,
            ...updates,
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
}
