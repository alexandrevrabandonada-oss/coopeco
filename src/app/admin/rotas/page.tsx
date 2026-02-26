"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { Loader2, Route, ShieldOff } from "lucide-react";
import { Profile, RecurringSubscription, RouteWindow } from "@/types/eco";
import { formatWindowLabel } from "@/lib/route-windows";

interface NeighborhoodOption {
  id: string;
  name: string;
  slug: string;
}

interface SubscriptionRow extends RecurringSubscription {
  profile?: { display_name: string | null } | null;
  partner?: { name: string | null } | null;
}

interface RouteWindowQueueRow {
  window_id: string;
  neighborhood_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  scheduled_day: string;
  requests_count: number;
  drop_point_count: number;
  doorstep_count: number;
  recurring_count?: number;
  recurring_coverage_pct?: number;
}

interface RouteWindowQualityRow {
  window_id: string;
  receipts_count: number;
  ok_rate: number;
  top_flags: string;
}

interface RecurringGenerationResult {
  window_id: string;
  scheduled_for: string;
  generated: number;
  skipped_existing: number;
  skipped_paused: number;
  skipped_invalid: number;
  skipped_capacity: number;
}

interface OccurrenceRow {
  id: string;
  subscription_id: string;
  route_window_id: string;
  scheduled_for: string;
  status: "generated" | "skipped_capacity" | "skipped_paused" | "skipped_invalid";
  request_id?: string | null;
  created_at: string;
  subscription?:
    | {
        created_by?: string | null;
        fulfillment_mode?: "doorstep" | "drop_point";
      }
    | Array<{
        created_by?: string | null;
        fulfillment_mode?: "doorstep" | "drop_point";
      }>
    | null;
  window?:
    | {
        weekday: number;
        start_time: string;
        end_time: string;
      }
    | Array<{
        weekday: number;
        start_time: string;
        end_time: string;
      }>
    | null;
}

