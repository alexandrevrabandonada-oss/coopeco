"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ShieldOff, Target } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { Profile } from "@/types/eco";

interface NeighborhoodOption {
  id: string;
  name: string;
  slug: string;
}

interface PilotConfigRow {
  id: string;
  neighborhood_id: string;
  is_active: boolean;
  default_window_capacity: number;
  default_drop_point_target: number;
  anchor_partner_target: number;
  weekly_receipts_goal: number;
  weekly_ok_rate_goal: number;
  notes?: string | null;
}

export default function AdminPilotoClient() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const p = profile as Profile | null;
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodOption[]>([]);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState("");
  const [selectedNeighborhoodSlug, setSelectedNeighborhoodSlug] = useState("");

  const [isActive, setIsActive] = useState(true);
  const [defaultWindowCapacity, setDefaultWindowCapacity] = useState(25);
  const [defaultDropPointTarget, setDefaultDropPointTarget] = useState(3);
  const [anchorPartnerTarget, setAnchorPartnerTarget] = useState(2);
  const [weeklyReceiptsGoal, setWeeklyReceiptsGoal] = useState(100);
  const [weeklyOkRateGoal, setWeeklyOkRateGoal] = useState(80);
  const [notes, setNotes] = useState("");
  const [weekStart, setWeekStart] = useState(new Date().toISOString().slice(0, 10));
  const [goalReceipts, setGoalReceipts] = useState(100);
  const [goalOkRate, setGoalOkRate] = useState(80);
  const [goalDropPoints, setGoalDropPoints] = useState(3);
  const [goalRecurringGenerated, setGoalRecurringGenerated] = useState(20);
  const [goalNotes, setGoalNotes] = useState("");

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

      const selectedId = selectedNeighborhoodId || safeNeighborhoods[0]?.id || "";
      const selectedSlug = safeNeighborhoods.find((n) => n.id === selectedId)?.slug || "";
      setSelectedNeighborhoodId(selectedId);
      setSelectedNeighborhoodSlug(selectedSlug);
      if (!selectedId) return;

      const { data: configData, error: configError } = await supabase
        .from("pilot_configs")
        .select("*")
        .eq("neighborhood_id", selectedId)
        .maybeSingle<PilotConfigRow>();
      if (configError) throw configError;

      if (configData) {
        setIsActive(configData.is_active);
        setDefaultWindowCapacity(configData.default_window_capacity);
        setDefaultDropPointTarget(configData.default_drop_point_target);
        setAnchorPartnerTarget(configData.anchor_partner_target);
        setWeeklyReceiptsGoal(configData.weekly_receipts_goal);
        setWeeklyOkRateGoal(Number(configData.weekly_ok_rate_goal || 0));
        setNotes(configData.notes || "");
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

  const saveConfig = async () => {
    if (!selectedNeighborhoodId) return;
    setIsSavingConfig(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.from("pilot_configs").upsert(
        {
          neighborhood_id: selectedNeighborhoodId,
          is_active: isActive,
          default_window_capacity: defaultWindowCapacity,
          default_drop_point_target: defaultDropPointTarget,
          anchor_partner_target: anchorPartnerTarget,
          weekly_receipts_goal: weeklyReceiptsGoal,
          weekly_ok_rate_goal: weeklyOkRateGoal,
          notes: notes.trim() || null,
        },
        { onConflict: "neighborhood_id" },
      );
      if (error) throw error;
      await loadData();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const saveGoal = async () => {
    if (!selectedNeighborhoodId) return;
    setIsSavingGoal(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.from("pilot_goals_weekly").upsert(
        {
          neighborhood_id: selectedNeighborhoodId,
          week_start: weekStart,
          target_receipts: goalReceipts,
          target_ok_rate: goalOkRate,
          target_drop_points: goalDropPoints,
          target_recurring_generated: goalRecurringGenerated,
          notes: goalNotes.trim() || null,
        },
        { onConflict: "neighborhood_id,week_start" },
      );
      if (error) throw error;
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSavingGoal(false);
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
        <p className="font-bold uppercase">Somente operador configura o piloto.</p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up pb-12">
      <h1 className="stencil-text mb-6" style={{ fontSize: "2.2rem", background: "var(--primary)", padding: "0 10px", border: "2px solid var(--foreground)", width: "fit-content" }}>
        ADMIN / PILOTO
      </h1>

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-4 flex items-center gap-2">
          <Target size={18} /> Configuração do Bairro Piloto
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <select className="field" value={selectedNeighborhoodId} onChange={(e) => setSelectedNeighborhoodId(e.target.value)}>
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span className="font-black text-xs uppercase">Piloto ativo</span>
          </label>
          <a className="cta-button small" href={selectedNeighborhoodSlug ? `/bairros/${selectedNeighborhoodSlug}/transparencia` : "#"}>
            Ver transparência
          </a>
          <input type="number" className="field" min={1} value={defaultWindowCapacity} onChange={(e) => setDefaultWindowCapacity(Number(e.target.value))} placeholder="Capacidade padrão" />
          <input type="number" className="field" min={0} value={defaultDropPointTarget} onChange={(e) => setDefaultDropPointTarget(Number(e.target.value))} placeholder="Meta pontos ECO" />
          <input type="number" className="field" min={0} value={anchorPartnerTarget} onChange={(e) => setAnchorPartnerTarget(Number(e.target.value))} placeholder="Meta parceiros âncora" />
          <input type="number" className="field" min={0} value={weeklyReceiptsGoal} onChange={(e) => setWeeklyReceiptsGoal(Number(e.target.value))} placeholder="Meta semanal recibos" />
          <input type="number" className="field" min={0} max={100} value={weeklyOkRateGoal} onChange={(e) => setWeeklyOkRateGoal(Number(e.target.value))} placeholder="Meta OK rate %" />
          <input type="text" className="field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas operacionais (sem PII)" />
        </div>
        <button className="cta-button small" onClick={saveConfig} disabled={isSavingConfig}>
          {isSavingConfig ? "Salvando..." : "Salvar configuração piloto"}
        </button>
      </div>

      <div className="card">
        <h2 className="stencil-text text-lg mb-4">Metas Semanais</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <input type="date" className="field" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
          <input type="number" className="field" min={0} value={goalReceipts} onChange={(e) => setGoalReceipts(Number(e.target.value))} placeholder="Recibos alvo" />
          <input type="number" className="field" min={0} max={100} value={goalOkRate} onChange={(e) => setGoalOkRate(Number(e.target.value))} placeholder="OK rate alvo %" />
          <input type="number" className="field" min={0} value={goalDropPoints} onChange={(e) => setGoalDropPoints(Number(e.target.value))} placeholder="Pontos alvo" />
          <input type="number" className="field" min={0} value={goalRecurringGenerated} onChange={(e) => setGoalRecurringGenerated(Number(e.target.value))} placeholder="Recorrentes gerados alvo" />
          <input type="text" className="field" value={goalNotes} onChange={(e) => setGoalNotes(e.target.value)} placeholder="Notas da semana (sem PII)" />
        </div>
        <button className="cta-button small" onClick={saveGoal} disabled={isSavingGoal}>
          {isSavingGoal ? "Salvando..." : "Salvar meta semanal"}
        </button>
      </div>

      {errorMessage && (
        <div className="card mt-6" style={{ borderColor: "var(--accent)" }}>
          <p className="font-bold text-xs uppercase">Erro: {errorMessage}</p>
        </div>
      )}
    </div>
  );
}
