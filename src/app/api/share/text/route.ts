import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeCopy, autofixCopy } from "@/lib/copy/lint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const neighborhood_slug = searchParams.get("neighborhood_slug");

  if (!kind || !neighborhood_slug) {
    return NextResponse.json({ error: "Missing kind or neighborhood_slug" }, { status: 400 });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Server env is missing Supabase configuration." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // 1. Get neighborhood
  const { data: neighborhood, error: nError } = await supabase
    .from("neighborhoods")
    .select("id, name")
    .eq("slug", neighborhood_slug)
    .single();

  if (nError || !neighborhood) {
    return NextResponse.json({ error: "Neighborhood not found" }, { status: 404 });
  }

  // Map incoming kind to template kind
  const templateKind = kind.endsWith("_text") ? kind : `${kind}_text`;

  const { data: template, error: tError } = await supabase
    .from("v_effective_comms_template")
    .select("*")
    .eq("neighborhood_id", neighborhood.id)
    .eq("kind", templateKind)
    .maybeSingle();

  if (tError || !template) {
    return NextResponse.json({ error: "No effective template found for this kind/neighborhood" }, { status: 404 });
  }

  let body = template.body_md || "";
  let payload: any = {
    NEIGHBORHOOD_NAME: neighborhood.name,
    CTA_URL: `https://eco.org/n/${neighborhood_slug}`
  };

  // 2. Fetch specialized data
  if (kind === "next_window") {
    const { data: window } = await supabase
      .from("v_window_load_7d")
      .select("*")
      .eq("neighborhood_id", neighborhood.id)
      .order("scheduled_date", { ascending: true })
      .limit(1)
      .single();

    if (window) {
      const date = new Date(window.scheduled_date).toLocaleDateString("pt-BR");
      const windowLabel = `${window.start_time.slice(0, 5)}-${window.end_time.slice(0, 5)}`;
      payload.NEXT_WINDOW_TIME = `${date} (${windowLabel})`;
    }
  } else if (kind === "recommended_point") {
    const { data: points } = await supabase
      .from("v_drop_point_load_7d")
      .select("*")
      .eq("neighborhood_id", neighborhood.id)
      .order("requests_total", { ascending: true });

    const point = points?.[0];
    if (point) {
      payload.DROP_POINT_NAME = point.name;
    }
  } else if (kind === "weekly_bulletin" || kind === "campaign_day_6_transparency" || kind === "collective_wins_week") {
    // A51 Metrics / A53 Collective Wins Injection
    const { data: rollup } = await supabase
      .from("eco_impact_rollups_weekly")
      .select("metrics")
      .eq("neighborhood_id", neighborhood.id)
      .order("week_start", { ascending: false })
      .limit(1)
      .single();

    if (rollup?.metrics) {
      payload.RECEIPTS_COUNT = rollup.metrics.receipts_count || 0;
      payload.OK_RATE = `${rollup.metrics.ok_rate || 0}%`;
      payload.TASKS_DONE = rollup.metrics.tasks_done_count || 0;
      payload.ANCHORS_ACTIVE = rollup.metrics.partners_anchor_active_count || 0;

      const topFlags = rollup.metrics.top_flags || [];
      payload.TOP_FLAGS = topFlags.length > 0
        ? topFlags.slice(0, 3).map((f: any) => f.flag || f).join(', ')
        : "Nenhuma";
    } else {
      payload.RECEIPTS_COUNT = "0";
      payload.OK_RATE = "0%";
      payload.TASKS_DONE = "0";
      payload.ANCHORS_ACTIVE = "0";
      payload.TOP_FLAGS = "Nenhuma";
    }

    // A55 Points Injection
    const { data: pts } = await supabase
      .from("v_collective_points_balance")
      .select("points_balance")
      .eq("neighborhood_id", neighborhood.id)
      .eq("scope", "neighborhood")
      .single();

    payload.POINTS_BALANCE = pts?.points_balance || 0;
  } else if (kind === "top_flags") {
    const { data: summary } = await supabase
      .from("v_neighborhood_ops_summary_7d")
      .select("*")
      .eq("neighborhood_id", neighborhood.id)
      .single();

    if (summary) {
      payload.TOP_FLAGS = (summary.top_flags || []).join(", ") || "nenhuma detectada";
    }
  } else if (kind === "missions") {
    const { data: missions } = await supabase
      .from("community_missions")
      .select("*, mission_progress(progress_count, goal_count)")
      .eq("neighborhood_id", neighborhood.id)
      .eq("active", true)
      .limit(1);

    const mission = missions?.[0];
    if (mission) {
      const progress = mission.mission_progress?.[0];
      payload.MISSION_PROGRESS = `${progress?.progress_count || 0}/${progress?.goal_count || 10}`;
    }
  }

  // 3. Simple interpolate
  Object.keys(payload).forEach(key => {
    body = body.replace(new RegExp(`{{${key}}}`, "g"), payload[key]);
  });

  // A43: Copy Anti-Culpa Normalize & Autofix
  body = normalizeCopy(body);
  const { text: fixedBody } = await autofixCopy(body);
  body = fixedBody;

  return NextResponse.json({
    title: template.title,
    body: body,
    cta: "Saiba mais no App ECO",
    footer: "COOP ECO - Operação Transparente",
    payload_json: payload
  });
}
