"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { Loader2, Repeat2, ShieldOff } from "lucide-react";
import Link from "next/link";
import { EcoDropPoint, PickupAddressProfile, Profile, RecurringSubscription, RouteWindow } from "@/types/eco";
import { formatWindowLabel } from "@/lib/route-windows";

const weekdays = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

export default function RecorrenciaPage() {
  const router = useRouter();
  const { user, profile, isLoading: authLoading } = useAuth();
  const p = profile as Profile | null;
  const supabase = useMemo(() => createClient(), []);

  const [windows, setWindows] = useState<RouteWindow[]>([]);
  const [dropPoints, setDropPoints] = useState<EcoDropPoint[]>([]);
  const [subscriptions, setSubscriptions] = useState<RecurringSubscription[]>([]);
  const [hasDoorstepAddress, setHasDoorstepAddress] = useState(false);
  const [recurringAlertCount, setRecurringAlertCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [cadence, setCadence] = useState<"weekly" | "biweekly">("weekly");
  const [preferredWeekday, setPreferredWeekday] = useState(2);
  const [preferredWindowId, setPreferredWindowId] = useState("");
  const [fulfillmentMode, setFulfillmentMode] = useState<"doorstep" | "drop_point">("doorstep");
  const [dropPointId, setDropPointId] = useState("");
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async () => {
    if (!user) return;

    // Soft-redirection check
    const { data: onboarding } = await supabase
      .from("onboarding_state")
      .select("step")
      .eq("user_id", user.id)
      .maybeSingle();

    if (onboarding && !['first_action', 'done'].includes(onboarding.step)) {
      router.push("/começar");
      return;
    }

    if (!p?.neighborhood_id) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [
        { data: windowsData, error: windowsError },
        { data: pointsData, error: pointsError },
        { data: subsData, error: subsError },
        { data: addressData, error: addressError },
        { count: recurringAlertsCount, error: recurringAlertsError },
      ] =
        await Promise.all([
          supabase
            .from("route_windows")
            .select("*")
            .eq("neighborhood_id", p.neighborhood_id)
            .eq("active", true)
            .order("weekday", { ascending: true })
            .order("start_time", { ascending: true }),
          supabase
            .from("eco_drop_points")
            .select("*")
            .eq("neighborhood_id", p.neighborhood_id)
            .eq("active", true)
            .order("created_at", { ascending: false }),
          supabase
            .from("recurring_subscriptions")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("pickup_address_profiles")
            .select("user_id, address_full")
            .eq("user_id", user.id)
            .maybeSingle<PickupAddressProfile>(),
          supabase
            .from("user_notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("kind", "recurring_skipped_invalid")
            .eq("is_read", false),
        ]);

      if (windowsError) throw windowsError;
      if (pointsError) throw pointsError;
      if (subsError) throw subsError;
      if (addressError) throw addressError;
      if (recurringAlertsError) throw recurringAlertsError;

      const safeWindows = (windowsData || []) as RouteWindow[];
      const safePoints = (pointsData || []) as EcoDropPoint[];
      const safeSubs = (subsData || []) as RecurringSubscription[];
      setWindows(safeWindows);
      setDropPoints(safePoints);
      setSubscriptions(safeSubs);
      setHasDoorstepAddress(Boolean(addressData?.address_full && addressData.address_full.trim().length > 0));
      setRecurringAlertCount(recurringAlertsCount || 0);

      if (safeWindows.length > 0) {
        setPreferredWindowId((current) => current || safeWindows[0].id);
      }
      if (safePoints.length > 0) {
        setDropPointId((current) => current || safePoints[0].id);
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [user, p?.neighborhood_id, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createSubscription = async () => {
    if (!user || !p?.neighborhood_id) return;
    setErrorMessage(null);
    setIsSaving(true);
    try {
      if (fulfillmentMode === "drop_point" && !dropPointId) {
        throw new Error("Selecione um Ponto ECO para recorrência.");
      }
      const { error } = await supabase.from("recurring_subscriptions").insert({
        created_by: user.id,
        neighborhood_id: p.neighborhood_id,
        scope: "resident",
        fulfillment_mode: fulfillmentMode,
        drop_point_id: fulfillmentMode === "drop_point" ? dropPointId : null,
        cadence,
        preferred_weekday: preferredWeekday,
        preferred_window_id: preferredWindowId || null,
        notes: notes.trim() || null,
        address_ref: notes.trim() || null,
        status: "active",
      });
      if (error) throw error;
      await loadData();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (subscription: RecurringSubscription) => {
    setErrorMessage(null);
    try {
      const nextStatus = subscription.status === "active" ? "paused" : "active";
      const { error } = await supabase
        .from("recurring_subscriptions")
        .update({ status: nextStatus })
        .eq("id", subscription.id);
      if (error) throw error;
      await loadData();
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-primary" size={44} />
      </div>
    );
  }

  if (!user || !p || p.role !== "resident") {
    return (
      <div className="card text-center py-12 animate-slide-up">
        <ShieldOff size={48} className="mx-auto mb-4 text-accent" />
        <h2 className="stencil-text mb-3">Acesso Restrito</h2>
        <p className="font-bold uppercase">A recorrência está disponível para moradores logados.</p>
      </div>
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
        RECORRÊNCIA
      </h1>

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-3 flex items-center gap-2">
          <Repeat2 size={18} /> Criar recorrência
        </h2>
        {recurringAlertCount > 0 && (
          <div className="border-2 border-accent bg-white p-3 mb-3">
            <p className="font-black text-xs uppercase">
              Existem {recurringAlertCount} alerta(s) de recorrência pendentes.
            </p>
            <p className="font-bold text-xs uppercase mb-2">
              Verifique as notificações e ajuste seu cadastro para voltar à rotina de coleta.
            </p>
            <Link href="/notificacoes" className="cta-button small inline-flex">
              Abrir notificações
            </Link>
          </div>
        )}
        {fulfillmentMode === "doorstep" && !hasDoorstepAddress && (
          <div className="border-2 border-accent bg-white p-3 mb-3">
            <p className="font-black text-xs uppercase">
              Endereço de coleta ainda não configurado.
            </p>
            <p className="font-bold text-xs uppercase">
              A assinatura pode ser criada, mas a geração automática ficará em skipped_invalid até você salvar seu endereço privado.
            </p>
            <Link href="/perfil/endereco" className="cta-button small mt-2 inline-flex">
              Cadastrar endereço no perfil
            </Link>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <label className="flex flex-col gap-1">
            <span className="stencil-text text-xs">Modo</span>
            <select value={fulfillmentMode} onChange={(e) => setFulfillmentMode(e.target.value as "doorstep" | "drop_point")} className="field">
              <option value="doorstep">Retirada em casa</option>
              <option value="drop_point">Entrega em Ponto ECO</option>
            </select>
          </label>
          {fulfillmentMode === "drop_point" && (
            <label className="flex flex-col gap-1">
              <span className="stencil-text text-xs">Ponto ECO</span>
              <select value={dropPointId} onChange={(e) => setDropPointId(e.target.value)} className="field">
                {dropPoints.map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="stencil-text text-xs">Cadência</span>
            <select value={cadence} onChange={(e) => setCadence(e.target.value as "weekly" | "biweekly")} className="field">
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quinzenal</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="stencil-text text-xs">Dia preferido</span>
            <select value={preferredWeekday} onChange={(e) => setPreferredWeekday(Number(e.target.value))} className="field">
              {weekdays.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="stencil-text text-xs">Janela preferida</span>
            <select value={preferredWindowId} onChange={(e) => setPreferredWindowId(e.target.value)} className="field">
              <option value="">Sem preferência (usa dia)</option>
              {windows.map((window) => (
                <option key={window.id} value={window.id}>
                  {formatWindowLabel(window)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="stencil-text text-xs">Notas (sem PII)</span>
            <input
              type="text"
              className="field"
              placeholder="Ex.: portaria A / loja 12"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        <button onClick={createSubscription} disabled={isSaving} className="cta-button small">
          {isSaving ? "Gravando..." : "Criar assinatura"}
        </button>
      </div>

      {errorMessage && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <p className="font-bold text-sm uppercase">Erro: {errorMessage}</p>
        </div>
      )}

      <div className="card">
        <h2 className="stencil-text text-lg mb-4">Minhas assinaturas</h2>
        {subscriptions.length === 0 ? (
          <p className="font-bold uppercase text-sm">Nenhuma assinatura ainda.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {subscriptions.map((entry) => (
              <div key={entry.id} className="border-2 border-foreground bg-white p-3">
                <p className="font-black uppercase text-xs">
                  {entry.cadence} | status: {entry.status}
                </p>
                <p className="font-bold text-sm uppercase">
                  Dia: {weekdays.find((d) => d.value === entry.preferred_weekday)?.label || entry.preferred_weekday}
                </p>
                <p className="font-bold text-xs uppercase">
                  Modo: {entry.fulfillment_mode === "drop_point" ? "PONTO ECO" : "RETIRADA EM CASA"}
                </p>
                <button
                  className="cta-button small mt-3"
                  style={{ background: "white" }}
                  onClick={() => toggleStatus(entry)}
                >
                  {entry.status === "active" ? "Pausar" : "Reativar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
