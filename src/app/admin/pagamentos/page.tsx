"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, ShieldOff, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";

type AdminTab = "reconciliation" | "adjustments";

interface PayoutPeriod {
  id: string;
  period_start: string;
  period_end: string;
  status: "open" | "closed" | "paid";
  created_at: string;
  closed_at: string | null;
  paid_at: string | null;
}

interface UserProfileSummary {
  user_id: string;
  display_name: string | null;
  role: "resident" | "cooperado" | "operator" | "moderator";
}

interface LedgerRow {
  cooperado_id: string;
  total_cents: number;
  receipt_id: string;
}

interface AdjustmentRow {
  id: string;
  cooperado_id: string;
  period_id: string;
  amount_cents: number;
  reason: string;
  created_by: string;
  created_at: string;
}

interface PayoutRow {
  cooperado_id: string;
  period_id: string;
  total_cents: number;
  status: "pending" | "paid";
  payout_reference: string | null;
}

interface ReconciliationRow {
  cooperado_id: string;
  cooperado_name: string;
  receipts_count: number;
  ledger_sum: number;
  adjustments_sum: number;
  payout_total: number;
}

const formatMoney = (cents: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const labelForPeriod = (period: PayoutPeriod): string =>
  `${new Date(period.period_start).toLocaleDateString("pt-BR")} -> ${new Date(period.period_end).toLocaleDateString("pt-BR")} (${period.status.toUpperCase()})`;

export default function AdminPagamentosPage() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<AdminTab>("reconciliation");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [periods, setPeriods] = useState<PayoutPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

  const [profiles, setProfiles] = useState<UserProfileSummary[]>([]);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [adjustmentRows, setAdjustmentRows] = useState<AdjustmentRow[]>([]);
  const [payoutRows, setPayoutRows] = useState<PayoutRow[]>([]);

  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");
  const [payReference, setPayReference] = useState("DRYRUN");

  const [adjustCooperadoId, setAdjustCooperadoId] = useState("");
  const [adjustPeriodId, setAdjustPeriodId] = useState("");
  const [adjustAmountCents, setAdjustAmountCents] = useState("-100");
  const [adjustReason, setAdjustReason] = useState("Ajuste operacional");

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  );

  const cooperadoOptions = useMemo(
    () => profiles.filter((entry) => entry.role === "cooperado"),
    [profiles],
  );

  const profileNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of profiles) {
      map.set(item.user_id, item.display_name || item.user_id.slice(0, 8));
    }
    return map;
  }, [profiles]);

  const totals = useMemo(() => {
    const ledger = ledgerRows.reduce((sum, row) => sum + row.total_cents, 0);
    const adjustments = adjustmentRows.reduce((sum, row) => sum + row.amount_cents, 0);
    const payouts = payoutRows.reduce((sum, row) => sum + row.total_cents, 0);
    const diff = ledger + adjustments - payouts;
    return { ledger, adjustments, payouts, diff };
  }, [ledgerRows, adjustmentRows, payoutRows]);

  const reconciliationRows = useMemo(() => {
    const byCooperado = new Map<string, ReconciliationRow>();

    const ensure = (cooperadoId: string): ReconciliationRow => {
      const existing = byCooperado.get(cooperadoId);
      if (existing) return existing;
      const created: ReconciliationRow = {
        cooperado_id: cooperadoId,
        cooperado_name: profileNameById.get(cooperadoId) || cooperadoId.slice(0, 8),
        receipts_count: 0,
        ledger_sum: 0,
        adjustments_sum: 0,
        payout_total: 0,
      };
      byCooperado.set(cooperadoId, created);
      return created;
    };

    for (const row of ledgerRows) {
      const entry = ensure(row.cooperado_id);
      entry.receipts_count += 1;
      entry.ledger_sum += row.total_cents;
    }

    for (const row of adjustmentRows) {
      const entry = ensure(row.cooperado_id);
      entry.adjustments_sum += row.amount_cents;
    }

    for (const row of payoutRows) {
      const entry = ensure(row.cooperado_id);
      entry.payout_total += row.total_cents;
    }

    return Array.from(byCooperado.values()).sort((a, b) => b.payout_total - a.payout_total);
  }, [ledgerRows, adjustmentRows, payoutRows, profileNameById]);

  const loadBase = useCallback(async () => {
    const [{ data: periodData, error: periodError }, { data: profileData, error: profileError }] =
      await Promise.all([
        supabase.from("coop_payout_periods").select("*").order("period_start", { ascending: false }),
        supabase
          .from("profiles")
          .select("user_id, display_name, role")
          .in("role", ["cooperado", "operator"])
          .order("display_name", { ascending: true }),
      ]);

    if (periodError) throw periodError;
    if (profileError) throw profileError;

    const safePeriods = (periodData || []) as PayoutPeriod[];
    const safeProfiles = (profileData || []) as UserProfileSummary[];

    setPeriods(safePeriods);
    setProfiles(safeProfiles);

    if (!selectedPeriodId && safePeriods.length > 0) {
      setSelectedPeriodId(safePeriods[0].id);
      setAdjustPeriodId(safePeriods[0].id);
    }

    if (!adjustCooperadoId && safeProfiles.length > 0) {
      const firstCooperado = safeProfiles.find((item) => item.role === "cooperado");
      if (firstCooperado) setAdjustCooperadoId(firstCooperado.user_id);
    }
  }, [supabase, selectedPeriodId, adjustCooperadoId]);

  const loadSelectedPeriodData = useCallback(async () => {
    if (!selectedPeriod) {
      setLedgerRows([]);
      setAdjustmentRows([]);
      setPayoutRows([]);
      return;
    }

    const startIso = `${selectedPeriod.period_start}T00:00:00.000Z`;
    const endIso = `${selectedPeriod.period_end}T23:59:59.999Z`;

    const [
      { data: ledgerData, error: ledgerError },
      { data: adjustmentData, error: adjustmentError },
      { data: payoutData, error: payoutError },
    ] = await Promise.all([
      supabase
        .from("coop_earnings_ledger")
        .select("cooperado_id, total_cents, receipt_id")
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      supabase
        .from("coop_earning_adjustments")
        .select("id, cooperado_id, period_id, amount_cents, reason, created_by, created_at")
        .eq("period_id", selectedPeriod.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("coop_payouts")
        .select("cooperado_id, period_id, total_cents, status, payout_reference")
        .eq("period_id", selectedPeriod.id),
    ]);

    if (ledgerError) throw ledgerError;
    if (adjustmentError) throw adjustmentError;
    if (payoutError) throw payoutError;

    setLedgerRows((ledgerData || []) as LedgerRow[]);
    setAdjustmentRows((adjustmentData || []) as AdjustmentRow[]);
    setPayoutRows((payoutData || []) as PayoutRow[]);
  }, [supabase, selectedPeriod]);

  const refresh = useCallback(async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      await loadBase();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [loadBase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const run = async () => {
      if (!selectedPeriodId) return;
      setErrorMessage(null);
      try {
        await loadSelectedPeriodData();
      } catch (error) {
        setErrorMessage((error as Error).message);
      }
    };
    run();
  }, [selectedPeriodId, loadSelectedPeriodData]);

  const runAction = async (action: () => Promise<void>) => {
    setErrorMessage(null);
    setIsSaving(true);
    try {
      await action();
      await loadBase();
      await loadSelectedPeriodData();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const createPeriod = () =>
    runAction(async () => {
      if (!newPeriodStart || !newPeriodEnd) throw new Error("Informe inicio e fim do periodo.");
      const { data, error } = await supabase.rpc("rpc_create_payout_period", {
        period_start: newPeriodStart,
        period_end: newPeriodEnd,
      });
      if (error) throw error;
      if (typeof data === "string") {
        setSelectedPeriodId(data);
        setAdjustPeriodId(data);
      }
    });

  const closePeriod = () =>
    runAction(async () => {
      if (!selectedPeriodId) throw new Error("Selecione um periodo.");
      const { error } = await supabase.rpc("rpc_close_payout_period", {
        period_id: selectedPeriodId,
      });
      if (error) throw error;
    });

  const markPaid = () =>
    runAction(async () => {
      if (!selectedPeriodId) throw new Error("Selecione um periodo.");
      const { error } = await supabase.rpc("rpc_mark_payout_paid", {
        period_id: selectedPeriodId,
        payout_reference: payReference || "MANUAL",
      });
      if (error) throw error;
    });

  const exportCsv = async () => {
    if (!selectedPeriodId) {
      setErrorMessage("Selecione um periodo.");
      return;
    }

    setErrorMessage(null);
    setIsExporting(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session?.access_token) throw new Error("Sessao invalida para exportacao.");

      const response = await fetch(`/api/admin/payouts/export?period_id=${selectedPeriodId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Falha ao exportar CSV (${response.status}).`);
      }

      const blob = await response.blob();
      const periodForFile = selectedPeriod || periods.find((period) => period.id === selectedPeriodId) || null;
      const fileStart = periodForFile?.period_start?.replaceAll("-", "") || "periodo";
      const fileEnd = periodForFile?.period_end?.replaceAll("-", "") || "periodo";
      const fileName = `payouts_${fileStart}_${fileEnd}.csv`;

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const addAdjustment = () =>
    runAction(async () => {
      if (!adjustCooperadoId) throw new Error("Selecione um cooperado.");
      if (!adjustPeriodId) throw new Error("Selecione um periodo.");
      const parsedAmount = Number(adjustAmountCents);
      if (!Number.isInteger(parsedAmount)) throw new Error("Valor em centavos invalido.");
      if (!adjustReason.trim()) throw new Error("Motivo e obrigatorio.");

      const { error } = await supabase.rpc("rpc_add_adjustment", {
        cooperado_id: adjustCooperadoId,
        period_id: adjustPeriodId,
        amount_cents: parsedAmount,
        reason: adjustReason.trim(),
      });
      if (error) throw error;
    });

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-primary" size={44} />
      </div>
    );
  }

  if (!user || !profile || profile.role !== "operator") {
    return (
      <div className="card text-center py-12 animate-slide-up">
        <ShieldOff size={48} className="mx-auto mb-4 text-accent" />
        <h2 className="stencil-text mb-3">Acesso Restrito</h2>
        <p className="font-bold uppercase">Apenas operador pode abrir/fechar pagamentos e criar ajustes.</p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up pb-12">
      <h1
        className="stencil-text mb-6"
        style={{
          fontSize: "2.25rem",
          background: "var(--primary)",
          padding: "0 10px",
          border: "2px solid var(--foreground)",
          width: "fit-content",
        }}
      >
        ADMIN / PAGAMENTOS
      </h1>

      <div className="card">
        <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("reconciliation")}
              className={`cta-button ${activeTab === "reconciliation" ? "" : "tab-muted"}`}
              style={{ padding: "0.5rem 0.9rem", boxShadow: "none" }}
            >
              Reconciliação
            </button>
            <button
              onClick={() => setActiveTab("adjustments")}
              className={`cta-button ${activeTab === "adjustments" ? "" : "tab-muted"}`}
              style={{ padding: "0.5rem 0.9rem", boxShadow: "none" }}
            >
              Ajustes
            </button>
          </div>
          <button
            onClick={refresh}
            disabled={isSaving}
            className="cta-button"
            style={{ padding: "0.5rem 0.9rem", boxShadow: "none", background: "white" }}
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <label className="flex flex-col gap-1">
            <span className="stencil-text text-xs">Período ativo</span>
            <select
              value={selectedPeriodId}
              onChange={(event) => {
                setSelectedPeriodId(event.target.value);
                if (!adjustPeriodId) setAdjustPeriodId(event.target.value);
              }}
              className="field"
            >
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {labelForPeriod(period)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="stencil-text text-xs">Novo período (início)</span>
            <input
              type="date"
              className="field"
              value={newPeriodStart}
              onChange={(event) => setNewPeriodStart(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="stencil-text text-xs">Novo período (fim)</span>
            <input
              type="date"
              className="field"
              value={newPeriodEnd}
              onChange={(event) => setNewPeriodEnd(event.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={createPeriod} disabled={isSaving} className="cta-button small">
            Criar período
          </button>
          <button onClick={closePeriod} disabled={isSaving || !selectedPeriodId} className="cta-button small">
            Fechar período
          </button>
          <input
            value={payReference}
            onChange={(event) => setPayReference(event.target.value)}
            className="field"
            style={{ maxWidth: "180px" }}
            placeholder="payout_reference"
          />
          <button onClick={markPaid} disabled={isSaving || !selectedPeriodId} className="cta-button small">
            Marcar pago
          </button>
          <button
            onClick={exportCsv}
            disabled={isSaving || isExporting || !selectedPeriodId}
            className="cta-button small"
            style={{ background: "white" }}
          >
            {isExporting ? "Exportando..." : "Exportar CSV"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <p className="font-bold text-sm uppercase">Erro: {errorMessage}</p>
        </div>
      )}

      {activeTab === "reconciliation" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
            <div className="card metric">
              <span className="stencil-text text-xs">Total ledger</span>
              <strong>{formatMoney(totals.ledger)}</strong>
            </div>
            <div className="card metric">
              <span className="stencil-text text-xs">Total ajustes</span>
              <strong>{formatMoney(totals.adjustments)}</strong>
            </div>
            <div className="card metric">
              <span className="stencil-text text-xs">Total payouts</span>
              <strong>{formatMoney(totals.payouts)}</strong>
            </div>
            <div className="card metric">
              <span className="stencil-text text-xs">Diferença</span>
              <strong style={{ color: totals.diff === 0 ? "#166534" : "#991b1b" }}>
                {formatMoney(totals.diff)}
              </strong>
            </div>
          </div>

          <div className="card">
            <h2 className="stencil-text text-lg mb-4 flex items-center gap-2">
              <Wallet size={20} /> Reconciliação por cooperado
            </h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cooperado</th>
                    <th>Receipts</th>
                    <th>Ledger</th>
                    <th>Ajustes</th>
                    <th>Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliationRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty">
                        Nenhum lançamento para o período selecionado.
                      </td>
                    </tr>
                  ) : (
                    reconciliationRows.map((row) => (
                      <tr key={row.cooperado_id}>
                        <td>{row.cooperado_name}</td>
                        <td>{row.receipts_count}</td>
                        <td>{formatMoney(row.ledger_sum)}</td>
                        <td>{formatMoney(row.adjustments_sum)}</td>
                        <td>{formatMoney(row.payout_total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "adjustments" && (
        <>
          <div className="card">
            <h2 className="stencil-text text-lg mb-4">Novo ajuste auditável</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <label className="flex flex-col gap-1">
                <span className="stencil-text text-xs">Cooperado</span>
                <select
                  value={adjustCooperadoId}
                  onChange={(event) => setAdjustCooperadoId(event.target.value)}
                  className="field"
                >
                  <option value="">Selecione</option>
                  {cooperadoOptions.map((item) => (
                    <option key={item.user_id} value={item.user_id}>
                      {item.display_name || item.user_id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="stencil-text text-xs">Período</span>
                <select
                  value={adjustPeriodId}
                  onChange={(event) => setAdjustPeriodId(event.target.value)}
                  className="field"
                >
                  <option value="">Selecione</option>
                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {labelForPeriod(period)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="stencil-text text-xs">Valor (centavos, +/-)</span>
                <input
                  type="number"
                  className="field"
                  value={adjustAmountCents}
                  onChange={(event) => setAdjustAmountCents(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="stencil-text text-xs">Motivo</span>
                <input
                  type="text"
                  className="field"
                  value={adjustReason}
                  onChange={(event) => setAdjustReason(event.target.value)}
                  placeholder="Ex.: correção operacional"
                />
              </label>
            </div>
            <button onClick={addAdjustment} disabled={isSaving} className="cta-button small">
              Gravar ajuste
            </button>
          </div>

          <div className="card">
            <h2 className="stencil-text text-lg mb-4">Audit log de ajustes</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Cooperado</th>
                    <th>Valor</th>
                    <th>Motivo</th>
                    <th>Criado por</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustmentRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty">
                        Sem ajustes para o período selecionado.
                      </td>
                    </tr>
                  ) : (
                    adjustmentRows.map((row) => (
                      <tr key={row.id}>
                        <td>{new Date(row.created_at).toLocaleString("pt-BR")}</td>
                        <td>{profileNameById.get(row.cooperado_id) || row.cooperado_id.slice(0, 8)}</td>
                        <td>{formatMoney(row.amount_cents)}</td>
                        <td>{row.reason}</td>
                        <td>{profileNameById.get(row.created_by) || row.created_by.slice(0, 8)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .grid {
          display: grid;
        }
        .grid-cols-1 {
          grid-template-columns: repeat(1, minmax(0, 1fr));
        }
        @media (min-width: 768px) {
          .md\\:grid-cols-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .md\\:grid-cols-3 {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .md\\:grid-cols-4 {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        .gap-1 {
          gap: 0.25rem;
        }
        .gap-2 {
          gap: 0.5rem;
        }
        .gap-3 {
          gap: 0.75rem;
        }
        .mb-3 {
          margin-bottom: 0.75rem;
        }
        .mb-4 {
          margin-bottom: 1rem;
        }
        .mb-6 {
          margin-bottom: 1.5rem;
        }
        .items-center {
          align-items: center;
        }
        .justify-between {
          justify-content: space-between;
        }
        .flex {
          display: flex;
        }
        .flex-col {
          flex-direction: column;
        }
        .flex-wrap {
          flex-wrap: wrap;
        }
        .field {
          border: 2px solid var(--foreground);
          background: white;
          padding: 0.6rem 0.7rem;
          font-weight: 700;
        }
        .cta-button.small {
          padding: 0.6rem 0.8rem;
          box-shadow: none;
          font-size: 0.75rem;
          gap: 0.4rem;
        }
        .tab-muted {
          background: #fff;
        }
        .metric {
          margin-bottom: 0;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .metric strong {
          font-size: 1.25rem;
        }
        .table-wrap {
          overflow-x: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th,
        td {
          border: 1px solid var(--foreground);
          padding: 0.55rem;
          text-align: left;
          font-size: 0.84rem;
        }
        th {
          background: var(--muted);
          text-transform: uppercase;
          font-size: 0.7rem;
          letter-spacing: 0.05em;
        }
        .empty {
          text-align: center;
          font-weight: 700;
          color: #555;
        }
        .text-xs {
          font-size: 0.75rem;
        }
      `}</style>
    </div>
  );
}
