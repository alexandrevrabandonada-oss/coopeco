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
    const { neighborhood_id, summary } = body;

    if (!summary) {
        return NextResponse.json({ error: "Missing summary." }, { status: 400 });
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) {
        return NextResponse.json({ error: "Invalid token." }, { status: 401 });
    }

    const { data: profile } = await admin
        .from("profiles")
        .select("role")
        .eq("user_id", userData.user.id)
        .single();

    if (profile?.role !== "operator") {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { data, error } = await admin
        .from("eco_health_snapshots")
        .insert({
            neighborhood_id: neighborhood_id || null,
            summary,
            created_by: userData.user.id
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
