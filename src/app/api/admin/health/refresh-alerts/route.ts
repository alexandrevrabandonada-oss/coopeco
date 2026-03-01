import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dispatchCriticalAlert } from "@/lib/integrations/webhooks";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: "Server env missing." }, { status: 500 });
    }

    const { neighborhood_id } = await req.json();
    if (!neighborhood_id) return NextResponse.json({ error: "Missing neighborhood_id" }, { status: 400 });

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Call RPC to refresh alerts in DB
    const { error: rpcError } = await admin.rpc('rpc_refresh_ops_alerts', {
        p_neighborhood_id: neighborhood_id
    });

    if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 });

    // 2. Fetch critical alerts created/updated just now
    // We filter by severity 'critical' and active = true
    const { data: criticalAlerts } = await admin
        .from("ops_alerts")
        .select("*, neighborhood:neighborhoods(id, name, slug)")
        .eq("neighborhood_id", neighborhood_id)
        .eq("severity", "critical")
        .eq("active", true)
        .gte("updated_at", new Date(Date.now() - 30000).toISOString()); // Last 30 seconds

    // 3. Dispatch webhooks for each critical alert
    // In a real high-traffic app, this would be a background job.
    if (criticalAlerts && criticalAlerts.length > 0) {
        // We need to find the cell_id for this neighborhood
        const { data: cellLink } = await admin
            .from("eco_cell_neighborhoods")
            .select("cell_id")
            .eq("neighborhood_id", neighborhood_id)
            .maybeSingle();

        if (cellLink) {
            for (const alert of criticalAlerts) {
                await dispatchCriticalAlert({
                    cell_id: cellLink.cell_id,
                    neighborhood_slug: alert.neighborhood?.slug,
                    title: `ALERTA CRÍTICO: ${alert.kind}`,
                    body: alert.message,
                    entity_type: alert.entity_type,
                    entity_id: alert.entity_id
                });
            }
        }
    }

    return NextResponse.json({ success: true, alerts_processed: criticalAlerts?.length || 0 });
}
