"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, ShieldOff } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { AnchorCommitment, Profile } from "@/types/eco";

interface PartnerOption {
  id: string;
  name: string;
  neighborhood_id?: string | null;
}

interface CommitmentRow extends AnchorCommitment {
  partner?: { name: string | null; neighborhood_id?: string | null } | null;
}

export default function AdminAncorasClient() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const p = profile as Profile | null;
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [rows, setRows] = useState<CommitmentRow[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [level, setLevel] = useState<"bronze" | "prata" | "ouro">("bronze");
  const [status, setStatus] = useState<"draft" | "active" | "paused" | "closed">("active");
  const [monthlyCommitmentText, setMonthlyCommitmentText] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [{ data: partnerData, error: partnerError }, { data: commitmentData, error: commitmentError }] = await Promise.all([
        supabase.from("partners").select("id, name, neighborhood_id").order("name", { ascending: true }),
        supabase
          .from("anchor_commitments")
          .select("*, partner:partners(name, neighborhood_id)")
          .order("created_at", { ascending: false }),
      ]);
      if (partnerError) throw partnerError;
      if (commitmentError) throw commitmentError;
      const safePartners = (partnerData || []) as PartnerOption[];
      setPartners(safePartners);
      setRows((commitmentData || []) as CommitmentRow[]);
      setPartnerId((current) => current || safePartners[0]?.id || "");
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData, user?.id]);

  const createCommitment = async () => {
    if (!partnerId || !monthlyCommitmentText.trim()) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.from("anchor_commitments").insert({
        partner_id: partnerId,
        level,
        monthly_commitment_text: monthlyCommitmentText.trim(),
        status,
      });
      if (error) throw error;
      setMonthlyCommitmentText("");
      await loadData();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (id: string, nextStatus: "draft" | "active" | "paused" | "closed") => {
    setErrorMessage(null);
    const { error } = await supabase.from("anchor_commitments").update({ status: nextStatus }).eq("id", id);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await loadData();
  };

  const exportCsv = async () => {
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from("v_anchor_commitments_export")
        .select("partner_name, level, monthly_commitment_text, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const lines = ["partner_name,level,monthly_commitment_text,status,created_at"];
      (data || []).forEach((row) => {
        const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        lines.push([esc((row as { partner_name?: string }).partner_name), esc((row as { level?: string }).level), esc((row as { monthly_commitment_text?: string }).monthly_commitment_text), esc((row as { status?: string }).status), esc((row as { created_at?: string }).created_at)].join(","));
      });
      const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eco-anchor-commitments-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
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
        <p className="font-bold uppercase">Somente operador administra âncoras.</p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up pb-12">
      <h1 className="stencil-text mb-6" style={{ fontSize: "2.2rem", background: "var(--primary)", padding: "0 10px", border: "2px solid var(--foreground)", width: "fit-content" }}>
        ADMIN / ÂNCORAS
      </h1>

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-4">Registrar compromisso mensal</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <select className="field" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>{partner.name}</option>
            ))}
          </select>
          <select className="field" value={level} onChange={(e) => setLevel(e.target.value as "bronze" | "prata" | "ouro")}>
            <option value="bronze">Bronze</option>
            <option value="prata">Prata</option>
            <option value="ouro">Ouro</option>
          </select>
          <select className="field" value={status} onChange={(e) => setStatus(e.target.value as "draft" | "active" | "paused" | "closed")}>
            <option value="active">Ativo</option>
            <option value="draft">Draft</option>
            <option value="paused">Pausado</option>
            <option value="closed">Fechado</option>
          </select>
          <button className="cta-button small" onClick={createCommitment} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Criar compromisso"}
          </button>
        </div>
        <textarea
          className="field"
          value={monthlyCommitmentText}
          onChange={(e) => setMonthlyCommitmentText(e.target.value)}
          placeholder="Ex.: 4 coletas mensais por janela fixa + apoio de separação no ponto"
          rows={3}
        />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="stencil-text text-lg">Compromissos cadastrados</h2>
          <button className="cta-button small" onClick={exportCsv}>
            <Download size={16} /> Exportar CSV
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="font-bold text-xs uppercase">Sem compromissos cadastrados.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Parceiro</th>
                  <th>Nível</th>
                  <th>Status</th>
                  <th>Compromisso</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.partner?.name || row.partner_id.slice(0, 8)}</td>
                    <td>{row.level}</td>
                    <td>{row.status}</td>
                    <td>{row.monthly_commitment_text}</td>
                    <td>
                      <select
                        className="field"
                        value={row.status}
                        onChange={(e) => updateStatus(row.id, e.target.value as "draft" | "active" | "paused" | "closed")}
                      >
                        <option value="draft">draft</option>
                        <option value="active">active</option>
                        <option value="paused">paused</option>
                        <option value="closed">closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
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
