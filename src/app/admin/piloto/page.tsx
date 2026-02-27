"use client";

import { ProtectedRouteGate } from "@/components/protected-route-gate";
import PilotoClient from "./piloto-client";

export default function AdminPilotoPage() {
  return (
    <ProtectedRouteGate>
      <PilotoClient />
    </ProtectedRouteGate>
  );
}
