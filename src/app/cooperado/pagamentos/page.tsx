"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldOff } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";

interface PayoutPeriodInfo {
  period_start: string;
  period_end: string;
}

interface PayoutRow {
  id: string;
  period_id: string;
  total_cents: number;
  status: "pending" | "paid";
  payout_reference: string | null;
  paid_at: string | null;
  created_at: string;
  coop_payout_periods: PayoutPeriodInfo[] | null;
}

interface LedgerRow {
  total_cents: number;
  created_at: string;
}

interface AdjustmentRow {
  id: string;
  period_id: string;
  amount_cents: number;
  reason: string;
  created_at: string;
}

interface PayoutBreakdown {
  payout: PayoutRow;
  ledger_sum: number;
  adjustments_sum: number;
  adjustments: AdjustmentRow[];
}

const formatMoney = (cents: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export default function CooperadoPagamentosPage() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [adjustmentRows, setAdjustmentRows] = useState<AdjustmentRow[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const [{ data: payoutData, error: payoutError }, { data: ledgerData, error: ledgerError }, { data: adjustmentData, error: adjustmentError }] =
        await Promise.all([
          supabase
            .from("coop_payouts")
            .select(
              `
              id,
              period_id,
              total_cents,
              status,
              payout_reference,
              paid_at,
              created_at,
              coop_payout_periods (period_start, period_end)
            `,
            )
            .eq("cooperado_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("coop_earnings_ledger")
            .select("total_cents, created_at")
            .eq("cooperado_id", user.id),
          supabase
            .from("coop_earning_adjustments")
            .select("id, period_id, amount_cents, reason, created_at")
            .eq("cooperado_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

      if (payoutError || ledgerError || adjustmentError) {
        const message = payoutError?.message || ledgerError?.message || adjustmentError?.message || "Falha ao carregar pagamentos.";
        setErrorMessage(message);
        setIsLoading(false);
        return;
      }

      setPayouts((payoutData || []) as unknown as PayoutRow[]);
      setLedgerRows((ledgerData || []) as LedgerRow[]);
      setAdjustmentRows((adjustmentData || []) as AdjustmentRow[]);
      setIsLoading(false);
    };

    load();
  }, [supabase, user]);

  const breakdowns = useMemo(() => {
    return payouts.map((payout) => {
      const period = Array.isArray(payout.coop_payout_periods) ? payout.coop_payout_periods[0] : null;
      const periodStart = period ? `${period.period_start}T00:00:00.000Z` : "";
      const periodEnd = period ? `${period.period_end}T23:59:59.999Z` : "";

      const ledgerSum = period
        ? ledgerRows
            .filter((item) => item.created_at >= periodStart && item.created_at <= periodEnd)
            .reduce((sum, item) => sum + item.total_cents, 0)
        : 0;

      const periodAdjustments = adjustmentRows.filter((item) => item.period_id === payout.period_id);
      const adjustmentSum = periodAdjustments.reduce((sum, item) => sum + item.amount_cents, 0);

      return {
        payout,
        ledger_sum: ledgerSum,
        adjustments_sum: adjustmentSum,
        adjustments: periodAdjustments,
      } satisfies PayoutBreakdown;
    });
  }, [payouts, ledgerRows, adjustmentRows]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-primary" size={44} />
      </div>
    );
  }

  if (!user || !profile || !["cooperado", "operator"].includes(profile.role)) {
    return (
      <div className="card text-center py-12 animate-slide-up">
        <ShieldOff size={48} className="mx-auto mb-4 text-accent" />
        <h2 className="stencil-text mb-3">Acesso Restrito</h2>
        <p className="font-bold uppercase">Somente cooperado pode visualizar detalhes de pagamentos.</p>
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
        COOPERADO / PAGAMENTOS
      </h1>

      {errorMessage && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <p className="font-bold uppercase text-sm">Erro: {errorMessage}</p>
        </div>
      )}

      {breakdowns.length === 0 ? (
        <div className="card text-center py-12">
          <p className="font-bold uppercase">Nenhum payout disponível.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {breakdowns.map((entry) => (
            <div key={entry.payout.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <p className="stencil-text text-sm">Período</p>
                  <p className="font-extrabold">
                    {entry.payout.coop_payout_periods?.[0]
                      ? `${new Date(entry.payout.coop_payout_periods[0].period_start).toLocaleDateString("pt-BR")} -> ${new Date(entry.payout.coop_payout_periods[0].period_end).toLocaleDateString("pt-BR")}`
                      : "Sem período"}
                  </p>
                </div>
                <span
                  style={{
                    padding: "0.3rem 0.6rem",
                    border: "2px solid var(--foreground)",
                    background: entry.payout.status === "paid" ? "#16a34a" : "var(--muted)",
                    color: entry.payout.status === "paid" ? "white" : "black",
                    fontWeight: 900,
                    fontSize: "0.75rem",
                  }}
                >
                  {entry.payout.status.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="metric-box">
                  <span className="stencil-text text-xs">Ledger sum</span>
                  <strong>{formatMoney(entry.ledger_sum)}</strong>
                </div>
                <div className="metric-box">
                  <span className="stencil-text text-xs">Adjustments sum</span>
                  <strong>{formatMoney(entry.adjustments_sum)}</strong>
                </div>
                <div className="metric-box">
                  <span className="stencil-text text-xs">Payout total</span>
                  <strong>{formatMoney(entry.payout.total_cents)}</strong>
                </div>
              </div>

              <div className="card" style={{ marginBottom: 0 }}>
                <p className="stencil-text text-xs mb-2">Ajustes (motivos)</p>
                {entry.adjustments.length === 0 ? (
                  <p className="font-bold text-sm">Sem ajustes para este período.</p>
                ) : (
                  <ul className="list-none p-0 m-0 flex flex-col gap-2">
                    {entry.adjustments.map((item) => (
                      <li key={item.id} style={{ border: "1px solid var(--foreground)", padding: "0.5rem" }}>
                        <div className="flex justify-between gap-2">
                          <span className="font-bold text-sm">{item.reason}</span>
                          <span className="font-black">{formatMoney(item.amount_cents)}</span>
                        </div>
                        <small>{new Date(item.created_at).toLocaleString("pt-BR")}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="text-xs mt-3" style={{ fontWeight: 700 }}>
                Referência: {entry.payout.payout_reference || "-"} | Pago em:{" "}
                {entry.payout.paid_at ? new Date(entry.payout.paid_at).toLocaleString("pt-BR") : "-"}
              </p>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .grid {
          display: grid;
        }
        .grid-cols-1 {
          grid-template-columns: repeat(1, minmax(0, 1fr));
        }
        @media (min-width: 768px) {
          .md\\:grid-cols-3 {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
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
        .items-center {
          align-items: center;
        }
        .justify-between {
          justify-content: space-between;
        }
        .gap-2 {
          gap: 0.5rem;
        }
        .gap-3 {
          gap: 0.75rem;
        }
        .gap-4 {
          gap: 1rem;
        }
        .mb-2 {
          margin-bottom: 0.5rem;
        }
        .mb-4 {
          margin-bottom: 1rem;
        }
        .mb-6 {
          margin-bottom: 1.5rem;
        }
        .mt-3 {
          margin-top: 0.75rem;
        }
        .py-12 {
          padding-top: 3rem;
          padding-bottom: 3rem;
        }
        .text-center {
          text-align: center;
        }
        .text-sm {
          font-size: 0.875rem;
        }
        .text-xs {
          font-size: 0.75rem;
        }
        .metric-box {
          border: 2px solid var(--foreground);
          padding: 0.65rem;
          background: white;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .metric-box strong {
          font-size: 1.15rem;
        }
      `}</style>
    </div>
  );
}
