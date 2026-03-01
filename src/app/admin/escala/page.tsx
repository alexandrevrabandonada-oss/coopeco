import { ProtectedRouteGate } from "@/components/protected-route-gate";
import EscalaClient from "./escala-client";

export default function AdminEscalaPage() {
    return (
        <ProtectedRouteGate>
            <EscalaClient />
        </ProtectedRouteGate>
    );
}
