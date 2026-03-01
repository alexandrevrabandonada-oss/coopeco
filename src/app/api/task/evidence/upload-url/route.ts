import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// PII Heuristic (Best Effort A52)
const PII_KEYWORDS = ["cpf", "rg", "cnh", "rosto", "placa", "documento"];

function requiresReview(filename: string, mime_type: string): boolean {
    const lowerName = filename.toLowerCase();

    // PDF requests review by default (A52 heuristics)
    if (mime_type === "application/pdf") return true;

    // Keyword heuristics
    for (const kw of PII_KEYWORDS) {
        if (lowerName.includes(kw)) {
            return true;
        }
    }
    return false;
}

export async function POST(request: NextRequest) {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const supabase = createClient(supabaseUrl!, serviceRoleKey!);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid auth" }, { status: 401 });

    try {
        const body = await request.json();
        const { task_id, filename, mime_type, size_bytes } = body;

        // 1. Get Policy constraints
        const { data: policy } = await supabase
            .from("eco_task_evidence_policy")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        const maxBytes = policy?.max_bytes || 2000000;
        const allowedMimes = policy?.allowed_mime || [];
        const maxFiles = policy?.max_files || 3;

        if (size_bytes > maxBytes) {
            return NextResponse.json({ error: `Tamanho excede limite de ${maxBytes / 1000000}MB.` }, { status: 400 });
        }
        if (!allowedMimes.includes(mime_type)) {
            return NextResponse.json({ error: `Formato não permitido. Autorizados: ${allowedMimes.join(', ')}` }, { status: 400 });
        }

        // 2. Validate Task limits and authorship
        const { data: task } = await supabase
            .from("eco_common_tasks")
            .select("assignee_id, cell_id")
            .eq("id", task_id)
            .single();

        if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
        if (task.assignee_id !== user.id) return NextResponse.json({ error: "Apenas o responsável pode enviar evidências." }, { status: 403 });

        const { count } = await supabase
            .from("eco_task_evidence")
            .select("*", { count: 'exact', head: true })
            .eq("task_id", task_id);

        if (count !== null && count >= maxFiles) {
            return NextResponse.json({ error: `Limite máximo de anexo atingido (${maxFiles}).` }, { status: 400 });
        }

        // 3. Apply Heuristics
        const needsReview = requiresReview(filename, mime_type);
        const initialStatus = needsReview ? 'needs_review' : 'uploaded';
        const notes = needsReview ? "Termos bloqueados identificados no nome do arquivo (PII potential)." : null;

        const fileExt = filename.split('.').pop();
        const storagePath = `tasks/${task.cell_id}/${task_id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        // 4. Create row in DB
        const { data: evidence, error: insError } = await supabase
            .from("eco_task_evidence")
            .insert({
                task_id,
                kind: mime_type === "application/pdf" ? 'pdf' : 'image',
                title: filename,
                storage_path: storagePath,
                mime_type,
                size_bytes,
                status: initialStatus,
                review_notes: notes,
                created_by: user.id
            })
            .select()
            .single();

        if (insError || !evidence) throw new Error(insError?.message || "Erro inserindo evidência.");

        // Se precisar de revisão (A52 Heuristics), inserir direto na fila do A48
        if (needsReview) {
            await supabase.rpc('rpc_request_editorial_review', {
                p_cell_id: task.cell_id,
                p_source_kind: 'task_evidence',
                p_source_id: evidence.id,
                p_lint_summary: {
                    blockers: 1,
                    warns: 0,
                    details: "Bloqueio Heurístico A52. Possível PII (Rosto, Documento, Placa)."
                }
            });
        }

        // 5. Generate Signed Upload URL
        const { data: uploadData, error: upError } = await supabase.storage
            .from("eco-evidence")
            .createSignedUploadUrl(storagePath);

        if (upError || !uploadData) {
            // Rollback row locally
            await supabase.from("eco_task_evidence").delete().eq("id", evidence.id);
            throw new Error("Erro ao gerar link de upload: " + upError?.message);
        }

        // Return the URL and the initial evidence metadata
        return NextResponse.json({
            upload_url: uploadData.signedUrl,
            storage_path: storagePath,
            evidence_id: evidence.id,
            initial_status: initialStatus
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
