"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Bell, ShieldOff } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { Profile, UserNotification } from "@/types/eco";

export default function NotificacoesPage() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const p = profile as Profile | null;
  const supabase = useMemo(() => createClient(), []);

  const [rows, setRows] = useState<UserNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("is_read", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setRows((data || []) as UserNotification[]);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (ids: string[] | null) => {
    if (!user) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.rpc("rpc_mark_notifications_read", {
        ids,
        mark_all: !ids || ids.length === 0,
      });
      if (error) throw error;
      await load();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-primary" size={44} />
      </div>
    );
  }

  if (!user || !p) {
    return (
      <div className="card text-center py-12 animate-slide-up">
        <ShieldOff size={48} className="mx-auto mb-4 text-accent" />
        <h2 className="stencil-text mb-3">Acesso Restrito</h2>
        <p className="font-bold uppercase">Entre na sua conta para ver notificações.</p>
      </div>
    );
  }

  const unreadIds = rows.filter((row) => !row.is_read).map((row) => row.id);

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
            {isSaving ? "Salvando..." : "Marcar tudo como lidas"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="card mb-6" style={{ borderColor: "var(--accent)" }}>
          <p className="font-bold text-sm uppercase">Erro: {errorMessage}</p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card">
          <p className="font-bold uppercase text-sm">Nenhuma notificação no momento.</p>
        </div>
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
