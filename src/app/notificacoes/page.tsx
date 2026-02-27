"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { UserNotification } from "@/types/eco";
import { LoadingBlock } from "@/components/loading-block";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { RequireAuthCard } from "@/components/require-auth-card";
import { useQueryState } from "@/hooks/use-query-state";

export default function NotificacoesPage() {
  const { user, profile, session, isLoading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const query = useQueryState<UserNotification[]>(
    async (signal) => {
      if (!session?.access_token) throw new Error("AUTH_REQUIRED");
      const response = await fetch("/api/notifications/list", {
        method: "GET",
        cache: "no-store",
        headers: { Authorization: `Bearer ${session.access_token}` },
        signal,
      });
      const payload = (await response.json().catch(() => null)) as { items?: UserNotification[]; error?: string } | null;
      if (response.status === 401 || response.status === 403) throw new Error("AUTH_REQUIRED");
      if (!response.ok) throw new Error(payload?.error || "Falha ao buscar notificações.");
      return (payload?.items || []) as UserNotification[];
    },
    [session?.access_token, user?.id],
  );

  const rows = query.data || [];
  const unreadIds = rows.filter((row) => !row.is_read).map((row) => row.id);

  const markRead = async (ids: string[] | null) => {
    if (!user) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const { error } = await supabase.rpc("rpc_mark_notifications_read", {
        ids,
        mark_all: !ids || ids.length === 0,
      });
      if (error) throw error;
      await query.refetch();
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) return <LoadingBlock text="Carregando sessão..." />;
  if (!user || !profile || query.error === "AUTH_REQUIRED") {
    console.error("ECO_NOTIF_401");
    return <RequireAuthCard body="Entre na sua conta para ver notificações." />;
  }
  if (query.status === "loading" || query.status === "idle") return <LoadingBlock text="Carregando notificações..." />;
  if (query.status === "error") {
    return (
      <ErrorState
        title="Não foi possível carregar notificações"
        body={query.error || "Tente novamente em instantes."}
        onRetry={query.refetch}
        code={query.error === "Demorou demais" ? "ECO_NOTIF_TIMEOUT" : "ECO_NOTIF_LOAD_FAIL"}
      />
    );
  }

  return (
    <div className="animate-slide-up pb-12">
      <h1
        className="stencil-text mb-6"
        style={{
          fontSize: "2.1rem",
          background: "var(--primary)",
          padding: "0 10px",
          border: "2px solid var(--foreground)",
          width: "fit-content",
        }}
      >
        NOTIFICAÇÕES
      </h1>

      <div className="card mb-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="stencil-text text-lg flex items-center gap-2">
            <Bell size={18} /> Centro de alertas
          </h2>
          <button className="cta-button small" disabled={isSaving || unreadIds.length === 0} onClick={() => markRead(unreadIds)}>
            {isSaving ? "Salvando..." : "Marcar como lidas"}
          </button>
        </div>
      </div>

      {saveError && (
        <ErrorState
          title="Não foi possível atualizar notificações"
          body={saveError}
          onRetry={() => markRead(unreadIds)}
          code="ECO_NOTIF_MARK_READ_FAIL"
        />
      )}

      {query.status === "empty" ? (
        <EmptyState title="Sem alertas por enquanto" body="Novos eventos da sua rotina vão aparecer aqui." />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.id} className="card" style={{ borderColor: row.is_read ? "var(--border)" : "var(--accent)" }}>
              <p className="font-black text-xs uppercase mb-1">
                {row.is_read ? "Lida" : "Nova"} • {new Date(row.created_at).toLocaleString("pt-BR")}
              </p>
              <p className="stencil-text text-sm mb-2">{row.title}</p>
              <p className="font-bold text-xs uppercase mb-3">{row.body}</p>
              <div className="flex gap-2">
                {!row.is_read && (
                  <button className="cta-button small" style={{ background: "white" }} onClick={() => markRead([row.id])}>
                    Marcar como lida
                  </button>
                )}
                {row.action_url && (
                  <Link href={row.action_url} className="cta-button small">
                    Ir para ação
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

