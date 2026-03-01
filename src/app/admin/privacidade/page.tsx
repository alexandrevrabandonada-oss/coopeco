"use client";

import { ProtectedRouteGate } from "@/components/protected-route-gate";
import PrivacyAuditClient from "./privacy-client";

export default function AdminPrivacyPage() {
    return (
        <ProtectedRouteGate>
            <PrivacyAuditClient />
        </ProtectedRouteGate>
    );
}
