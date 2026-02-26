import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
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

  const rlsClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await rlsClient
    .from("user_notifications")
    .select("*")
    .eq("user_id", userData.user.id)
    .order("is_read", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data || [] });
}
