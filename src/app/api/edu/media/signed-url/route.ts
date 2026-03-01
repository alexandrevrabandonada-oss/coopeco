import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripPrivateFields, assertNoPII } from "@/lib/privacy/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * A39: Generate Signed URLs for educational media with caching (A38)
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const mediaId = searchParams.get("media_id");

    if (!mediaId) {
        return NextResponse.json({ error: "Missing media_id" }, { status: 400 });
    }

    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: "Server config missing" }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Check A38 Aggregate Cache (TTL 120s for signed URLs)
    const { data: cached } = await admin.rpc("rpc_get_agg_cache", {
        p_cache_key: `media_url_${mediaId}`,
        p_scope: 'global'
    });

    if (cached) {
        return NextResponse.json(cached);
    }

    // 2. Fetch media asset info
    const { data: asset, error: assetError } = await admin
        .from("edu_media_assets")
        .select("storage_path, original_path, compressed_path, kind, transcript_md, status, is_public, compression_status")
        .eq("id", mediaId)
        .single();

    if (assetError || !asset) {
        return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    // A41 Governance Check
    if (asset.status !== 'published' || !asset.is_public) {
        // In a real scenario, we might allow the owner/operator to see drafts
        // For now, follow the "public SELECT only published" rule
        return NextResponse.json({ error: "Media not available" }, { status: 403 });
    }

    // 3. Select path (prefer compressed)
    const targetPath = (asset.compression_status === 'done' && asset.compressed_path)
        ? asset.compressed_path
        : asset.storage_path;

    const variant = (asset.compression_status === 'done' && asset.compressed_path) ? 'compressed' : 'original';

    // 4. Generate Signed URL (assuming 'edu-media' bucket)
    const { data: signed, error: signError } = await admin.storage
        .from("edu-media")
        .createSignedUrl(targetPath, 600); // 10 minutes

    if (signError || !signed) {
        return NextResponse.json({ error: "Failed to sign URL" }, { status: 500 });
    }

    const response = {
        media_id: mediaId,
        url: signed.signedUrl,
        expires_at: new Date(Date.now() + 600000).toISOString(),
        kind: asset.kind,
        variant,
        transcript_md: asset.transcript_md
    };

    const sanitized = stripPrivateFields(response);
    try {
        assertNoPII(sanitized);
    } catch (e: any) {
        return NextResponse.json({ error: "Privacy violation" }, { status: 500 });
    }

    // 4. Update A38 Cache
    await admin.rpc("rpc_set_agg_cache", {
        p_cache_key: `media_url_${mediaId}`,
        p_scope: 'global',
        p_payload: sanitized,
        p_ttl_seconds: 120
    });

    return NextResponse.json(sanitized);
}
