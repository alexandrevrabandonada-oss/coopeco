"use client";

import { ProtectedRouteGate } from "@/components/protected-route-gate";
import RampClient from "./ramp-client";

export default function AdminRampPage() {
    return (
        <ProtectedRouteGate>
            <RampClient />
        </ProtectedRouteGate>
    );
}
