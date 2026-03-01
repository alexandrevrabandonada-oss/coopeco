import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: "Server env missing Supabase config." }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
    }

    const slug = request.nextUrl.searchParams.get("neighborhood_slug");
    if (!slug) {
        return NextResponse.json({ error: "Missing neighborhood_slug." }, { status: 400 });
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify operator role
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) {
        return NextResponse.json({ error: "Invalid token." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("role")
        .eq("user_id", userData.user.id)
        .single();

    if (profileError || profile?.role !== "operator") {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    // Get neighborhood_id
    const { data: neighborhood } = await admin
        .from("neighborhoods")
        .select("id")
        .eq("slug", slug)
        .single();

    if (!neighborhood) {
        return NextResponse.json({ error: "Neighborhood not found." }, { status: 404 });
    }

    const neighborhoodId = neighborhood.id;
    const now = new Date().toISOString();
    // A38: Cache Check (60s TTL for operational health)
    const { data: cached } = await admin.rpc("rpc_get_agg_cache", {
        p_cache_key: `health_summary_${slug}`,
        p_scope: 'neighborhood',
        p_neighborhood_id: neighborhoodId
    });

    if (cached) {
        return NextResponse.json(cached);
    }

    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Aggregate Data
    const [
        pilot,
        windows,
        queue,
        dropPoints,
        subscriptions,
        occurrences7d,
        receipts7d,
        lots,
        deficits,
        feedback,
        partners,
        commExports7d,
        missions,
        launchControls,
        accessGrants,
        publicFeeds,
        webhooks,
        obsEvents24h,
        openIncidents,
        privacyAudit,
        uxReadiness
    ] = await Promise.all([
        admin.from("pilot_program_neighborhoods").select("status").eq("neighborhood_id", neighborhoodId).maybeSingle(),
        admin.from("route_windows").select("id").eq("neighborhood_id", neighborhoodId).eq("active", true),
        admin.from("pickup_requests").select("id").eq("neighborhood_id", neighborhoodId).eq("status", "open"),
        admin.from("eco_drop_points").select("active").eq("neighborhood_id", neighborhoodId),
        admin.from("recurring_subscriptions").select("id").eq("neighborhood_id", neighborhoodId).eq("status", "active"),
        admin.from("recurring_occurrences").select("id").eq("subscription_id", admin.from("recurring_subscriptions").select("id").eq("neighborhood_id", neighborhoodId)).gte("created_at", last7d),
        admin.from("v_neighborhood_ops_summary_7d").select("*").eq("neighborhood_id", neighborhoodId).maybeSingle(),
        admin.from("lots").select("status").eq("neighborhood_id", neighborhoodId),
        admin.from("v_asset_restock_needed").select("*").eq("neighborhood_id", neighborhoodId),
        admin.from("eco_feedback_items").select("severity").eq("neighborhood_id", neighborhoodId).eq("status", "open"),
        admin.from("eco_partner_status").select("status"),
        admin.from("comm_exports").select("id").eq("neighborhood_id", neighborhoodId).gte("created_at", last7d),
        admin.from("community_missions").select("id").eq("neighborhood_id", neighborhoodId).eq("active", true),
        admin.from("eco_launch_controls").select("*").or(`scope.eq.global,and(scope.eq.neighborhood,neighborhood_id.eq.${neighborhoodId})`),
        admin.from("eco_access_grants").select("id").eq("neighborhood_id", neighborhoodId).eq("active", true),
        admin.from("eco_public_feeds").select("id").eq("neighborhood_id", neighborhoodId).eq("is_enabled", true),
        admin.from("eco_webhook_endpoints").select("id").eq("cell_id", admin.from("eco_cell_neighborhoods").select("cell_id").eq("neighborhood_id", neighborhoodId)).eq("enabled", true),
        admin.from("eco_obs_events").select("severity").eq("neighborhood_id", neighborhoodId).gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        admin.from("eco_incidents").select("id, kind, severity, status").eq("neighborhood_id", neighborhoodId).neq("status", "resolved"),
        admin.from("eco_privacy_audit_runs").select("result_status, results").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        admin.from("eco_ux_readiness_items").select("*").eq("cell_id", admin.from("eco_cell_neighborhoods").select("cell_id").eq("neighborhood_id", neighborhoodId))
    ]);

    const activeLaunch = (launchControls.data || []).find((l: any) => l.scope === 'neighborhood' || l.scope === 'global');
    const grantsCount = accessGrants.data?.length || 0;

    const activeDropPoints = dropPoints.data?.filter(d => d.active).length || 0;
    const inactiveDropPoints = dropPoints.data?.filter(d => !d.active).length || 0;

    const partnerCounts = (partners.data || []).reduce((acc: any, p: any) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
    }, {});

    const summary = {
        pilot_active: pilot.data?.status === 'active',
        next_windows_count: windows.data?.length || 0,
        queue_next_window: queue.data?.length || 0,
        drop_points_active_count: activeDropPoints,
        drop_points_inactive_count: inactiveDropPoints,
        recurring_subscriptions_active: subscriptions.data?.length || 0,
        recurring_occurrences_last7d: occurrences7d.data?.length || 0,
        receipts_last7d: receipts7d.data?.total_receipts || 0,
        ok_rate_last7d: receipts7d.data?.ok_rate || 0,
        lots_open_count: lots.data?.filter(l => l.status === 'open').length || 0,
        lots_closed_last7d: lots.data?.filter(l => l.status === 'closed').length || 0, // Simplified
        assets_restock_deficits_count: deficits.data?.length || 0,
        feedback_blockers_open: feedback.data?.filter((f: any) => f.severity === 'blocker').length || 0,
        partner_status_counts: partnerCounts,
        comm_exports_last7d: commExports7d.data?.length || 0,
        missions_active_count: missions.data?.length || 0,
        launch_is_open: activeLaunch?.is_open || false,
        launch_open_mode: activeLaunch?.open_mode || 'invite_only',
        launch_grants_count: grantsCount,
        active_feeds_count: publicFeeds.data?.length || 0,
        active_webhooks_count: webhooks.data?.length || 0,
        obs_critical_24h: obsEvents24h.data?.filter(e => e.severity === 'critical').length || 0,
        obs_error_24h: obsEvents24h.data?.filter(e => e.severity === 'error').length || 0,
        open_incidents: openIncidents.data || [],
        privacy_audit: privacyAudit.data || null,
        ux_readiness_items: uxReadiness.data || [],
        timestamp: now
    };

    // A38: Store Cache
    await admin.rpc("rpc_set_agg_cache", {
        p_cache_key: `health_summary_${slug}`,
        p_scope: 'neighborhood',
        p_payload: summary,
        p_ttl_seconds: 60,
        p_neighborhood_id: neighborhoodId
    });

    return NextResponse.json(summary);
}
