import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { stripPrivateFields, assertNoPII } from "@/lib/privacy/sanitize";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("neighborhood_slug");
    const token = searchParams.get("token");

    if (!slug || !token) {
        return new NextResponse(null, { status: 404 });
    }

    const supabase = createClient();

    const { data: neighbor } = await supabase
        .from("neighborhoods")
        .select("id, slug")
        .eq("slug", slug)
        .single();

    if (!neighbor) return new NextResponse(null, { status: 404 });

    const { data: feed } = await supabase
        .from("eco_public_feeds")
        .select("id")
        .eq("neighborhood_id", neighbor.id)
        .eq("feed_kind", "transparency_json")
        .eq("public_token", token)
        .eq("is_enabled", true)
        .maybeSingle();

    if (!feed) return new NextResponse(null, { status: 404 });

    // A38: Cache Check
    const { data: cached } = await supabase.rpc("rpc_get_agg_cache", {
        p_cache_key: `transparency_${slug}`,
        p_scope: 'neighborhood',
        p_neighborhood_id: neighbor.id
    });

    if (cached) {
        return NextResponse.json(cached, {
            headers: { "Cache-Control": "public, max-age=300" }
        });
    }

    // Assuming existing views for stats (consistent with A28/A29)
    // v_neighborhood_ops_summary_7d
    const { data: stats } = await supabase
        .from("neighborhood_ops_summaries") // Example table name based on context
        .select("*")
        .eq("neighborhood_id", neighbor.id)
        .maybeSingle();

    const response = {
        neighborhood: slug,
        snapshot_date: new Date().toISOString(),
        metrics: {
            quality_rate: stats?.quality_score || 0,
            load_usage: stats?.load_pct || 0,
            active_partners: stats?.partner_count || 0,
            weekly_missions: stats?.mission_count || 0
        }
    };

    const sanitized = stripPrivateFields(response);
    try {
        assertNoPII(sanitized);
    } catch (e: any) {
        console.error("Privacy Audit Failure (Transparency):", e.message);
        return new NextResponse(JSON.stringify({ error: "Privacy violation detected" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }

    // A38: Store Cache
    await supabase.rpc("rpc_set_agg_cache", {
        p_cache_key: `transparency_${slug}`,
        p_scope: 'neighborhood',
        p_payload: sanitized,
        p_ttl_seconds: 300,
        p_neighborhood_id: neighbor.id
    });

    return NextResponse.json(sanitized, {
        headers: {
            "Cache-Control": "public, max-age=300"
        }
    });
}
