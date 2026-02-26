"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ShieldOff, Scale } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { Profile } from "@/types/eco";

interface NeighborhoodOption {
  id: string;
  name: string;
  slug: string;
}

interface ProfileOption {
  user_id: string;
  display_name: string;
  neighborhood_id?: string | null;
}

interface GovernanceRoleRow {
  id: string;
  scope: "city" | "neighborhood";
  neighborhood_id?: string | null;
  role_name: "operator" | "moderator";
  active: boolean;
}

interface GovernanceTermRow {
  id: string;
  governance_role_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  status: "active" | "revoked" | "completed";
  revoked_at?: string | null;
  revoked_reason?: string | null;
  profile?: { display_name?: string | null } | null;
  role?: { role_name?: string | null; neighborhood_id?: string | null } | null;
}

interface DecisionReceiptRow {
  id: string;
  neighborhood_id: string;
  decision_date: string;
  title: string;
  summary_public: string;
  rationale_public?: string | null;
  implementation_public?: string | null;
  status: "draft" | "published" | "archived";
}

export default function AdminGovernancaClient() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const p = profile as Profile | null;
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTerm, setIsSavingTerm] = useState(false);
  const [isSavingDecision, setIsSavingDecision] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodOption[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [roles, setRoles] = useState<GovernanceRoleRow[]>([]);
  const [terms, setTerms] = useState<GovernanceTermRow[]>([]);
  const [decisions, setDecisions] = useState<DecisionReceiptRow[]>([]);

  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState("");
  const [selectedNeighborhoodSlug, setSelectedNeighborhoodSlug] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [roleName, setRoleName] = useState<"operator" | "moderator">("moderator");
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 10));
  const [endsAt, setEndsAt] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [decisionDate, setDecisionDate] = useState(new Date().toISOString().slice(0, 10));
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionSummary, setDecisionSummary] = useState("");
  const [decisionRationale, setDecisionRationale] = useState("");
  const [decisionImplementation, setDecisionImplementation] = useState("");
  const [decisionStatus, setDecisionStatus] = useState<"draft" | "published" | "archived">("published");

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
      const neighborhoodSlug = safeNeighborhoods.find((n) => n.id === neighborhoodId)?.slug || "";
      setSelectedNeighborhoodId(neighborhoodId);
      setSelectedNeighborhoodSlug(neighborhoodSlug);
      if (!neighborhoodId) return;

      const [
        { data: profileData, error: profileError },
        { data: rolesData, error: rolesError },
        { data: termsData, error: termsError },
        { data: decisionsData, error: decisionsError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, display_name, neighborhood_id")
          .eq("neighborhood_id", neighborhoodId)
          .order("display_name", { ascending: true }),
        supabase
          .from("governance_roles")
          .select("id, scope, neighborhood_id, role_name, active")
          .eq("scope", "neighborhood")
          .eq("neighborhood_id", neighborhoodId),
        supabase
          .from("governance_terms")
          .select("id, governance_role_id, user_id, starts_at, ends_at, status, revoked_at, revoked_reason, profile:profiles(display_name), role:governance_roles(role_name, neighborhood_id)")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("decision_receipts")
          .select("id, neighborhood_id, decision_date, title, summary_public, rationale_public, implementation_public, status")
          .eq("neighborhood_id", neighborhoodId)
          .order("decision_date", { ascending: false })
          .limit(50),
      ]);
      if (profileError) throw profileError;
      if (rolesError) throw rolesError;
      if (termsError) throw termsError;
      if (decisionsError) throw decisionsError;
      const safeProfiles = (profileData || []) as ProfileOption[];
      setProfiles(safeProfiles);
      setSelectedUserId((current) => current || safeProfiles[0]?.user_id || "");
      setRoles((rolesData || []) as GovernanceRoleRow[]);
      setTerms(
        ((termsData || []) as GovernanceTermRow[]).filter((row) => {
          const roleData = Array.isArray(row.role) ? row.role[0] : row.role;
          return roleData?.neighborhood_id === neighborhoodId;
        }),
      );
      setDecisions((decisionsData || []) as DecisionReceiptRow[]);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedNeighborhoodId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData, user?.id]);

  const assignRoleTerm = async () => {
    if (!selectedNeighborhoodId || !selectedUserId) return;
    setIsSavingTerm(true);
    setErrorMessage(null);
    try {
      const { data: roleRow, error: roleError } = await supabase
        .from("governance_roles")
        .upsert(
          {
            scope: "neighborhood",
            neighborhood_id: selectedNeighborhoodId,
            role_name: roleName,
            active: true,
          },
          { onConflict: "neighborhood_id,role_name" },
        )
        .select("id")
        .single();
      if (roleError || !roleRow) throw roleError || new Error("Falha ao registrar papel de governança.");

      const { error: termError } = await supabase.from("governance_terms").insert({
        governance_role_id: (roleRow as { id: string }).id,
        user_id: selectedUserId,
        starts_at: startsAt,
        ends_at: endsAt,
        status: "active",
        created_by: user?.id || null,
      });
      if (termError) throw termError;
      await loadData();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSavingTerm(false);
    }
  };

  const revokeTerm = async (termId: string) => {
    setErrorMessage(null);
    const { error } = await supabase
      .from("governance_terms")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_reason: "Revogado no painel de governança",
      })
      .eq("id", termId);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await loadData();
  };

  const createDecisionReceipt = async () => {
    if (!selectedNeighborhoodId || !decisionTitle.trim() || !decisionSummary.trim()) return;
    setIsSavingDecision(true);
    setErrorMessage(null);
    try {
      const activeTerm = terms.find((row) => row.status === "active");
      const { error } = await supabase.from("decision_receipts").insert({
        neighborhood_id: selectedNeighborhoodId,
        governance_term_id: activeTerm?.id || null,
        decision_date: decisionDate,
        title: decisionTitle.trim(),
        summary_public: decisionSummary.trim(),
        rationale_public: decisionRationale.trim() || null,
        implementation_public: decisionImplementation.trim() || null,
        status: decisionStatus,
        created_by: user?.id || null,
      });
      if (error) throw error;
      setDecisionTitle("");
      setDecisionSummary("");
      setDecisionRationale("");
      setDecisionImplementation("");
      await loadData();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSavingDecision(false);
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
        <p className="font-bold uppercase">Somente operador administra governança.</p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up pb-12">
      <h1 className="stencil-text mb-6" style={{ fontSize: "2.2rem", background: "var(--primary)", padding: "0 10px", border: "2px solid var(--foreground)", width: "fit-content" }}>
        ADMIN / GOVERNANÇA
      </h1>

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-4 flex items-center gap-2">
          <Scale size={18} /> Papéis rotativos por bairro
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3">
          <select className="field" value={selectedNeighborhoodId} onChange={(e) => setSelectedNeighborhoodId(e.target.value)}>
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
          <select className="field" value={roleName} onChange={(e) => setRoleName(e.target.value as "operator" | "moderator")}>
            <option value="moderator">moderator</option>
            <option value="operator">operator</option>
          </select>
          <select className="field" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
            {profiles.map((profileRow) => (
              <option key={profileRow.user_id} value={profileRow.user_id}>{profileRow.display_name || profileRow.user_id.slice(0, 8)}</option>
            ))}
          </select>
          <input type="date" className="field" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <input type="date" className="field" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          <button className="cta-button small" onClick={assignRoleTerm} disabled={isSavingTerm}>
            {isSavingTerm ? "Salvando..." : "Atribuir mandato"}
          </button>
        </div>
        <a href={selectedNeighborhoodSlug ? `/bairros/${selectedNeighborhoodSlug}/decisoes` : "#"} className="cta-button small">
          Ver recibos públicos de decisão
        </a>
      </div>

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-4">Histórico de mandatos</h2>
        {terms.length === 0 ? (
          <p className="font-bold text-xs uppercase">Sem mandatos registrados.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Papel</th>
                  <th>Pessoa</th>
                  <th>Período</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((term) => {
                  const roleData = Array.isArray(term.role) ? term.role[0] : term.role;
                  const profileData = Array.isArray(term.profile) ? term.profile[0] : term.profile;
                  return (
                    <tr key={term.id}>
                      <td>{roleData?.role_name || "-"}</td>
                      <td>{profileData?.display_name || term.user_id.slice(0, 8)}</td>
                      <td>{new Date(term.starts_at).toLocaleDateString("pt-BR")} - {new Date(term.ends_at).toLocaleDateString("pt-BR")}</td>
                      <td>{term.status}</td>
                      <td>
                        {term.status === "active" ? (
                          <button className="cta-button small" style={{ background: "white" }} onClick={() => revokeTerm(term.id)}>
                            Revogar
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="stencil-text text-lg mb-4">Recibo da decisão (sanitizado)</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <input type="date" className="field" value={decisionDate} onChange={(e) => setDecisionDate(e.target.value)} />
          <select className="field" value={decisionStatus} onChange={(e) => setDecisionStatus(e.target.value as "draft" | "published" | "archived")}>
            <option value="published">published</option>
            <option value="draft">draft</option>
            <option value="archived">archived</option>
          </select>
          <input className="field md:col-span-2" value={decisionTitle} onChange={(e) => setDecisionTitle(e.target.value)} placeholder="Título da decisão" />
        </div>
        <textarea className="field mb-3" rows={2} value={decisionSummary} onChange={(e) => setDecisionSummary(e.target.value)} placeholder="Resumo público (sem PII)" />
        <textarea className="field mb-3" rows={2} value={decisionRationale} onChange={(e) => setDecisionRationale(e.target.value)} placeholder="Justificativa pública (opcional)" />
        <textarea className="field mb-3" rows={2} value={decisionImplementation} onChange={(e) => setDecisionImplementation(e.target.value)} placeholder="Implementação pública (opcional)" />
        <button className="cta-button small" onClick={createDecisionReceipt} disabled={isSavingDecision}>
          {isSavingDecision ? "Publicando..." : "Salvar recibo de decisão"}
        </button>

        {decisions.length > 0 && (
          <div className="table-wrap mt-4">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Título</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.decision_date).toLocaleDateString("pt-BR")}</td>
                    <td>{row.title}</td>
                    <td>{row.status}</td>
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
