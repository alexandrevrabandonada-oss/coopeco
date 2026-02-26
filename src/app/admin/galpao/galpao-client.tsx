"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ShieldOff, Warehouse } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { Profile } from "@/types/eco";

type TriageStatus = "ok" | "misto" | "contaminado" | "rejeito" | "perigoso";

interface NeighborhoodOption {
  id: string;
  name: string;
}

interface LotRow {
  id: string;
  neighborhood_id: string;
  lot_date: string;
  status: "open" | "closed";
  title: string;
  closed_at?: string | null;
}

interface ReceiptRow {
  id: string;
  created_at: string;
  request?: { neighborhood_id?: string | null } | null;
}

interface LotReceiptRow {
  id: string;
  receipt_id: string;
  triage_status: TriageStatus;
  triage_flag?: string | null;
}

interface SummaryRow {
  lot_id: string;
  receipts_count: number;
  ok_count: number;
  misto_count: number;
  contaminado_count: number;
  rejeito_count: number;
  perigoso_count: number;
  dominant_flag?: string | null;
  education_highlight?: string | null;
}

const triageOptions: TriageStatus[] = ["ok", "misto", "contaminado", "rejeito", "perigoso"];

export default function AdminGalpaoClient() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const p = profile as Profile | null;
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodOption[]>([]);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState("");
  const [lots, setLots] = useState<LotRow[]>([]);
  const [selectedLotId, setSelectedLotId] = useState("");
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [lotReceipts, setLotReceipts] = useState<LotReceiptRow[]>([]);
  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [lotTitle, setLotTitle] = useState("Lote do dia");
  const [lotDate, setLotDate] = useState(new Date().toISOString().slice(0, 10));
  const [triageStatus, setTriageStatus] = useState<TriageStatus>("ok");
  const [triageFlag, setTriageFlag] = useState("");
  const [selectedReceiptId, setSelectedReceiptId] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const { data: neighborhoodData, error: neighborhoodError } = await supabase
        .from("neighborhoods")
        .select("id, name")
        .order("name", { ascending: true });
      if (neighborhoodError) throw neighborhoodError;
      const safeNeighborhoods = (neighborhoodData || []) as NeighborhoodOption[];
      setNeighborhoods(safeNeighborhoods);
      const neighborhoodId = selectedNeighborhoodId || safeNeighborhoods[0]?.id || "";
      setSelectedNeighborhoodId(neighborhoodId);
      if (!neighborhoodId) return;

      const { data: lotsData, error: lotsError } = await supabase
        .from("lots")
        .select("id, neighborhood_id, lot_date, status, title, closed_at")
        .eq("neighborhood_id", neighborhoodId)
        .order("lot_date", { ascending: false })
        .limit(30);
      if (lotsError) throw lotsError;
      const safeLots = (lotsData || []) as LotRow[];
      setLots(safeLots);
      const openLot = safeLots.find((row) => row.status === "open");
      const lotId = selectedLotId || openLot?.id || safeLots[0]?.id || "";
      setSelectedLotId(lotId);

      const [{ data: receiptData, error: receiptError }, { data: lotReceiptData, error: lotReceiptError }, { data: summaryData, error: summaryError }] =
        await Promise.all([
          supabase
            .from("receipts")
            .select("id, created_at, request:pickup_requests(neighborhood_id)")
            .order("created_at", { ascending: false })
            .limit(250),
          lotId
            ? supabase.from("lot_receipts").select("id, receipt_id, triage_status, triage_flag").eq("lot_id", lotId).order("created_at", { ascending: false })
            : Promise.resolve({ data: [], error: null }),
          lotId ? supabase.from("lot_triage_summary").select("*").eq("lot_id", lotId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        ]);

      if (receiptError) throw receiptError;
      if (lotReceiptError) throw lotReceiptError;
      if (summaryError) throw summaryError;

      const filteredReceipts = ((receiptData || []) as ReceiptRow[]).filter(
        (row) => row.request?.neighborhood_id === neighborhoodId,
      );
      setReceipts(filteredReceipts);
      setSelectedReceiptId((current) => current || filteredReceipts[0]?.id || "");
      setLotReceipts((lotReceiptData || []) as LotReceiptRow[]);
      setSummary((summaryData || null) as SummaryRow | null);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedLotId, selectedNeighborhoodId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData, user?.id]);

  const createLot = async () => {
    if (!selectedNeighborhoodId || !user) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.from("lots").insert({
        neighborhood_id: selectedNeighborhoodId,
        lot_date: lotDate,
        title: lotTitle.trim() || "Lote do dia",
        created_by: user.id,
      });
      if (error) throw error;
      await loadData();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const assignReceipt = async () => {
    if (!selectedLotId || !selectedReceiptId || !user) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.from("lot_receipts").upsert(
        {
          lot_id: selectedLotId,
          receipt_id: selectedReceiptId,
          triage_status: triageStatus,
          triage_flag: triageFlag.trim() || null,
          triaged_by: user.id,
        },
        { onConflict: "receipt_id" },
      );
      if (error) throw error;
      await supabase.rpc("rpc_refresh_lot_triage_summary", { p_lot_id: selectedLotId });
      await loadData();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const closeLot = async () => {
    if (!selectedLotId || !user) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase
        .from("lots")
        .update({ status: "closed", closed_at: new Date().toISOString(), closed_by: user.id })
        .eq("id", selectedLotId);
      if (error) throw error;
      await supabase.rpc("rpc_refresh_lot_triage_summary", { p_lot_id: selectedLotId });
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

  if (!user || !p || !["operator", "cooperado"].includes(p.role)) {
    return (
      <div className="card text-center py-12 animate-slide-up">
        <ShieldOff size={48} className="mx-auto mb-4 text-accent" />
        <h2 className="stencil-text mb-3">Acesso Restrito</h2>
        <p className="font-bold uppercase">Somente cooperado ou operador acessa o galpão.</p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up pb-12">
      <h1 className="stencil-text mb-6" style={{ fontSize: "2.2rem", background: "var(--primary)", padding: "0 10px", border: "2px solid var(--foreground)", width: "fit-content" }}>
        ADMIN / GALPÃO
      </h1>

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-4 flex items-center gap-2">
          <Warehouse size={18} /> Lote do dia
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <select className="field" value={selectedNeighborhoodId} onChange={(e) => setSelectedNeighborhoodId(e.target.value)}>
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
          <input className="field" value={lotTitle} onChange={(e) => setLotTitle(e.target.value)} placeholder="Título do lote" />
          <input type="date" className="field" value={lotDate} onChange={(e) => setLotDate(e.target.value)} />
          <button className="cta-button small" onClick={createLot} disabled={isSaving}>
            {isSaving ? "Criando..." : "Criar lote"}
          </button>
        </div>
        <select className="field" value={selectedLotId} onChange={(e) => setSelectedLotId(e.target.value)}>
          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {new Date(lot.lot_date).toLocaleDateString("pt-BR")} - {lot.title} ({lot.status})
            </option>
          ))}
        </select>
      </div>

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-4">Triagem rápida</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <select className="field" value={selectedReceiptId} onChange={(e) => setSelectedReceiptId(e.target.value)}>
            {receipts.map((receipt) => (
              <option key={receipt.id} value={receipt.id}>
                {receipt.id.slice(0, 8)} • {new Date(receipt.created_at).toLocaleDateString("pt-BR")}
              </option>
            ))}
          </select>
          <select className="field" value={triageStatus} onChange={(e) => setTriageStatus(e.target.value as TriageStatus)}>
            {triageOptions.map((statusOption) => (
              <option key={statusOption} value={statusOption}>{statusOption}</option>
            ))}
          </select>
          <input className="field" value={triageFlag} onChange={(e) => setTriageFlag(e.target.value)} placeholder="Flag rápida (ex: food/liquids)" />
          <button className="cta-button small" onClick={assignReceipt} disabled={isSaving || !selectedLotId || !selectedReceiptId}>
            {isSaving ? "Atribuindo..." : "Atribuir ao lote"}
          </button>
        </div>
        {lotReceipts.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Recibo</th>
                  <th>Triagem</th>
                  <th>Flag</th>
                </tr>
              </thead>
              <tbody>
                {lotReceipts.map((row) => (
                  <tr key={row.id}>
                    <td>{row.receipt_id.slice(0, 8)}</td>
                    <td>{row.triage_status}</td>
                    <td>{row.triage_flag || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="stencil-text text-lg mb-3">Fechamento sanitizado</h2>
        {summary ? (
          <div className="flex flex-col gap-2">
            <p className="font-bold text-xs uppercase">
              Recibos: {summary.receipts_count} | OK: {summary.ok_count} | Misto: {summary.misto_count} | Contaminado: {summary.contaminado_count} | Rejeito: {summary.rejeito_count} | Perigoso: {summary.perigoso_count}
            </p>
            <p className="font-bold text-xs uppercase">Flag dominante: {summary.dominant_flag || "-"}</p>
            {summary.education_highlight && (
              <p className="font-bold text-xs uppercase">Dica do bairro: {summary.education_highlight}</p>
            )}
          </div>
        ) : (
          <p className="font-bold text-xs uppercase">Sem resumo ainda para este lote.</p>
        )}
        <button className="cta-button small mt-3" onClick={closeLot} disabled={isSaving || !selectedLotId}>
          {isSaving ? "Fechando..." : "Fechar lote"}
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
