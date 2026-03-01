import { ProtectedRouteGate } from "@/components/protected-route-gate";
import ObservabilidadeClient from "./observabilidade-client";

export const metadata = {
    title: "ECO - Observabilidade e Telemetria",
    description: "Monitoramento técnico de falhas e integridade do sistema.",
};

export default function ObservabilidadePage() {
    return (
        <ProtectedRouteGate>
            <ObservabilidadeClient />
        </ProtectedRouteGate>
    );
}
