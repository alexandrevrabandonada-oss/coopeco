import { ProtectedRouteGate } from "@/components/protected-route-gate";
import GovernancaCelulaClient from "./governanca-client";

export default function AdminGovernancaCelulaPage() {
    return (
        <ProtectedRouteGate>
            <GovernancaCelulaClient />
        </ProtectedRouteGate>
    );
}
