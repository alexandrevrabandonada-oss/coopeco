import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import crypto from "crypto";

export async function POST(req: NextRequest) {
    const { webhook_id } = await req.json();

    if (!webhook_id) return new NextResponse(null, { status: 400 });

    const supabase = createClient();

    // 1. Fetch Webhook Config
    const { data: webhook } = await supabase
        .from("eco_webhook_endpoints")
        .select("*, cell:eco_cells(slug)")
        .eq("id", webhook_id)
        .single();

    if (!webhook) return new NextResponse(null, { status: 404 });

    // 2. Prepare Sample Payload (PII-free)
    const payload = {
        event_kind: "test_event",
        cell_slug: webhook.cell?.slug || "general",
        neighborhood_slug: "test-bairro",
        severity: "info",
        title: "Teste de Conexão Webhook ECO",
        body: "Este é um evento de teste gerado pelo painel administrativo.",
        entity_type: "system",
        entity_id: webhook.id,
        created_at: new Date().toISOString()
    };

    const bodyStr = JSON.stringify(payload);

    // 3. HMAC Signature
    const signature = crypto
        .createHmac("sha256", webhook.secret)
        .update(bodyStr)
        .digest("hex");

    // 4. Dispatch
    try {
        const response = await fetch(webhook.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-ECO-Signature": signature,
                "User-Agent": "ECO-Webhook-Dispatcher/1.0"
            },
            body: bodyStr
        });

        if (response.ok) {
            return NextResponse.json({ success: true, status: response.status });
        } else {
            return NextResponse.json({ success: false, status: response.status }, { status: 500 });
        }
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
