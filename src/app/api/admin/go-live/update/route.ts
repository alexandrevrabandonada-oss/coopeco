import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: "Server env missing." }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const { item_id, status, notes } = body;

    if (!item_id || !status) {
        return NextResponse.json({ error: "Missing item_id or status." }, { status: 400 });
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData } = await admin.auth.getUser(token);
    if (!userData?.user) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

    const { error } = await admin
        .from("eco_go_live_items")
        .update({
            status,
            notes: notes?.substring(0, 200) || null,
            completed_at: status === 'done' ? new Date().toISOString() : null
        })
        .eq("id", item_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
