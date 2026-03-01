import { ProtectedRouteGate } from "@/components/protected-route-gate";
import LogisticaClient from "./logistica-client";

export default function AdminLogisticaPage() {
    return (
        <ProtectedRouteGate>
            <LogisticaClient />
        </ProtectedRouteGate>
    );
}
