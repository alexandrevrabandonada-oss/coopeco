import { ProtectedRouteGate } from "@/components/protected-route-gate";
import MelhoriasClient from "./melhorias-client";

export default function AdminMelhoriasPage() {
    return (
        <ProtectedRouteGate>
            <MelhoriasClient />
        </ProtectedRouteGate>
    );
}
