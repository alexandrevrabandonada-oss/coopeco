import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind"); // operator_badge | operator_checklist | drop_point_checklist | pilot_day_script
  const format = searchParams.get("format") || "a4"; // a4 | sticker | card
  const neighborhood_slug = searchParams.get("neighborhood_slug");
  const drop_point_id = searchParams.get("drop_point_id");
  const neighborhood_id = searchParams.get("neighborhood_id");

  if (!kind) {
    return new Response("Missing kind parameter", { status: 400 });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Server config error", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Common data
  let neighborhoodName = "COOP ECO";
  if (neighborhood_slug) {
    const { data: n } = await supabase.from("neighborhoods").select("name").eq("slug", neighborhood_slug).single();
    if (n) neighborhoodName = n.name;
  }

  const width = format === "a4" ? 2480 : format === "card" ? 1011 : 1080; // 8.5cm x 5.4cm approx for card at 300dpi
  const height = format === "a4" ? 3508 : format === "card" ? 638 : 1080;

  let content = "";

  if (kind === "operator_badge") {
    content = `
      <rect width="100%" height="100%" fill="white" stroke="black" stroke-width="10"/>
      <rect x="0" y="0" width="100%" height="120" fill="#fbbf24" />
      <text x="50%" y="80" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="60" fill="black">OPERADOR ECO</text>
      
      <text x="50%" y="250" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="80" fill="black">${neighborhoodName.toUpperCase()}</text>
      
      <line x1="100" y1="350" x2="${width - 100}" y2="350" stroke="black" stroke-width="2" />
      
      <text x="50%" y="450" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="40" fill="black">RECIBO É LEI</text>
      
      <rect x="0" y="${height - 60}" width="100%" height="60" fill="black" />
      <text x="50%" y="${height - 20}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="20" fill="#fbbf24">COOP ECO - OPERAÇÃO TRANSPARENTE</text>
    `;
  } else if (kind === "operator_checklist") {
    content = `
      <rect width="100%" height="100%" fill="white" />
      <rect x="80" y="80" width="${width - 160}" height="${height - 160}" fill="none" stroke="black" stroke-width="10" />
      
      <rect x="80" y="80" width="${width - 160}" height="300" fill="#fbbf24" />
      <text x="160" y="280" font-family="Inter, sans-serif" font-weight="900" font-size="120" fill="black">RITUAL DO DIA</text>
      
      <text x="160" y="500" font-family="Inter, sans-serif" font-weight="900" font-size="60" fill="black">5 PASSOS ESSENCIAIS:</text>
      
      <g transform="translate(160, 700)">
        <rect width="80" height="80" fill="none" stroke="black" stroke-width="5" />
        <text x="120" y="60" font-family="Inter, sans-serif" font-weight="700" font-size="50" fill="black">1. Gerar pedidos recorrentes (Admin)</text>
      </g>
      
      <g transform="translate(160, 900)">
        <rect width="80" height="80" fill="none" stroke="black" stroke-width="5" />
        <text x="120" y="60" font-family="Inter, sans-serif" font-weight="700" font-size="50" fill="black">2. Conferir janelas e lotação (A15.1)</text>
      </g>
      
      <g transform="translate(160, 1100)">
        <rect width="80" height="80" fill="none" stroke="black" stroke-width="5" />
        <text x="120" y="60" font-family="Inter, sans-serif" font-weight="700" font-size="50" fill="black">3. Operar fila de recebimento</text>
      </g>
      
      <g transform="translate(160, 1300)">
        <rect width="80" height="80" fill="none" stroke="black" stroke-width="5" />
        <text x="120" y="60" font-family="Inter, sans-serif" font-weight="700" font-size="50" fill="black">4. Fechar lote e registrar pesagem</text>
      </g>
      
      <g transform="translate(160, 1500)">
        <rect width="80" height="80" fill="none" stroke="black" stroke-width="5" />
        <text x="120" y="60" font-family="Inter, sans-serif" font-weight="700" font-size="50" fill="black">5. Publicar boletim e cards (A19)</text>
      </g>
      
      <text x="160" y="1800" font-family="Inter, sans-serif" font-weight="900" font-size="40" fill="black">ANOTAÇÕES:</text>
      <rect x="160" y="1850" width="${width - 320}" height="1000" fill="none" stroke="black" stroke-width="2" stroke-dasharray="20,20" />
      
      <text x="50%" y="${height - 150}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="40" fill="black">RECIBO É LEI. CUIDADO É COLETIVO. TRABALHO DIGNO NO CENTRO.</text>
    `;
  } else if (kind === "drop_point_checklist") {
    let pointName = "PONTO ECO";
    if (drop_point_id) {
      const { data: p } = await supabase.from("eco_drop_points").select("name").eq("id", drop_point_id).single();
      if (p) pointName = p.name;
    }

    content = `
      <rect width="100%" height="100%" fill="white" />
      <rect x="80" y="80" width="${width - 160}" height="${height - 160}" fill="none" stroke="black" stroke-width="10" />
      
      <rect x="80" y="80" width="${width - 160}" height="300" fill="#fbbf24" />
      <text x="160" y="280" font-family="Inter, sans-serif" font-weight="900" font-size="100" fill="black">CHECKLIST MANUTENÇÃO</text>
      
      <text x="160" y="500" font-family="Inter, sans-serif" font-weight="900" font-size="80" fill="black">${pointName.toUpperCase()}</text>
      
      <g transform="translate(160, 700)">
        <rect width="80" height="80" fill="none" stroke="black" stroke-width="5" />
        <text x="120" y="60" font-family="Inter, sans-serif" font-weight="700" font-size="50" fill="black">Saco/Caixa disponível</text>
      </g>
      
      <g transform="translate(160, 900)">
        <rect width="80" height="80" fill="none" stroke="black" stroke-width="5" />
        <text x="120" y="60" font-family="Inter, sans-serif" font-weight="700" font-size="50" fill="black">Placa visível e limpa</text>
      </g>
      
      <g transform="translate(160, 1100)">
        <rect width="80" height="80" fill="none" stroke="black" stroke-width="5" />
        <text x="120" y="60" font-family="Inter, sans-serif" font-weight="700" font-size="50" fill="black">Área de entrega organizada</text>
      </g>
      
      <g transform="translate(160, 1300)">
        <rect width="80" height="80" fill="none" stroke="black" stroke-width="5" />
        <text x="120" y="60" font-family="Inter, sans-serif" font-weight="700" font-size="50" fill="black">Óleo coletado/Vidros seguros</text>
      </g>
      
      <rect x="160" y="1600" width="${width - 320}" height="400" fill="#f3f4f6" stroke="black" stroke-width="2" />
      <text x="200" y="1700" font-family="Inter, sans-serif" font-weight="900" font-size="50" fill="black">ENERGIA COLETIVA (A15.4)</text>
      <text x="200" y="1800" font-family="Inter, sans-serif" font-weight="700" font-size="35" fill="black">Se o ponto estiver 'parado' ou 'inativo',</text>
      <text x="200" y="1860" font-family="Inter, sans-serif" font-weight="700" font-size="35" fill="black">notificar a vizinhança via card (A19).</text>
      
      <text x="50%" y="${height - 150}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="40" fill="black">OPERAÇÃO TRANSPARENTE • COOP ECO</text>
    `;
  } else if (kind === "pilot_day_script") {
    content = `
      <rect width="100%" height="100%" fill="white" />
      <rect x="80" y="80" width="${width - 160}" height="${height - 160}" fill="none" stroke="black" stroke-width="10" />
      
      <rect x="80" y="80" width="${width - 160}" height="300" fill="#fbbf24" />
      <text x="160" y="280" font-family="Inter, sans-serif" font-weight="900" font-size="100" fill="black">ROTEIRO OPERACIONAL</text>
      
      <text x="160" y="500" font-family="Inter, sans-serif" font-weight="900" font-size="80" fill="black">${neighborhoodName.toUpperCase()}</text>
      
      <text x="160" y="650" font-family="Inter, sans-serif" font-weight="700" font-size="40" fill="black" width="${width - 320}">
        Operar o bairro piloto exige foco em RECIBO. Todo material deve gerar um código 
        imediato no app. Se o cooperado não tiver conexão, use o modo OFFLINE.
      </text>
      
      <text x="160" y="850" font-family="Inter, sans-serif" font-weight="900" font-size="50" fill="black">METAS DA JANELA:</text>
      <text x="160" y="930" font-family="Inter, sans-serif" font-weight="700" font-size="40" fill="black">• 100% de recibos emitidos</text>
      <text x="160" y="990" font-family="Inter, sans-serif" font-weight="700" font-size="40" fill="black">• Zero contaminação no lote</text>
      <text x="160" y="1050" font-family="Inter, sans-serif" font-weight="700" font-size="40" fill="black">• Foto nítida do material</text>
      
      <rect x="160" y="1200" width="${width - 320}" height="400" fill="#000" />
      <text x="200" y="1300" font-family="Inter, sans-serif" font-weight="900" font-size="50" fill="#fbbf24">RECIBO É LEI</text>
      <text x="200" y="1400" font-family="Inter, sans-serif" font-weight="700" font-size="35" fill="white">Sem recibo, não há transparência.</text>
      <text x="200" y="1460" font-family="Inter, sans-serif" font-weight="700" font-size="35" fill="white">O cooperado é o guardião do dado.</text>
    `;
  } else if (kind === "runbook_a4") {
    const { data: cards } = await supabase.from("eco_playbook_cards").select("*").limit(5);
    let yOffset = 600;
    const cardSections = (cards || []).map(card => {
      const section = `
          <g transform="translate(160, ${yOffset})">
            <rect width="${width - 320}" height="350" fill="none" stroke="black" stroke-width="2" />
            <rect width="100" height="40" fill="black" />
            <text x="10" y="28" font-family="Inter, sans-serif" font-weight="900" font-size="24" fill="white">${card.kind.toUpperCase()}</text>
            <text x="120" y="30" font-family="Inter, sans-serif" font-weight="900" font-size="32" fill="black">${card.title.toUpperCase()}</text>
            <text x="20" y="100" font-family="Inter, sans-serif" font-weight="900" font-size="20" fill="black">DIAGNÓSTICO:</text>
            <text x="180" y="100" font-family="Inter, sans-serif" font-weight="700" font-size="18" fill="black">${card.diagnosis_steps}</text>
            <text x="20" y="180" font-family="Inter, sans-serif" font-weight="900" font-size="20" fill="#ef4444">AÇÃO IMEDIATA:</text>
            <text x="180" y="180" font-family="Inter, sans-serif" font-weight="900" font-size="18" fill="#ef4444">${card.immediate_actions[0]}</text>
            <text x="20" y="260" font-family="Inter, sans-serif" font-weight="900" font-size="20" fill="black">PRÓXIMAS 24H:</text>
            <text x="180" y="260" font-family="Inter, sans-serif" font-weight="700" font-size="18" fill="black">${card.actions_24h[0]}</text>
          </g>
        `;
      yOffset += 400;
      return section;
    }).join("");

    content = `
      <rect width="100%" height="100%" fill="white" />
      <rect x="80" y="80" width="${width - 160}" height="${height - 160}" fill="none" stroke="black" stroke-width="10" />
      <rect x="80" y="80" width="${width - 160}" height="300" fill="#ef4444" />
      <text x="160" y="280" font-family="Inter, sans-serif" font-weight="900" font-size="120" fill="white">RUNBOOK DE RUA</text>
      <text x="160" y="500" font-family="Inter, sans-serif" font-weight="900" font-size="60" fill="black">O QUE FAZER QUANDO O ALERTA TOCAR:</text>
      ${cardSections}
      <text x="50%" y="${height - 150}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="30" fill="black">RESILIÊNCIA COLETIVA • PROTOCOLO DE CUIDADO • COOP ECO</text>
    `;
  } else if (kind === "runbook_card") {
    const cardKind = searchParams.get("card_kind") || "capacity_critical";
    const { data: card } = await supabase.from("eco_playbook_cards").select("*").eq("kind", cardKind).single();

    if (card) {
      content = `
        <rect width="100%" height="100%" fill="white" stroke="black" stroke-width="10"/>
        <rect x="0" y="0" width="100%" height="150" fill="#ef4444" />
        <text x="50%" y="100" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="80" fill="white">ALERTA: ${card.kind.toUpperCase().replace('_', ' ')}</text>
        
        <g transform="translate(50, 250)">
          <text y="0" font-family="Inter, sans-serif" font-weight="900" font-size="40" fill="black">AÇÃO IMEDIATA:</text>
          <text y="70" font-family="Inter, sans-serif" font-weight="900" font-size="50" fill="#ef4444">${card.immediate_actions[0].toUpperCase()}</text>
          
          <text y="200" font-family="Inter, sans-serif" font-weight="900" font-size="35" fill="black">DIAGNÓSTICO RÁPIDO:</text>
          <text y="260" font-family="Inter, sans-serif" font-weight="700" font-size="30" fill="black">${card.diagnosis_steps}</text>
          
          <text y="400" font-family="Inter, sans-serif" font-weight="900" font-size="30" fill="black">COMUNICAR:</text>
          <text y="460" font-family="Inter, sans-serif" font-weight="700" font-size="28" fill="black">${card.comms_template_key}</text>
        </g>
        
        <rect x="0" y="${height - 60}" width="100%" height="60" fill="black" />
        <text x="50%" y="${height - 20}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="20" fill="white">RUNBOOK CARD - ${neighborhoodName.toUpperCase()}</text>
      `;
    }
  } else if (kind === "learning_focus_week") {
    const { data: focus } = await supabase
      .from("eco_neighborhood_learning_focus")
      .select("*")
      .eq("neighborhood_id", neighborhood_id)
      .maybeSingle();

    let firstTip: any = null;
    if (focus?.focus_tip_ids && focus.focus_tip_ids.length > 0) {
      const { data: tips } = await supabase.from("edu_tips").select("*").in("id", focus.focus_tip_ids).limit(1);
      if (tips?.[0]) firstTip = tips[0];
    }

    const title = focus?.focus_flag === 'food' ? 'SEPARAÇÃO: COMIDA' :
      focus?.focus_flag === 'liquids' ? 'SEPARAÇÃO: LÍQUIDOS' :
        'QUALIDADE ECO';

    content = `
      <rect width="100%" height="100%" fill="white" stroke="black" stroke-width="10"/>
      <rect x="0" y="0" width="100%" height="150" fill="#fbbf24" />
      <text x="50%" y="100" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="70" fill="black">${title}</text>
      
      <g transform="translate(50, 250)">
        <text y="0" font-family="Inter, sans-serif" font-weight="900" font-size="40" fill="black">FOCO DA SEMANA:</text>
        <text y="70" font-family="Inter, sans-serif" font-weight="900" font-size="50" fill="black">${firstTip?.title?.toUpperCase() || 'MELHORAR QUALIDADE'}</text>
        
        <text y="200" font-family="Inter, sans-serif" font-weight="700" font-size="28" fill="black" width="${width - 100}">
          ${firstTip?.body || 'Aprenda a separar do jeito certo para proteger o trabalho local.'}
        </text>
        
        <text y="450" font-family="Inter, sans-serif" font-weight="900" font-size="30" fill="black">META DO BAIRRO:</text>
        <text y="510" font-family="Inter, sans-serif" font-weight="900" font-size="40" fill="#16a34a">${focus?.goal_ok_rate || 80}% DE QUALIDADE</text>
      </g>
      
      <rect x="0" y="${height - 60}" width="100%" height="60" fill="black" />
      <text x="50%" y="${height - 20}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="20" fill="#fbbf24">COOP ECO - EDUCAÇÃO ADAPTATIVA - ${neighborhoodName.toUpperCase()}</text>
    `;
  }

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
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
