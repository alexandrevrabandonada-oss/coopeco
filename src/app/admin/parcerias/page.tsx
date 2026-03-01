import { ProtectedRouteGate } from "@/components/protected-route-gate";
import ParceirosClient from "./parceiros-client";

export default function AdminParceriasPage() {
    return (
        <ProtectedRouteGate>
            <ParceirosClient />
        </ProtectedRouteGate>
    );
}
