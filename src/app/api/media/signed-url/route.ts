import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AppRole = "resident" | "cooperado" | "operator" | "moderator";
type EntityType = "receipt" | "post";

interface MediaObjectRow {
  id: string;
  bucket: string;
  path: string;
  owner_id: string;
  entity_type: EntityType;
  entity_id: string;
}

interface ActorContext {
  actorId: string;
  role: AppRole | null;
}

function parseExpiresIn(request: NextRequest): number {
  const raw = request.nextUrl.searchParams.get("expires_in");
  if (!raw) return 120;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return 120;
  if (parsed < 60) return 60;
  if (parsed > 300) return 300;
  return parsed;
}

function parseEntityType(raw: string | null): EntityType | null {
  if (raw === "receipt" || raw === "post") return raw;
  return null;
}

async function getActorContext(admin: SupabaseClient, token: string): Promise<ActorContext | null> {
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return null;

  const actorId = userData.user.id;
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", actorId)
    .maybeSingle<{ role: AppRole | null }>();

  if (profileError) return null;

  return {
    actorId,
    role: profile?.role ?? null,
  };
}

async function canAccessReceiptEntity(
  admin: SupabaseClient,
  actor: ActorContext,
  receiptId: string,
): Promise<boolean> {
  if (actor.role === "operator") return true;

  const { data: receipt, error: receiptError } = await admin
    .from("receipts")
    .select("id, cooperado_id, request_id")
    .eq("id", receiptId)
    .single<{
      id: string;
      cooperado_id: string;
      request_id: string;
    }>();

  if (receiptError || !receipt) return false;

  if (actor.actorId === receipt.cooperado_id) return true;

  const { data: requestOwner, error: requestOwnerError } = await admin
    .from("pickup_requests")
    .select("created_by")
    .eq("id", receipt.request_id)
    .maybeSingle<{ created_by: string }>();

  if (!requestOwnerError && requestOwner?.created_by === actor.actorId) {
    return true;
  }

  const { data: assignment, error: assignmentError } = await admin
    .from("pickup_assignments")
    .select("id")
    .eq("request_id", receipt.request_id)
    .eq("cooperado_id", actor.actorId)
    .maybeSingle();

  if (assignmentError) return false;
  return !!assignment;
}

async function canAccessMediaObject(
  admin: SupabaseClient,
  actor: ActorContext,
  media: MediaObjectRow,
): Promise<boolean> {
  if (actor.role === "operator") return true;
  if (media.owner_id === actor.actorId) return true;

  if (media.entity_type === "receipt") {
    return canAccessReceiptEntity(admin, actor, media.entity_id);
  }

  // Post media is restricted to owner/operator in A5.
  return false;
}

async function buildSignedUrl(
  admin: SupabaseClient,
  media: MediaObjectRow,
  expiresIn: number,
): Promise<string | null> {
  const { data, error } = await admin.storage
    .from(media.bucket || "eco-media")
    .createSignedUrl(media.path, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function GET(request: NextRequest) {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Server env is missing Supabase configuration." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const expiresIn = parseExpiresIn(request);
  const mediaId = request.nextUrl.searchParams.get("media_id");
  const entityType = parseEntityType(request.nextUrl.searchParams.get("entity_type"));
  const entityId = request.nextUrl.searchParams.get("entity_id");

  if (mediaId && (!UUID_REGEX.test(mediaId))) {
    return NextResponse.json({ error: "Invalid media_id." }, { status: 400 });
  }

  if (!mediaId) {
    if (!entityType || !entityId || !UUID_REGEX.test(entityId)) {
      return NextResponse.json(
        { error: "Provide media_id OR entity_type + entity_id (uuid)." },
        { status: 400 },
      );
    }
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const actor = await getActorContext(admin, token);
  if (!actor) {
    return NextResponse.json({ error: "Invalid auth token or missing profile." }, { status: 401 });
  }

  if (mediaId) {
    const { data: media, error: mediaError } = await admin
      .from("media_objects")
      .select("id, bucket, path, owner_id, entity_type, entity_id")
      .eq("id", mediaId)
      .single<MediaObjectRow>();

    if (mediaError || !media) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 });
    }

    const allowed = await canAccessMediaObject(admin, actor, media);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const signedUrl = await buildSignedUrl(admin, media, expiresIn);
    if (!signedUrl) {
      return NextResponse.json({ error: "Failed to generate signed URL." }, { status: 500 });
    }

    return NextResponse.json({
      media_id: media.id,
      entity_type: media.entity_type,
      entity_id: media.entity_id,
      expires_in: expiresIn,
      signed_url: signedUrl,
    });
  }

  // entity request
  const { data: mediaRows, error: mediaRowsError } = await admin
    .from("media_objects")
    .select("id, bucket, path, owner_id, entity_type, entity_id")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });

  if (mediaRowsError) {
    return NextResponse.json({ error: mediaRowsError.message }, { status: 500 });
  }

  const allRows = (mediaRows || []) as MediaObjectRow[];
  const allowedRows: MediaObjectRow[] = [];
  for (const row of allRows) {
    // Explicit per-row authorization check
    // (kept even though media belongs to a single entity)
    // to prevent accidental permission expansion.
    const allowed = await canAccessMediaObject(admin, actor, row);
    if (allowed) allowedRows.push(row);
  }

  if (allRows.length > 0 && allowedRows.length === 0) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const items: Array<{ media_id: string; signed_url: string }> = [];
  for (const row of allowedRows) {
    const signedUrl = await buildSignedUrl(admin, row, expiresIn);
    if (!signedUrl) continue;
    items.push({
      media_id: row.id,
      signed_url: signedUrl,
    });
  }

  return NextResponse.json({
    entity_type: entityType,
    entity_id: entityId,
    expires_in: expiresIn,
    items,
  });
}
