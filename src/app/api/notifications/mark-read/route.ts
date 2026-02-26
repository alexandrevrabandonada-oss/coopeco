import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Server env is missing Supabase configuration." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
  }
  const token = authHeader.slice("Bearer ".length).trim();

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Invalid auth token." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as { ids?: string[]; all?: boolean };
  const markAll = Boolean(payload.all);
  const ids = Array.isArray(payload.ids) ? payload.ids : null;

  if (!markAll && (!ids || ids.length === 0)) {
    return NextResponse.json({ error: "Provide ids[] or all=true." }, { status: 400 });
  }

  const rlsClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await rlsClient.rpc("rpc_mark_notifications_read", {
    ids,
    mark_all: markAll,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ updated: data || 0, user_id: userData.user.id });
}
