import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const supabase = createClient(supabaseUrl!, serviceRoleKey!);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid auth" }, { status: 401 });

    try {
        const body = await request.json();
        const { evidence_id } = body;

        const { data: evidence } = await supabase
            .from("eco_task_evidence")
            .select("*, task:eco_common_tasks(assignee_id, cell_id)")
            .eq("id", evidence_id)
            .single();

        if (!evidence) return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
        if (evidence.task.assignee_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

        // Enviar para revisão
        const { data: qId, error: qError } = await supabase.rpc('rpc_request_editorial_review', {
            p_cell_id: evidence.task.cell_id,
            p_source_kind: 'task_evidence',
            p_source_id: evidence.id,
            p_lint_summary: {
                blockers: 0,
                warns: 0,
                details: "Pedido manual de revisão"
            }
        });

        if (qError) throw new Error(qError.message);

        // Mudar estado local da evidência para 'needs_review'
        await supabase.from("eco_task_evidence").update({ status: 'needs_review' }).eq("id", evidence_id);

        return NextResponse.json({ success: true, queue_id: qId });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
