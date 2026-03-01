import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind"); // drop_point | neighborhood
    const id = searchParams.get("id"); // drop_point_id or neighborhood_slug
    const format = searchParams.get("format") || "a4"; // a4 | sticker

    if (!kind || !id) {
        return new Response("Missing parameters", { status: 400 });
    }

    if (!supabaseUrl || !serviceRoleKey) {
        return new Response("Server config error", { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let title = "PONTO ECO";
    let subtitle = "";
    let address = "";
    let hours = "";
    let materials: string[] = [];
    let neighborhoodId = "";
    let neighborhoodName = "";
    let code = "CODE";

    // 1. Fetch Data
    if (kind === "drop_point") {
        const { data: point } = await supabase
            .from("eco_drop_points")
            .select("*, neighborhood:neighborhoods(id, name)")
            .eq("id", id)
            .single();

        if (!point) return new Response("Drop point not found", { status: 404 });

        title = "PONTO ECO";
        subtitle = point.name.toUpperCase();
        address = point.address_public;
        hours = point.hours;
        materials = point.accepted_materials || [];
        neighborhoodId = point.neighborhood_id;
        neighborhoodName = point.neighborhood?.name || "";

        // Get or create invite code
        let { data: inv } = await supabase
            .from("invite_codes")
            .select("code")
            .eq("drop_point_id", id)
            .eq("active", true)
            .limit(1)
            .maybeSingle();

        if (!inv) {
            const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const { data: created } = await supabase
                .from("invite_codes")
                .insert({
                    code: newCode,
                    scope: 'drop_point',
                    neighborhood_id: neighborhoodId,
                    drop_point_id: id,
                    active: true
                })
                .select()
                .single();
            code = created?.code || newCode;
        } else {
            code = inv.code;
        }
    } else {
        const { data: neighborhood } = await supabase
            .from("neighborhoods")
            .select("*")
            .eq("slug", id)
            .single();

        if (!neighborhood) return new Response("Neighborhood not found", { status: 404 });

        title = "BAIRRO ECO";
        subtitle = neighborhood.name.toUpperCase();
        neighborhoodId = neighborhood.id;
        neighborhoodName = neighborhood.name;

        let { data: inv } = await supabase
            .from("invite_codes")
            .select("code")
            .eq("neighborhood_id", neighborhoodId)
            .eq("scope", "neighborhood")
            .eq("active", true)
            .limit(1)
            .maybeSingle();

        if (!inv) {
            const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const { data: created } = await supabase
                .from("invite_codes")
                .insert({
                    code: newCode,
                    scope: 'neighborhood',
                    neighborhood_id: neighborhoodId,
                    active: true
                })
                .select()
                .single();
            code = created?.code || newCode;
        } else {
            code = inv.code;
        }
    }

    // Fetch next window
    let nextWindowStr = "";
    const { data: window } = await supabase
        .from("v_window_load_7d")
        .select("*")
        .eq("neighborhood_id", neighborhoodId)
        .order("scheduled_date", { ascending: true })
        .limit(1)
        .single();

    if (window) {
        const date = new Date(window.scheduled_date).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' });
        nextWindowStr = `PRÓXIMA JANELA: ${date} (${window.start_time.slice(0, 5)}-${window.end_time.slice(0, 5)})`;
    }

    const qrUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://coopeco.app'}/i/${code}`;
    const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`;

    // A44: Fetch Effective Templates for Signage
    const { data: inviteTpl } = await supabase
        .from("v_effective_comms_template")
        .select("*")
        .eq("neighborhood_id", neighborhoodId)
        .eq("kind", "invite_text")
        .maybeSingle();

    const { data: noticeTpl } = await supabase
        .from("v_effective_comms_template")
        .select("*")
        .eq("neighborhood_id", neighborhoodId)
        .eq("kind", "runbook_notice_text")
        .maybeSingle();

    const inviteMsg = inviteTpl?.title || "ESCANEIE PARA RECEBER SEU RECIBO";
    const footerMsg = noticeTpl?.title || "RECIBO É LEI. CUIDADO É COLETIVO. TRABALHO DIGNO NO CENTRO.";

    // 2. Generate SVG
    const width = format === "a4" ? 2480 : 1080;
    const height = format === "a4" ? 3508 : 1080;

    let content = "";
    if (format === "a4") {
        content = `
      <rect width="100%" height="100%" fill="white" />
      <rect x="80" y="80" width="${width - 160}" height="${height - 160}" fill="none" stroke="black" stroke-width="20" />
      
      <!-- Header -->
      <rect x="80" y="80" width="${width - 160}" height="400" fill="#fbbf24" />
      <text x="160" y="340" font-family="Inter, sans-serif" font-weight="900" font-size="160" fill="black">${title}</text>
      
      <!-- Body -->
      <text x="160" y="650" font-family="Inter, sans-serif" font-weight="900" font-size="120" fill="black">${subtitle}</text>
      <text x="160" y="750" font-family="Inter, sans-serif" font-weight="700" font-size="60" fill="#666">${address}</text>
      
      <line x1="160" y1="850" x2="${width - 160}" y2="850" stroke="black" stroke-width="4" />
      
      <!-- Info Sections -->
      <text x="160" y="980" font-family="Inter, sans-serif" font-weight="900" font-size="50" fill="black">MATERIAIS ACEITOS:</text>
      <text x="160" y="1080" font-family="Inter, sans-serif" font-weight="700" font-size="70" fill="black">${materials.join(" • ").toUpperCase() || "RECICLÁVEIS SECOS"}</text>
      
      <text x="160" y="1250" font-family="Inter, sans-serif" font-weight="900" font-size="50" fill="black">HORÁRIO:</text>
      <text x="160" y="1350" font-family="Inter, sans-serif" font-weight="700" font-size="70" fill="black">${hours || "CONSULTE O APP"}</text>
      
      <!-- QR Section -->
      <rect x="${width / 2 - 400}" y="1500" width="800" height="1100" fill="#f3f4f6" stroke="black" stroke-width="4" />
      <image href="${qrImage}" x="${width / 2 - 300}" y="1550" width="600" height="600" />
      <text x="${width / 2}" y="2250" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="100" fill="black">${code}</text>
      <text x="${width / 2}" y="2380" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="50" fill="black">${inviteMsg.toUpperCase()}</text>
      <text x="${width / 2}" y="2480" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="40" fill="#666">${qrUrl}</text>
      
      <!-- Instructions -->
      <text x="160" y="2750" font-family="Inter, sans-serif" font-weight="900" font-size="60" fill="black">COMO ENTREGAR:</text>
      <text x="160" y="2850" font-family="Inter, sans-serif" font-weight="700" font-size="45" fill="black">1) SECO E SEPARADO • 2) VIDRO SEGURO • 3) ÓLEO FECHADO</text>
      
      <rect x="160" y="2950" width="${width - 320}" height="100" fill="#000" />
      <text x="${width / 2}" y="3015" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="50" fill="#fbbf24">${nextWindowStr || "BAIRE O ECO - TRABALHO DIGNO"}</text>
      
      <!-- Footer -->
      <text x="${width / 2}" y="3250" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="40" fill="black">${footerMsg.toUpperCase()}</text>
      <text x="${width / 2}" y="3320" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="30" fill="#666">COOP ECO - OPERAÇÃO TRANSPARENTE</text>
    `;
    } else {
        // Sticker format
        content = `
      <rect width="100%" height="100%" fill="#fbbf24" />
      <rect x="40" y="40" width="${width - 80}" height="${height - 80}" fill="none" stroke="black" stroke-width="12" />
      
      <text x="50%" y="150" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="80" fill="black">BORA DE RECIBO?</text>
      
      <rect x="${width / 2 - 250}" y="220" width="500" height="500" fill="white" stroke="black" stroke-width="4" />
      <image href="${qrImage}" x="${width / 2 - 225}" y="245" width="450" height="450" />
      
      <text x="50%" y="820" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="120" fill="black">${code}</text>
      <text x="50%" y="920" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="40" fill="black">COOP ECO / ${neighborhoodName.toUpperCase()}</text>
      
      <rect x="0" y="${height - 80}" width="${width}" height="80" fill="black" />
      <text x="50%" y="${height - 30}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="30" fill="#fbbf24">${footerMsg.toUpperCase()}</text>
    `;
    }

    const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${content}
</svg>
  `.trim();

    return new Response(svg, {
        headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
    });
}
