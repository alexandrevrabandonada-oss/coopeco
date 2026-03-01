import { ProtectedRouteGate } from "@/components/protected-route-gate";
import IntegracoesClient from "./integracoes-client";

export default function AdminIntegracoesPage() {
    return (
        <ProtectedRouteGate>
            <IntegracoesClient />
        </ProtectedRouteGate>
    );
}
