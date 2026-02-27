"use client";

import { usePathname } from "next/navigation";
import { LoadingBlock } from "@/components/loading-block";
import { RequireAuthCard } from "@/components/require-auth-card";
import { getAuthRequirement, useRequireAuth } from "@/lib/requireAuth";

export function ProtectedRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const requirement = getAuthRequirement(pathname);
  const auth = useRequireAuth(requirement);

  if (!requirement.requiresAuth) return <>{children}</>;
  if (auth.isLoading) return <LoadingBlock text="Validando acesso..." />;

  if (!auth.isAllowed) {
    if (auth.reason === "missing_neighborhood") {
      return (
        <RequireAuthCard
          title="Perfil incompleto"
          body="Complete seu perfil com bairro para liberar esta área."
          ctaLabel="Completar perfil"
          ctaHref="/perfil"
        />
      );
    }
    if (auth.reason === "forbidden_role") {
      return (
        <RequireAuthCard
          title="Acesso necessário"
          body="Seu perfil não tem permissão para esta área."
          ctaLabel="Ir para perfil"
          ctaHref="/perfil"
        />
      );
    }
    return <RequireAuthCard body="Entre na sua conta para continuar." />;
  }

  return <>{children}</>;
}

