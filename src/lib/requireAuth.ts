"use client";

import { useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Profile } from "@/types/eco";

type Role = Profile["role"];

export type AuthRequirement = {
  requiresAuth: boolean;
  requiresNeighborhood: boolean;
  allowedRoles?: Role[];
};

const PUBLIC_PREFIXES = ["/", "/mural", "/mapa", "/aprender", "/perfil", "/parceiros", "/bairros"];

const PROTECTED_EXACT = new Set(["/pedidos", "/pedir-coleta", "/notificacoes", "/recorrencia"]);

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (PROTECTED_EXACT.has(pathname)) return false;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function getAuthRequirement(pathname: string): AuthRequirement {
  if (pathname === "/cooperado" || pathname.startsWith("/cooperado/")) {
    return { requiresAuth: true, requiresNeighborhood: true, allowedRoles: ["cooperado", "operator"] };
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return { requiresAuth: true, requiresNeighborhood: true, allowedRoles: ["operator"] };
  }
  if (PROTECTED_EXACT.has(pathname)) {
    return { requiresAuth: true, requiresNeighborhood: true };
  }
  if (isPublicPath(pathname)) {
    return { requiresAuth: false, requiresNeighborhood: false };
  }
  return { requiresAuth: false, requiresNeighborhood: false };
}

export function useRequireAuth(requirement: AuthRequirement) {
  const { user, profile, isLoading } = useAuth();
  const p = profile as Profile | null;

  return useMemo(() => {
    if (!requirement.requiresAuth) {
      return {
        isLoading,
        isAllowed: true,
        reason: null as null | "unauthenticated" | "missing_neighborhood" | "forbidden_role",
      };
    }
    if (isLoading) {
      return { isLoading: true, isAllowed: false, reason: null as null };
    }
    if (!user) {
      return { isLoading: false, isAllowed: false, reason: "unauthenticated" as const };
    }
    if (requirement.requiresNeighborhood && !p?.neighborhood_id) {
      return { isLoading: false, isAllowed: false, reason: "missing_neighborhood" as const };
    }
    if (requirement.allowedRoles && (!p || !requirement.allowedRoles.includes(p.role))) {
      return { isLoading: false, isAllowed: false, reason: "forbidden_role" as const };
    }
    return { isLoading: false, isAllowed: true, reason: null as null };
  }, [isLoading, p, requirement.allowedRoles, requirement.requiresAuth, requirement.requiresNeighborhood, user]);
}

