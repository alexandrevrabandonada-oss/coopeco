import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertNoPII } from "@/lib/privacy/sanitize";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * A34 Privacy Audit Engine
 * Simulates public endpoint calls and scans sensitive tables for PII leaks.
 */
export async function POST(req: NextRequest) {
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: "Server env missing." }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Auth check (Operator only)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== 'operator') {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const auditResults: any[] = [];
    let overallStatus: 'pass' | 'fail' = 'pass';

    try {
        // 1. Audit Observability Logs
        const { data: obsEvents } = await admin.from("eco_obs_events").select("message, meta").order("created_at", { ascending: false }).limit(50);
        let obsFailures = 0;
        if (obsEvents) {
            obsEvents.forEach(e => {
                try {
                    assertNoPII(e.message);
                    assertNoPII(e.meta);
                } catch { obsFailures++; }
            });
        }
        auditResults.push({
            rule_key: 'no_phone_email_in_logs',
            status: obsFailures === 0 ? 'pass' : 'fail',
            matches_count: obsFailures
        });
        if (obsFailures > 0) overallStatus = 'fail';

        // 2. Audit Public Feeds (Simulado - pegando dados brutos que seriam exportados)
        const { data: bulletins } = await admin.from("comm_exports").select("payload").order("created_at", { ascending: false }).limit(10);
        let bullFailures = 0;
        if (bulletins) {
            bulletins.forEach(b => {
                try {
                    // Aqui permitimos campos específicos se soubermos que serão redigidos no feed, 
                    // mas o comm_exports deve estar limpo preferencialmente.
                    assertNoPII(b.payload);
                } catch { bullFailures++; }
            });
        }
        auditResults.push({
            rule_key: 'no_pii_in_bulletins',
            status: bullFailures === 0 ? 'pass' : 'fail',
            matches_count: bullFailures
        });
        if (bullFailures > 0) overallStatus = 'fail';

        // 3. A54 Open Data API Audit
        const { data: openFeeds } = await admin.from("eco_open_data_feeds").select("public_token, dataset");
        let openDataFailures = 0;
        if (openFeeds) {
            for (const feed of openFeeds) {
                // Simula uma chamada local na nossa API interna (apenas metadados para auditoria)
                // Num ambiente completo o fetch seria na url base, aqui vamos direto na fonte do dataset
                try {
                    const { data: rawFetch } = await admin.from(feed.dataset === 'impact_weekly' ? "v_impact_public_weekly" : feed.dataset === 'wins_weekly' ? 'v_collective_wins_public' : 'eco_bulletins').select("*").limit(5);
                    rawFetch?.forEach(f => {
                        // strip fake like route.ts
                        delete f.id; delete f.created_by; delete f.user_id; delete f.cell_id;
                        assertNoPII(f);
                    });
                } catch { openDataFailures++; }
            }
        }
        auditResults.push({
            rule_key: 'open_data_no_pii',
            status: openDataFailures === 0 ? 'pass' : 'fail',
            matches_count: openDataFailures
        });
        if (openDataFailures > 0) overallStatus = 'fail';

        // 4. Save Audit Run
        const { data: auditRun } = await admin.from("eco_privacy_audit_runs").insert({
            created_by: user.id,
            scope: 'global',
            result_status: overallStatus,
            results: { details: auditResults }
        }).select().single();

        return NextResponse.json({
            success: true,
            status: overallStatus,
            run_id: auditRun?.id,
            details: auditResults
        });

    } catch (err: any) {
        console.error("Audit Engine Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
