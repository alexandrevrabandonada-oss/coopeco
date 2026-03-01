import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { redactPIIPatterns, stripPrivateFields } from "@/lib/privacy/sanitize";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * PII-Free Technical Observability Collector
 * Ensures technical failures are tracked without user surveillance.
 */
export async function POST(req: NextRequest) {
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: "Server env missing." }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { event_kind, severity, context_kind, context_key, message, meta } = body;

        if (!event_kind || !severity || !message) {
            return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
        }

        // Authenticated but PII-blind
        const authHeader = req.headers.get("authorization");
        const admin = createClient(supabaseUrl, serviceRoleKey);

        let neighborhood_id = body.neighborhood_id;

        // If no neighborhood_id provided, try to find from profile
        if (!neighborhood_id && authHeader?.startsWith("Bearer ")) {
            const token = authHeader.slice("Bearer ".length).trim();
            const { data: { user } } = await admin.auth.getUser(token);

            if (user) {
                const { data: profile } = await admin
                    .from("profiles")
                    .select("neighborhood_id")
                    .eq("id", user.id)
                    .single();

                if (profile?.neighborhood_id) {
                    neighborhood_id = profile.neighborhood_id;
                }
            }
        }

        // A38: Performance tracking specialization
        if (event_kind === 'api_slow' || event_kind === 'page_slow') {
            const duration = meta?.duration_ms || 0;
            // Only track significant delays to avoid noise (e.g. > 1500ms)
            if (duration < 1500 && event_kind === 'api_slow') {
                return NextResponse.json({ success: true, skipped: "below_threshold" });
            }
        }

        // Call Security Definer RPC for insertion & sanitization
        const { data, error } = await admin.rpc("rpc_insert_obs_event", {
            p_event_kind: event_kind,
            p_severity: severity,
            p_context_kind: context_kind || null,
            p_context_key: context_key || null,
            p_message: redactPIIPatterns(message.slice(0, 500)), // Truncar e redigir
            p_meta: stripPrivateFields(meta || {}), // Limpar campos privados
            p_neighborhood_id: neighborhood_id || null
        });

        if (error) {
            console.error("Obs Event Insert Fail:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, event_id: data });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
