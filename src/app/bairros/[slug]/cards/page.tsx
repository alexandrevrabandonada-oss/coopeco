import { ProtectedRouteGate } from "@/components/protected-route-gate";
import CardsClient from "./cards-client";

export default function NeighborhoodCardsPage({ params }: { params: { slug: string } }) {
    return (
        <ProtectedRouteGate>
            <CardsClient slug={params.slug} />
        </ProtectedRouteGate>
    );
}
