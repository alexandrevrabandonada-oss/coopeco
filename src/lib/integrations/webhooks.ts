import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Dispatches a critical alert to all active webhooks for a given cell.
 * Ensures Zero PII in the payload.
 */
export async function dispatchCriticalAlert(params: {
    cell_id: string;
    neighborhood_slug?: string;
    title: string;
    body: string;
    entity_type: string;
    entity_id: string;
}) {
    if (!supabaseUrl || !serviceRoleKey) return;

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch active webhooks for this cell
    const { data: webhooks } = await admin
        .from("eco_webhook_endpoints")
        .select("*")
        .eq("cell_id", params.cell_id)
        .eq("enabled", true)
        .contains("event_kinds", ["ops_alert_critical"]);

    if (!webhooks || webhooks.length === 0) return;

    // 2. Fetch cell slug for context
    const { data: cell } = await admin
        .from("eco_cells")
        .select("slug")
        .eq("id", params.cell_id)
        .single();

    // 3. Prepare payload (Sanitized)
    const payload = {
        event_kind: "ops_alert_critical",
        cell_slug: cell?.slug || "general",
        neighborhood_slug: params.neighborhood_slug || "n/a",
        severity: "critical",
        title: params.title,
        body: params.body,
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        created_at: new Date().toISOString()
    };

    const bodyStr = JSON.stringify(payload);

    // 4. Dispatch to all endpoints
    const promises = webhooks.map(async (wh) => {
        const signature = crypto
            .createHmac("sha256", wh.secret)
            .update(bodyStr)
            .digest("hex");

        try {
            await fetch(wh.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-ECO-Signature": signature,
                    "User-Agent": "ECO-Webhook-Dispatcher/1.0"
                },
                body: bodyStr,
                // Short timeout to avoid blocking
                signal: AbortSignal.timeout(5000)
            });
        } catch (err) {
            console.error(`Failed to dispatch webhook to ${wh.url}:`, err);
        }
    });

    await Promise.allSettled(promises);
}
