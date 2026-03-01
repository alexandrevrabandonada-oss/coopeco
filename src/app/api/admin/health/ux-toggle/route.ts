import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: "Server env missing Supabase config." }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
    }

    try {
        const payload = await request.json();
        const { item_id, new_status } = payload;

        if (!item_id || !new_status) {
            return NextResponse.json({ error: "item_id and new_status required" }, { status: 400 });
        }

        const token = authHeader.slice("Bearer ".length).trim();

        // Pass the user token to respect RLS policies (must be operator of cell)
        const admin = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });

        const { error } = await admin
            .from("eco_ux_readiness_items")
            .update({ status: new_status })
            .eq("id", item_id);

        if (error) throw error;

        // Invalidate cache immediately so UI reflects it on next load
        // Simplified approach for MVP

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
