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
        .eq("feed_kind", "bulletins_json")
        .eq("public_token", token)
        .eq("is_enabled", true)
        .maybeSingle();

    if (!feed) return new NextResponse(null, { status: 404 });

    // A38: Cache Check
    const { data: cached } = await supabase.rpc("rpc_get_agg_cache", {
        p_cache_key: `bulletins_${slug}`,
        p_scope: 'neighborhood',
        p_neighborhood_id: neighbor.id
    });

    if (cached) {
        return NextResponse.json(cached, {
            headers: { "Cache-Control": "public, max-age=300" }
        });
    }

    // Assuming bulletins table (from A9)
    const { data: bulletins } = await supabase
        .from("comm_exports") // Or whenever bulletins are stored
        .select("id, created_at, payload")
        .eq("neighborhood_id", neighbor.id)
        .order("created_at", { ascending: false })
        .limit(10);

    const formattedBulletins = (bulletins || []).map((b: any) => ({
        id: b.id,
        date: b.created_at,
        title: b.payload?.title || "Boletim Semanal",
        highlights: b.payload?.highlights || []
    }));

    // A36: Learning Focus
    const { data: focus } = await supabase
        .from("eco_neighborhood_learning_focus")
        .select("*")
        .eq("neighborhood_id", neighbor.id)
        .maybeSingle();

    let tips: any[] = [];
    if (focus?.focus_tip_ids && focus.focus_tip_ids.length > 0) {
        const { data: tData } = await supabase.from("edu_tips").select("*").in("id", focus.focus_tip_ids);
        tips = tData || [];
    }

    const response = {
        neighborhood: slug,
        bulletins: formattedBulletins,
        learning_focus: focus ? {
            flag: focus.focus_flag,
            material: focus.focus_material,
            tips: tips,
            goal_ok_rate: focus.goal_ok_rate
        } : null
    };

    // Auditoria de Privacidade (A34)
    const sanitized = stripPrivateFields(response);
    try {
        assertNoPII(sanitized, ["bulletins.*.title", "bulletins.*.highlights.*"]);
    } catch (e: any) {
        console.error("Privacy Audit Failure:", e.message);
        return new NextResponse(JSON.stringify({ error: "Privacy violation detected" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }

    // A38: Store Cache
    await supabase.rpc("rpc_set_agg_cache", {
        p_cache_key: `bulletins_${slug}`,
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
