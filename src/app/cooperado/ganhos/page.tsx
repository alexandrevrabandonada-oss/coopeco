"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Coins, Loader2, ShieldOff, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";

interface LedgerEntry {
  id: string;
  total_cents: number;
  created_at: string;
  receipt_id: string;
  neighborhood_id: string;
}

interface NeighborhoodRow {
  id: string;
  name: string;
}

const formatMoney = (cents: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export default function CooperadoGanhosPage() {
  const supabase = createClient();
  const { user, profile, isLoading: authLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [neighborhoodMap, setNeighborhoodMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      setErrorMessage(null);
      setIsLoading(true);

      const { data: ledgerData, error: ledgerError } = await supabase
        .from("coop_earnings_ledger")
        .select("id, total_cents, created_at, receipt_id, neighborhood_id")
        .eq("cooperado_id", user.id)
        .order("created_at", { ascending: false });

      if (ledgerError) {
        setErrorMessage(ledgerError.message);
        setLedger([]);
        setIsLoading(false);
        return;
      }

      const safeLedger = (ledgerData || []) as LedgerEntry[];
      setLedger(safeLedger);

      const neighborhoodIds = Array.from(new Set(safeLedger.map((item) => item.neighborhood_id)));
      if (neighborhoodIds.length > 0) {
        const { data: neighborhoodRows } = await supabase
          .from("neighborhoods")
          .select("id, name")
          .in("id", neighborhoodIds);
        const map: Record<string, string> = {};
        for (const row of (neighborhoodRows || []) as NeighborhoodRow[]) {
          map[row.id] = row.name;
        }
        setNeighborhoodMap(map);
      } else {
        setNeighborhoodMap({});
      }

      setIsLoading(false);
    };

    load();
  }, [supabase, user]);

  const total30d = useMemo(() => {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 30);
    return ledger
      .filter((entry) => new Date(entry.created_at) >= threshold)
      .reduce((sum, entry) => sum + entry.total_cents, 0);
  }, [ledger]);

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
        <p className="font-bold uppercase">Somente cooperado pode acessar o ledger de ganhos.</p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up pb-12">
      <h1
        className="stencil-text mb-6"
        style={{
          fontSize: "2rem",
          background: "var(--primary)",
          padding: "0 10px",
          border: "2px solid var(--foreground)",
          width: "fit-content",
        }}
      >
        COOPERADO / GANHOS
      </h1>

      {errorMessage && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <p className="font-bold text-sm uppercase">Erro: {errorMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <div className="card metric">
          <span className="stencil-text text-xs">Últimos 30 dias</span>
          <strong>{formatMoney(total30d)}</strong>
          <small className="hint">
            <TrendingUp size={14} /> Valor bruto gerado no ledger
          </small>
        </div>
        <div className="card metric">
          <span className="stencil-text text-xs">Total de lançamentos</span>
          <strong>{ledger.length}</strong>
          <small className="hint">
            <Coins size={14} /> Cada lançamento é derivado de recibo
          </small>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Bairro</th>
                <th>Valor</th>
                <th>Recibo</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              ) : (
                ledger.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.created_at).toLocaleDateString("pt-BR")}</td>
                    <td>{neighborhoodMap[entry.neighborhood_id] || "N/A"}</td>
                    <td>{formatMoney(entry.total_cents)}</td>
                    <td>
                      <Link href={`/recibos/${entry.receipt_id}`} className="link">
                        Ver recibo
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
        }
        .gap-3 {
          gap: 0.75rem;
        }
        .mb-6 {
          margin-bottom: 1.5rem;
        }
        .metric {
          margin-bottom: 0;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .metric strong {
          font-size: 1.35rem;
        }
        .hint {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          font-weight: 700;
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
        }
        th {
          background: var(--muted);
          font-size: 0.7rem;
          text-transform: uppercase;
        }
        .empty {
          text-align: center;
          font-weight: 700;
          color: #555;
        }
        .link {
          font-weight: 800;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