export default function AdminRotasPage() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const p = profile as Profile | null;
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodOption[]>([]);
  const [windows, setWindows] = useState<RouteWindow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [queueMetrics, setQueueMetrics] = useState<RouteWindowQueueRow[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<RouteWindowQualityRow[]>([]);
  const [occurrences, setOccurrences] = useState<OccurrenceRow[]>([]);

  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState("");
  const [weekday, setWeekday] = useState(2);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [capacity, setCapacity] = useState(20);
  const [selectedGenerateWindowId, setSelectedGenerateWindowId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<RecurringGenerationResult | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const { data: neighborhoodsData, error: neighborhoodsError } = await supabase
        .from("neighborhoods")
        .select("id, name, slug")
        .order("name", { ascending: true });
      if (neighborhoodsError) throw neighborhoodsError;

      const safeNeighborhoods = (neighborhoodsData || []) as NeighborhoodOption[];
      setNeighborhoods(safeNeighborhoods);
      const neighborhoodId = selectedNeighborhoodId || safeNeighborhoods[0]?.id || "";
      setSelectedNeighborhoodId(neighborhoodId);

      if (neighborhoodId) {
        const [
          { data: windowsData, error: windowsError },
          { data: subscriptionsData, error: subscriptionsError },
          { data: queueData, error: queueError },
          { data: qualityData, error: qualityError },
          { data: occurrencesData, error: occurrencesError },
        ] =
          await Promise.all([
            supabase
              .from("route_windows")
              .select("*")
              .eq("neighborhood_id", neighborhoodId)
              .order("weekday", { ascending: true })
              .order("start_time", { ascending: true }),
            supabase
              .from("recurring_subscriptions")
              .select("*, profile:profiles!recurring_subscriptions_created_by_fkey(display_name), partner:partners(name)")
              .eq("neighborhood_id", neighborhoodId)
              .order("created_at", { ascending: false }),
            supabase
              .from("v_route_window_queue_7d")
              .select("*")
              .eq("neighborhood_id", neighborhoodId)
              .order("scheduled_day", { ascending: false }),
            supabase
              .from("v_route_window_quality_7d")
              .select("*"),
            supabase
              .from("recurring_occurrences")
              .select(`
                id,
                subscription_id,
                route_window_id,
                scheduled_for,
                status,
                request_id,
                created_at,
                subscription:recurring_subscriptions!recurring_occurrences_subscription_id_fkey(created_by, fulfillment_mode),
                window:route_windows!recurring_occurrences_route_window_id_fkey(weekday, start_time, end_time)
              `)
              .order("created_at", { ascending: false })
              .limit(500),
          ]);
        if (windowsError) throw windowsError;
        if (subscriptionsError) throw subscriptionsError;
        if (queueError) throw queueError;
        if (qualityError) throw qualityError;
        if (occurrencesError) throw occurrencesError;
        setWindows((windowsData || []) as RouteWindow[]);
        setSubscriptions((subscriptionsData || []) as SubscriptionRow[]);
        setQueueMetrics((queueData || []) as RouteWindowQueueRow[]);
        setQualityMetrics((qualityData || []) as RouteWindowQualityRow[]);
        const safeWindows = (windowsData || []) as RouteWindow[];
        const windowIds = new Set(safeWindows.map((row) => row.id));
        const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
        const filteredOccurrences = ((occurrencesData || []) as OccurrenceRow[]).filter(
          (entry) =>
            windowIds.has(entry.route_window_id) &&
            new Date(entry.created_at).getTime() >= fourteenDaysAgo,
        );
        setOccurrences(filteredOccurrences);
        setSelectedGenerateWindowId((current) => current || safeWindows[0]?.id || "");
      } else {
        setWindows([]);
        setSubscriptions([]);
        setQueueMetrics([]);
        setQualityMetrics([]);
        setOccurrences([]);
        setSelectedGenerateWindowId("");
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedNeighborhoodId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData, user?.id]);

  const createWindow = async () => {
    if (!selectedNeighborhoodId) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.from("route_windows").insert({
        neighborhood_id: selectedNeighborhoodId,
        weekday,
        start_time: startTime,
        end_time: endTime,
        capacity,
        active: true,
      });
      if (error) throw error;
      await loadData();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleWindow = async (window: RouteWindow) => {
    setErrorMessage(null);
    try {
      const { error } = await supabase
        .from("route_windows")
        .update({ active: !window.active })
        .eq("id", window.id);
      if (error) throw error;
      await loadData();
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const generateRecurring = async () => {
    if (!selectedGenerateWindowId) return;
    setErrorMessage(null);
    setIsGenerating(true);
    setGenerationResult(null);
    try {
      const { data, error } = await supabase.rpc("rpc_generate_recurring_requests", {
        window_id: selectedGenerateWindowId,
        scheduled_for: null,
      });
      if (error) throw error;
      setGenerationResult(data as RecurringGenerationResult);
      await loadData();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-primary" size={44} />
      </div>
    );
  }

  if (!user || !p || p.role !== "operator") {
    return (
      <div className="card text-center py-12 animate-slide-up">
        <ShieldOff size={48} className="mx-auto mb-4 text-accent" />
        <h2 className="stencil-text mb-3">Acesso Restrito</h2>
        <p className="font-bold uppercase">Somente operador administra janelas de rota.</p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up pb-12">
      <h1
        className="stencil-text mb-6"
        style={{
          fontSize: "2.2rem",
          background: "var(--primary)",
          padding: "0 10px",
          border: "2px solid var(--foreground)",
          width: "fit-content",
        }}
      >
        ADMIN / ROTAS
      </h1>

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-4 flex items-center gap-2">
          <Route size={18} /> Criar janela por bairro
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
          <select className="field" value={selectedNeighborhoodId} onChange={(e) => setSelectedNeighborhoodId(e.target.value)}>
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
          <input type="number" className="field" min={0} max={6} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} />
          <input type="time" className="field" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <input type="time" className="field" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          <input type="number" className="field" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
        </div>
        <button className="cta-button small" onClick={createWindow} disabled={isSaving}>
          {isSaving ? "Salvando..." : "Criar janela"}
        </button>
      </div>

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-4">Recorrência operacional</h2>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="stencil-text text-xs">Janela alvo</span>
            <select
              className="field"
              value={selectedGenerateWindowId}
              onChange={(e) => setSelectedGenerateWindowId(e.target.value)}
            >
              {windows.map((window) => (
                <option key={window.id} value={window.id}>
                  {formatWindowLabel(window)} {window.active ? "(ativa)" : "(inativa)"}
                </option>
              ))}
            </select>
          </label>
          <button
            className="cta-button small"
            disabled={isGenerating || !selectedGenerateWindowId}
            onClick={generateRecurring}
          >
            {isGenerating ? "Gerando..." : "Gerar pedidos recorrentes (próxima janela)"}
          </button>
        </div>
        {generationResult && (
          <div className="mt-4 border-2 border-foreground bg-white p-3">
            <p className="font-black text-xs uppercase">Resultado da geração</p>
            <p className="font-bold text-xs uppercase">
              Gerados: {generationResult.generated} | Existing: {generationResult.skipped_existing}
            </p>
            <p className="font-bold text-xs uppercase">
              Pausados: {generationResult.skipped_paused} | Inválidos: {generationResult.skipped_invalid} | Capacidade: {generationResult.skipped_capacity}
            </p>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="card mb-6" style={{ borderColor: "var(--accent)" }}>
          <p className="font-bold text-sm uppercase">Erro: {errorMessage}</p>
        </div>
      )}

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-4">Janelas do bairro</h2>
        {windows.length === 0 ? (
          <p className="font-bold uppercase text-sm">Sem janelas cadastradas.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {windows.map((window) => (
              <div key={window.id} className="border-2 border-foreground bg-white p-3 flex items-center justify-between">
                <div>
                  <p className="font-black uppercase text-xs">{formatWindowLabel(window)}</p>
                  <p className="font-bold text-xs uppercase">Capacidade: {window.capacity}</p>
                </div>
                <button className="cta-button small" style={{ background: "white" }} onClick={() => toggleWindow(window)}>
                  {window.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-4">Fila por janela (7 dias)</h2>
        {queueMetrics.length === 0 ? (
          <p className="font-bold uppercase text-sm">Sem fila recente para este bairro.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Janela</th>
                  <th>Dia</th>
                  <th>Fila</th>
                  <th>Pontos</th>
                  <th>Porta</th>
                  <th>% Recorrência</th>
                </tr>
              </thead>
              <tbody>
                {queueMetrics.map((entry) => (
                  <tr key={`${entry.window_id}-${entry.scheduled_day}`}>
                    <td>{`${entry.weekday} ${entry.start_time.slice(0, 5)}-${entry.end_time.slice(0, 5)}`}</td>
                    <td>{new Date(entry.scheduled_day).toLocaleDateString("pt-BR")}</td>
                    <td>{entry.requests_count}</td>
                    <td>{entry.drop_point_count}</td>
                    <td>{entry.doorstep_count}</td>
                    <td>{Number(entry.recurring_coverage_pct || 0).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-4">Qualidade por janela (7 dias)</h2>
        {qualityMetrics.length === 0 ? (
          <p className="font-bold uppercase text-sm">Sem qualidade registrada para janelas no período.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Janela</th>
                  <th>Recibos</th>
                  <th>OK rate</th>
                  <th>Top flags</th>
                </tr>
              </thead>
              <tbody>
                {qualityMetrics.map((entry) => {
                  const window = windows.find((row) => row.id === entry.window_id);
                  return (
                    <tr key={entry.window_id}>
                      <td>{window ? formatWindowLabel(window) : entry.window_id.slice(0, 8)}</td>
                      <td>{entry.receipts_count}</td>
                      <td>{Number(entry.ok_rate || 0).toFixed(2)}%</td>
                      <td>{entry.top_flags || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="stencil-text text-lg mb-4">Assinaturas por bairro</h2>
        {subscriptions.length === 0 ? (
          <p className="font-bold uppercase text-sm">Sem assinaturas no bairro selecionado.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Dono</th>
                  <th>Escopo</th>
                  <th>Cadência</th>
                  <th>Status</th>
                  <th>Parceiro</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.profile?.display_name || entry.created_by.slice(0, 8)}</td>
                    <td>{entry.scope}</td>
                    <td>{entry.cadence}</td>
                    <td>{entry.status}</td>
                    <td>{entry.partner?.name || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card mt-6">
        <h2 className="stencil-text text-lg mb-4">Ocorrências (últimos 14 dias)</h2>
        {occurrences.length === 0 ? (
          <p className="font-bold uppercase text-sm">Sem ocorrências recentes.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Janela</th>
                  <th>Modo</th>
                  <th>Status</th>
                  <th>Request</th>
                </tr>
              </thead>
              <tbody>
                {occurrences.map((entry) => (
                  (() => {
                    const entryWindow = Array.isArray(entry.window) ? entry.window[0] : entry.window;
                    const entrySubscription = Array.isArray(entry.subscription)
                      ? entry.subscription[0]
                      : entry.subscription;
                    return (
                      <tr key={entry.id}>
                        <td>{new Date(entry.scheduled_for).toLocaleString("pt-BR")}</td>
                        <td>
                          {entryWindow
                            ? `${entryWindow.weekday} ${entryWindow.start_time.slice(0, 5)}-${entryWindow.end_time.slice(0, 5)}`
                            : entry.route_window_id.slice(0, 8)}
                        </td>
                        <td>{entrySubscription?.fulfillment_mode || "-"}</td>
                        <td>{entry.status}</td>
                        <td>{entry.request_id ? entry.request_id.slice(0, 8) : "-"}</td>
                      </tr>
                    );
                  })()
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
