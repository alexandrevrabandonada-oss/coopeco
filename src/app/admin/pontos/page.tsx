"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { EcoDropPoint, Profile } from "@/types/eco";
import { Loader2, MapPin, ShieldOff } from "lucide-react";

interface NeighborhoodOption {
  id: string;
  name: string;
}

interface DropPointMetric7d {
  drop_point_id: string;
  drop_point_name: string;
  neighborhood_id: string;
  requests_count: number;
  receipts_count: number;
  quality_ok_count: number;
  quality_attention_count: number;
  quality_contaminated_count: number;
  ok_rate: number;
  top_flags: string;
}

interface DropPointMetricByWindow7d extends DropPointMetric7d {
  route_window_id: string | null;
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
}

const WEEKDAY_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

export default function AdminPontosPage() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const p = profile as Profile | null;
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodOption[]>([]);
  const [points, setPoints] = useState<EcoDropPoint[]>([]);
  const [metrics7d, setMetrics7d] = useState<DropPointMetric7d[]>([]);
  const [metricsByWindow7d, setMetricsByWindow7d] = useState<DropPointMetricByWindow7d[]>([]);

  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [name, setName] = useState("");
  const [addressPublic, setAddressPublic] = useState("");
  const [hours, setHours] = useState("Seg-Sex 09h-18h");
  const [acceptedMaterials, setAcceptedMaterials] = useState("paper,plastic,metal");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const { data: neighborhoodsData, error: neighborhoodsError } = await supabase
        .from("neighborhoods")
        .select("id, name")
        .order("name", { ascending: true });
      if (neighborhoodsError) throw neighborhoodsError;
      const safeNeighborhoods = (neighborhoodsData || []) as NeighborhoodOption[];
      setNeighborhoods(safeNeighborhoods);

      const selectedNeighborhood = neighborhoodId || safeNeighborhoods[0]?.id || "";
      if (!neighborhoodId && selectedNeighborhood) setNeighborhoodId(selectedNeighborhood);

      const { data: pointsData, error: pointsError } = await supabase
        .from("eco_drop_points")
        .select("*")
        .order("created_at", { ascending: false });
      if (pointsError) throw pointsError;
      const safePoints = (pointsData || []) as EcoDropPoint[];
      setPoints(safePoints);

      const { data: metricsData, error: metricsError } = await supabase
        .from("v_drop_point_metrics_7d")
        .select("*")
        .order("requests_count", { ascending: false });
      if (metricsError) throw metricsError;
      setMetrics7d((metricsData || []) as DropPointMetric7d[]);

      const { data: metricsWindowData, error: metricsWindowError } = await supabase
        .from("v_drop_point_metrics_by_window_7d")
        .select("*")
        .order("requests_count", { ascending: false });
      if (metricsWindowError) throw metricsWindowError;
      setMetricsByWindow7d((metricsWindowData || []) as DropPointMetricByWindow7d[]);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [neighborhoodId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createPoint = async () => {
    if (!neighborhoodId || !name.trim() || !addressPublic.trim() || !hours.trim()) {
      setErrorMessage("Preencha os campos obrigatórios do Ponto ECO.");
      return;
    }
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const materials = acceptedMaterials
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);

      const { error } = await supabase.from("eco_drop_points").insert({
        neighborhood_id: neighborhoodId,
        name: name.trim(),
        address_public: addressPublic.trim(),
        hours: hours.trim(),
        accepted_materials: materials,
        active: true,
      });
      if (error) throw error;

      setName("");
      setAddressPublic("");
      setHours("Seg-Sex 09h-18h");
      setAcceptedMaterials("paper,plastic,metal");
      await loadData();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const togglePoint = async (point: EcoDropPoint) => {
    setErrorMessage(null);
    try {
      const { error } = await supabase
        .from("eco_drop_points")
        .update({ active: !point.active })
        .eq("id", point.id);
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

  if (!user || !p || p.role !== "operator") {
    return (
      <div className="card text-center py-12 animate-slide-up">
        <ShieldOff size={48} className="mx-auto mb-4 text-accent" />
        <h2 className="stencil-text mb-3">Acesso Restrito</h2>
        <p className="font-bold uppercase">Somente operador administra Pontos ECO.</p>
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
        ADMIN / PONTOS
      </h1>

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-4 flex items-center gap-2">
          <MapPin size={18} /> Novo Ponto ECO
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <select className="field" value={neighborhoodId} onChange={(e) => setNeighborhoodId(e.target.value)}>
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
          <input className="field" placeholder="Nome do ponto" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="field" placeholder="Endereço público" value={addressPublic} onChange={(e) => setAddressPublic(e.target.value)} />
          <input className="field" placeholder="Horários" value={hours} onChange={(e) => setHours(e.target.value)} />
          <input
            className="field md:col-span-2"
            placeholder="Materiais aceitos (csv): paper,plastic,metal"
            value={acceptedMaterials}
            onChange={(e) => setAcceptedMaterials(e.target.value)}
          />
        </div>
        <button className="cta-button small" onClick={createPoint} disabled={isSaving}>
          {isSaving ? "Salvando..." : "Criar ponto"}
        </button>
      </div>

      {errorMessage && (
        <div className="card mb-6" style={{ borderColor: "var(--accent)" }}>
          <p className="font-bold text-sm uppercase">Erro: {errorMessage}</p>
        </div>
      )}

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-4">Painel 7 dias (por ponto)</h2>
        {metrics7d.length === 0 ? (
          <p className="font-bold uppercase text-sm">Sem dados recentes de Pontos ECO.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {metrics7d.map((row) => (
              <div key={row.drop_point_id} className="border-2 border-foreground bg-white p-3">
                <p className="font-black uppercase text-xs">{row.drop_point_name}</p>
                <p className="font-bold text-xs uppercase">
                  Requests: {row.requests_count} | Recibos: {row.receipts_count} | OK rate: {Number(row.ok_rate || 0).toFixed(2)}%
                </p>
                <p className="font-bold text-xs uppercase">
                  Qualidade: OK {row.quality_ok_count} / Atenção {row.quality_attention_count} / Contaminado {row.quality_contaminated_count}
                </p>
                <p className="font-bold text-xs uppercase">Top flags: {row.top_flags || "-"}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-4">Breakdown por janela (7 dias)</h2>
        {metricsByWindow7d.length === 0 ? (
          <p className="font-bold uppercase text-sm">Sem dados por janela nos últimos 7 dias.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {metricsByWindow7d.map((row) => (
              <div key={`${row.drop_point_id}:${row.route_window_id ?? "none"}`} className="border-2 border-foreground bg-white p-3">
                <p className="font-black uppercase text-xs">{row.drop_point_name}</p>
                <p className="font-bold text-xs uppercase">
                  Janela: {row.route_window_id && row.weekday !== null
                    ? `${WEEKDAY_LABELS[row.weekday] || row.weekday} ${row.start_time?.slice(0, 5)}-${row.end_time?.slice(0, 5)}`
                    : "ON-DEMAND/SEM JANELA"}
                </p>
                <p className="font-bold text-xs uppercase">
                  Requests: {row.requests_count} | Recibos: {row.receipts_count} | OK rate: {Number(row.ok_rate || 0).toFixed(2)}%
                </p>
                <p className="font-bold text-xs uppercase">Top flags: {row.top_flags || "-"}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="stencil-text text-lg mb-4">Pontos cadastrados</h2>
        {points.length === 0 ? (
          <p className="font-bold uppercase text-sm">Sem pontos cadastrados.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {points.map((point) => (
              <div key={point.id} className="border-2 border-foreground bg-white p-3 flex items-center justify-between">
                <div>
                  <p className="font-black uppercase text-xs">{point.name}</p>
                  <p className="font-bold text-xs uppercase">{point.address_public}</p>
                  <p className="font-bold text-xs uppercase">Horários: {point.hours}</p>
                  <p className="font-bold text-xs uppercase">
                    Requests 7d: {metrics7d.find((row) => row.drop_point_id === point.id)?.requests_count || 0}
                  </p>
                </div>
                <button className="cta-button small" style={{ background: "white" }} onClick={() => togglePoint(point)}>
                  {point.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
