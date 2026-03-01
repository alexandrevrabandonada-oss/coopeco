/**
 * Technical Observability Utility (Anti-Surveillance)
 * Used to report technical failures without PII.
 */

type ObsEventKind =
    | 'client_error'
    | 'api_error'
    | 'rpc_error'
    | 'sync_fail'
    | 'sync_retry'
    | 'upload_fail'
    | 'upload_retry'
    | 'signedurl_fail'
    | 'signedurl_renew'
    | 'offline_enter'
    | 'offline_exit';

type Severity = 'info' | 'warn' | 'error' | 'critical';

export async function reportObsEvent(params: {
    event_kind: ObsEventKind;
    severity: Severity;
    context_kind?: 'page' | 'api' | 'rpc' | 'feature';
    context_key?: string;
    message: string;
    meta?: any;
    neighborhood_id?: string;
}) {
    try {
        // Sanitize at source (extra layer)
        const sanitizedMsg = params.message.substring(0, 200);

        const res = await fetch("/api/obs/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...params,
                message: sanitizedMsg
            })
        });

        if (!res.ok) {
            // Silently fail to avoid infinite loops if it's a network issue
            console.warn("Obs Event report failed status:", res.status);
        }
    } catch (err) {
        console.warn("Obs Event report failed:", err);
    }
}

/**
 * Throttled reporter to avoid flooding on catastrophic failures
 */
const recentReports = new Map<string, number>();

export function reportObsEventThrottled(params: {
    event_kind: ObsEventKind;
    severity: Severity;
    context_kind?: 'page' | 'api' | 'rpc' | 'feature';
    context_key?: string;
    message: string;
    meta?: any;
    neighborhood_id?: string;
}, delayMs = 30000) {
    const key = `${params.event_kind}:${params.context_key || 'global'}`;
    const now = Date.now();
    const last = recentReports.get(key) || 0;

    if (now - last < delayMs) return;

    recentReports.set(key, now);
    reportObsEvent(params);
}
