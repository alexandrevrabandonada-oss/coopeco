"use client";

import { useEffect } from "react";
import { reportObsEventThrottled } from "@/lib/obs";

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            reportObsEventThrottled({
                event_kind: 'client_error',
                severity: 'error',
                context_kind: 'feature',
                context_key: 'window_onerror',
                message: event.message || "Unknown client error",
                meta: {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                }
            });
        };

        const handleRejection = (event: PromiseRejectionEvent) => {
            reportObsEventThrottled({
                event_kind: 'client_error',
                severity: 'error',
                context_kind: 'feature',
                context_key: 'unhandled_rejection',
                message: event.reason?.message || String(event.reason) || "Unhandled promise rejection",
                meta: {
                    stack: event.reason?.stack
                }
            });
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, []);

    return <>{children}</>;
}
