import { ProtectedRouteGate } from "@/components/protected-route-gate";
import RunbookClient from "./runbook-client";

export const metadata = {
    title: "ECO - Central de Incidentes (Runbook)",
    description: "Gestão operacional e mitigação de crises no território.",
};

export default function RunbookPage() {
    return (
        <ProtectedRouteGate>
            <RunbookClient />
        </ProtectedRouteGate>
    );
}
