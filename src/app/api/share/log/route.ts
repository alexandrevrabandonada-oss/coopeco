import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.slice("Bearer ".length).trim();

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Verify operator role
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

    if (profile?.role !== "operator") {
        return NextResponse.json({ error: "Forbidden: Operator only" }, { status: 403 });
    }

    try {
        const { kind, format, neighborhood_id, payload_json } = await request.json();

        if (!kind || !neighborhood_id) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from("comm_exports")
            .insert({
                kind,
                format,
                neighborhood_id,
                payload_json,
                created_by: user.id
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, id: data.id });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}
