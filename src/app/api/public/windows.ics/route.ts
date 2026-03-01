import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { redactPIIPatterns } from "@/lib/privacy/sanitize";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("neighborhood_slug");
    const token = searchParams.get("token");

    if (!slug || !token) {
        return new NextResponse(null, { status: 404 });
    }

    const supabase = createClient();

    // 1. Validate Token & Neighborhood
    const { data: neighbor } = await supabase
        .from("neighborhoods")
        .select("id, name, slug")
        .eq("slug", slug)
        .single();

    if (!neighbor) return new NextResponse(null, { status: 404 });

    const { data: feed } = await supabase
        .from("eco_public_feeds")
        .select("id")
        .eq("neighborhood_id", neighbor.id)
        .eq("feed_kind", "windows_ics")
        .eq("public_token", token)
        .eq("is_enabled", true)
        .maybeSingle();

    if (!feed) return new NextResponse(null, { status: 404 });

    // 2. Fetch Windows (Route Windows)
    // Assuming route_windows table exists and has day_of_week, start_time, end_time
    const { data: windows } = await supabase
        .from("route_windows")
        .select("*")
        .eq("neighborhood_id", neighbor.id)
        .eq("active", true);

    // 3. Generate ICS
    const domain = req.headers.get("host") || "coopeco.com.br";
    let ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//COOP ECO//Neighborhood Windows//PT-BR",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH"
    ];

    const dayMap: Record<string, string> = {
        '0': 'SU', '1': 'MO', '2': 'TU', '3': 'WE', '4': 'TH', '5': 'FR', '6': 'SA'
    };

    if (windows) {
        windows.forEach((w: any) => {
            const startStr = w.start_time.replace(/:/g, '') + '00';
            const endStr = w.end_time.replace(/:/g, '') + '00';
            const rrule = `RRULE:FREQ=WEEKLY;BYDAY=${dayMap[w.day_of_week?.toString() || '0']}`;

            ics.push("BEGIN:VEVENT");
            ics.push(`UID:window-${w.id}@${domain}`);
            ics.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
            ics.push(redactPIIPatterns(`SUMMARY:Janela ECO — ${neighbor.name}`));
            ics.push(redactPIIPatterns(`DESCRIPTION:Entrega em Ponto ou Coleta Programada. Mais informações: https://${domain}/bairros/${neighbor.slug}/transparencia`));
            ics.push(`DTSTART;TZID=America/Sao_Paulo:20260101T${startStr}`);
            ics.push(`DTEND;TZID=America/Sao_Paulo:20260101T${endStr}`);
            ics.push(rrule);
            ics.push("END:VEVENT");
        });
    }

    ics.push("END:VCALENDAR");

    return new NextResponse(ics.join("\r\n"), {
        headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": `attachment; filename="eco-${slug}.ics"`,
            "Cache-Control": "public, max-age=3600"
        }
    });
}
