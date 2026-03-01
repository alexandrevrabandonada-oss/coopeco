import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");
    const format = searchParams.get("format") || "3x4"; // 3x4 or 1x1
    const neighborhood_slug = searchParams.get("neighborhood_slug");

    if (!kind || !neighborhood_slug) {
        return new Response("Missing parameters", { status: 400 });
    }

    if (!supabaseUrl || !serviceRoleKey) {
        return new Response("Server config error", { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch data (reuse logic or call internal route if possible, but for simplicity we fetch here)
    const { data: neighborhood } = await supabase
        .from("neighborhoods")
        .select("id, name")
        .eq("slug", neighborhood_slug)
        .single();

    if (!neighborhood) {
        return new Response("Neighborhood not found", { status: 404 });
    }

    // Fetch specific data based on kind
    let title = "INFORME OPERACIONAL";
    let subtitle = neighborhood.name;
    let mainValue = "--";
    let label = "Métrica";
    let highlightColor = "#fbbf24"; // High-impact Yellow

    if (kind === "next_window") {
        const { data } = await supabase
            .from("v_window_load_7d")
            .select("*")
            .eq("neighborhood_id", neighborhood.id)
            .order("scheduled_date", { ascending: true })
            .limit(1)
            .single();
        title = "PRÓXIMA COLETA";
        if (data) {
            const date = new Date(data.scheduled_date).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' });
            mainValue = date;
            label = `${data.start_time.slice(0, 5)} - ${data.end_time.slice(0, 5)}`;
        }
    } else if (kind === "weekly_bulletin") {
        const { data } = await supabase
            .from("v_neighborhood_weekly_snapshot")
            .select("*")
            .eq("neighborhood_id", neighborhood.id)
            .single();
        title = "BALANÇO SEMANAL";
        if (data) {
            mainValue = `${data.receipts_count_week}`;
            label = `Coletas / ${data.ok_rate_week}% OK`;
            highlightColor = data.ok_rate_week >= 80 ? "#fbbf24" : "#991b1b";
        }
    } else if (kind === "top_flags") {
        const { data } = await supabase
            .from("v_neighborhood_ops_summary_7d")
            .select("*")
            .eq("neighborhood_id", neighborhood.id)
            .single();
        title = "FOCO DA SEMANA";
        if (data && data.top_flags?.length) {
            mainValue = data.top_flags[0];
            label = "Evitar contaminação";
            highlightColor = "#991b1b"; // Rust Red
        }
    } else if (kind === "recommended_point") {
        const { data } = await supabase
            .from("v_drop_point_load_7d")
            .select("*")
            .eq("neighborhood_id", neighborhood.id)
            .order("requests_total", { ascending: true })
            .limit(1)
            .single();
        title = "PONTO RECOMENDADO";
        if (data) {
            mainValue = data.name.toUpperCase().slice(0, 15);
            label = "Energia Coletiva";
        }
    }

    // Generate SVG
    const width = format === "3x4" ? 1200 : 1080;
    const height = format === "3x4" ? 1600 : 1080;

    const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background Concrete -->
  <rect width="100%" height="100%" fill="#f2f2f2" />
  
  <!-- Brutalist Grid/Texture -->
  <path d="M0 0 L${width} 0 L${width} ${height} L0 ${height} Z" fill="none" stroke="#1a1a1a" stroke-width="12" />
  <line x1="0" y1="${height * 0.2}" x2="${width}" y2="${height * 0.2}" stroke="#1a1a1a" stroke-width="4" />
  
  <!-- Header Block -->
  <rect x="0" y="0" width="${width}" height="${height * 0.2}" fill="${highlightColor}" />
  <text x="40" y="${height * 0.12}" font-family="Inter, sans-serif" font-weight="900" font-size="${height * 0.05}" fill="#000000" style="text-transform: uppercase;">${title}</text>
  
  <!-- Main Content -->
  <text x="40" y="${height * 0.3}" font-family="Inter, sans-serif" font-weight="700" font-size="${height * 0.03}" fill="#404040" style="text-transform: uppercase;">${subtitle}</text>
  
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="${format === '3x4' ? height * 0.15 : height * 0.2}" fill="#000000">${mainValue}</text>
  
  <text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="${height * 0.04}" fill="#404040" style="text-transform: uppercase;">${label}</text>
  
  <!-- Footer -->
  <rect x="0" y="${height - 100}" width="${width}" height="100}" fill="#000000" />
  <text x="40" y="${height - 40}" font-family="Inter, sans-serif" font-weight="900" font-size="24" fill="#fbbf24">COOP ECO / OPERAÇÃO TRANSPARENTE</text>
  
  <!-- Stencil Detail -->
  <path d="M ${width - 150} ${height - 250} L ${width - 50} ${height - 250} L ${width - 50} ${height - 150} L ${width - 150} ${height - 150} Z" fill="none" stroke="#1a1a1a" stroke-width="2" />
</svg>
  `.trim();

    return new Response(svg, {
        headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
    });
}
