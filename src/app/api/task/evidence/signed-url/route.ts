import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const evidence_id = searchParams.get("evidence_id");

    if (!evidence_id) {
        return NextResponse.json({ error: "Missing evidence_id" }, { status: 400 });
    }

    // Verificar auth do chamador
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
        return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl!, serviceRoleKey!);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Buscar evidência para validar acesso
    const { data: evidence, error: evError } = await supabase
        .from("eco_task_evidence")
        .select("*, task:eco_common_tasks(assignee_id, cell_id)")
        .eq("id", evidence_id)
        .single();

    if (evError || !evidence) {
        return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }

    // Regra A52 Zero PII: Só o assignee ou os operadores da célula podem ver
    let canView = evidence.task.assignee_id === user.id;

    if (!canView) {
        // Verificar se é cell operator
        const { data: mandate } = await supabase
            .from("eco_mandates")
            .select("id")
            .eq("user_id", user.id)
            .eq("cell_id", evidence.task.cell_id)
            .eq("status", "active")
            .maybeSingle();

        if (mandate) canView = true;
    }

    // Ou admin genérico (fallback)
    if (!canView) {
        if (user.user_metadata?.is_admin === "true") canView = true;
    }

    if (!canView) {
        return NextResponse.json({ error: "Unauthorized access to evidence" }, { status: 403 });
    }

    if (evidence.kind === 'link') {
        return NextResponse.json({ url: evidence.external_url, expires_at: null });
    }

    // Gerar signed URL restrita (10 minutos)
    const { data, error } = await supabase.storage
        .from("eco-evidence")
        .createSignedUrl(evidence.storage_path, 600);

    if (error || !data) {
        return NextResponse.json({ error: "Failed to generate safe url" }, { status: 500 });
    }

    return NextResponse.json({
        url: data.signedUrl,
        expires_at: new Date(Date.now() + 600 * 1000).toISOString()
    });
}
