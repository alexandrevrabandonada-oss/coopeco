import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * A35 Batch Job Runner API
 * Triggers the RPC and handles complex multi-step logic if needed.
 */
export async function POST(req: NextRequest) {
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: "Server env missing." }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Auth (Operator)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== 'operator') return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const { job_id, kind, scope } = await req.json();

        let target_job_id = job_id;

        // If no job_id, create one first
        if (!target_job_id) {
            const { data: newJob, error: createError } = await admin.from("eco_batch_jobs").insert({
                kind,
                scope,
                created_by: user.id
            }).select().single();

            if (createError) throw createError;
            target_job_id = newJob.id;
        }

        // Trigger the RPC
        const { data, error } = await admin.rpc("rpc_run_batch_job", { p_job_id: target_job_id });

        if (error) throw error;

        // Additional Server-Side logic for certain jobs
        if (kind === 'run_privacy_audit_batch') {
            // Logic to call /api/admin/privacy/run for each cell's neighborhoods
            // This is simulated here by the RPC log and status update
        }

        return NextResponse.json({ success: true, job_id: target_job_id, result: data });

    } catch (err: any) {
        console.error("Batch Job Runner Fail:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
