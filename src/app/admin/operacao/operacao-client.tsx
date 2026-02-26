"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShieldOff } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { Profile } from "@/types/eco";

interface NeighborhoodOption {
  id: string;
  name: string;
  slug: string;
}

interface ChecklistRow {
  id: string;
  neighborhood_id: string;
  run_date: string;
  generated_recurring: boolean;
  operated_queue: boolean;
  closed_batch: boolean;
  published_transparency: boolean;
  counts?: Record<string, number> | null;
  notes?: string | null;
}

export default function AdminOperacaoClient() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const p = profile as Profile | null;
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodOption[]>([]);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState("");
  const [selectedNeighborhoodSlug, setSelectedNeighborhoodSlug] = useState("");
  const [runDate, setRunDate] = useState(new Date().toISOString().slice(0, 10));
  const [generatedRecurring, setGeneratedRecurring] = useState(false);
  const [operatedQueue, setOperatedQueue] = useState(false);
  const [closedBatch, setClosedBatch] = useState(false);
  const [publishedTransparency, setPublishedTransparency] = useState(false);
  const [notes, setNotes] = useState("");
  const [recentRuns, setRecentRuns] = useState<ChecklistRow[]>([]);

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
      const nextNeighborhood = selectedNeighborhoodId || safeNeighborhoods[0]?.id || "";
      const nextSlug = safeNeighborhoods.find((n) => n.id === nextNeighborhood)?.slug || "";
      setSelectedNeighborhoodId(nextNeighborhood);
      setSelectedNeighborhoodSlug(nextSlug);

      if (!nextNeighborhood) return;
      const { data: runsData, error: runsError } = await supabase
        .from("pilot_checklist_runs")
        .select("*")
        .eq("neighborhood_id", nextNeighborhood)
        .order("run_date", { ascending: false })
        .limit(14);
      if (runsError) throw runsError;
      setRecentRuns((runsData || []) as ChecklistRow[]);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedNeighborhoodId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData, user?.id]);

  const saveChecklist = async () => {
    if (!selectedNeighborhoodId || !user) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.from("pilot_checklist_runs").upsert(
        {
          neighborhood_id: selectedNeighborhoodId,
          run_date: runDate,
          generated_recurring: generatedRecurring,
          operated_queue: operatedQueue,
          closed_batch: closedBatch,
          published_transparency: publishedTransparency,
          notes: notes.trim() || null,
          counts: {
            completed_steps: [generatedRecurring, operatedQueue, closedBatch, publishedTransparency].filter(Boolean).length,
            total_steps: 4,
          },
          created_by: user.id,
        },
        { onConflict: "neighborhood_id,run_date" },
      );
      if (error) throw error;
      await loadData();
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

  if (!user || !p || p.role !== "operator") {
    return (
      <div className="card text-center py-12 animate-slide-up">
        <ShieldOff size={48} className="mx-auto mb-4 text-accent" />
        <h2 className="stencil-text mb-3">Acesso Restrito</h2>
        <p className="font-bold uppercase">Somente operador executa o ritual operacional.</p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up pb-12">
      <h1 className="stencil-text mb-6" style={{ fontSize: "2.2rem", background: "var(--primary)", padding: "0 10px", border: "2px solid var(--foreground)", width: "fit-content" }}>
        ADMIN / OPERAÇÃO
      </h1>

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-4 flex items-center gap-2">
          <CheckCircle2 size={18} /> Checklist do Dia
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <select className="field" value={selectedNeighborhoodId} onChange={(e) => setSelectedNeighborhoodId(e.target.value)}>
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
          <input type="date" className="field" value={runDate} onChange={(e) => setRunDate(e.target.value)} />
          <a className="cta-button small" href={selectedNeighborhoodSlug ? `/bairros/${selectedNeighborhoodSlug}/transparencia` : "#"}>
            Abrir transparência semanal
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <label className="flex items-center gap-2"><input type="checkbox" checked={generatedRecurring} onChange={(e) => setGeneratedRecurring(e.target.checked)} /><span className="font-black text-xs uppercase">1. Gerar recorrentes</span></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={operatedQueue} onChange={(e) => setOperatedQueue(e.target.checked)} /><span className="font-black text-xs uppercase">2. Operar fila</span></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={closedBatch} onChange={(e) => setClosedBatch(e.target.checked)} /><span className="font-black text-xs uppercase">3. Fechar lote</span></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={publishedTransparency} onChange={(e) => setPublishedTransparency(e.target.checked)} /><span className="font-black text-xs uppercase">4. Publicar transparência</span></label>
        </div>
        <input className="field mb-3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas do ritual do dia (sem PII)" />
        <button className="cta-button small" onClick={saveChecklist} disabled={isSaving}>
          {isSaving ? "Salvando..." : "Salvar checklist"}
        </button>
      </div>

      <div className="card">
        <h2 className="stencil-text text-lg mb-4">Últimos 14 dias</h2>
        {recentRuns.length === 0 ? (
          <p className="font-bold text-xs uppercase">Sem execução recente.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Concluído</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((row) => {
                  const completed = [row.generated_recurring, row.operated_queue, row.closed_batch, row.published_transparency].filter(Boolean).length;
                  return (
                    <tr key={row.id}>
                      <td>{new Date(row.run_date).toLocaleDateString("pt-BR")}</td>
                      <td>{completed}/4</td>
                      <td>{row.notes || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="card mt-6" style={{ borderColor: "var(--accent)" }}>
          <p className="font-bold text-xs uppercase">Erro: {errorMessage}</p>
        </div>
      )}
    </div>
  );
}
