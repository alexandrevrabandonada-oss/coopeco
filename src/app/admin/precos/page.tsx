"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldOff, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";

interface PricingRule {
  id: string;
  material_kind: string;
  unit_kind: string;
  amount_cents: number;
  active: boolean;
}

const formatMoney = (cents: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export default function AdminPrecosPage() {
  const supabase = createClient();
  const { user, profile, isLoading: authLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rules, setRules] = useState<PricingRule[]>([]);

  const loadRules = async () => {
    setErrorMessage(null);
    setIsLoading(true);

    const { data, error } = await supabase
      .from("coop_pricing_rules")
      .select("id, material_kind, unit_kind, amount_cents, active")
      .order("material_kind", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      setRules([]);
    } else {
      setRules((data || []) as PricingRule[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const loadInitialRules = async () => {
      setErrorMessage(null);
      setIsLoading(true);

      const { data, error } = await supabase
        .from("coop_pricing_rules")
        .select("id, material_kind, unit_kind, amount_cents, active")
        .order("material_kind", { ascending: true });

      if (cancelled) return;

      if (error) {
        setErrorMessage(error.message);
        setRules([]);
      } else {
        setRules((data || []) as PricingRule[]);
      }
      setIsLoading(false);
    };

    loadInitialRules();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const toggleRule = async (rule: PricingRule) => {
    setErrorMessage(null);
    setIsSaving(true);
    const { error } = await supabase
      .from("coop_pricing_rules")
      .update({ active: !rule.active, updated_at: new Date().toISOString() })
      .eq("id", rule.id);
    if (error) {
      setErrorMessage(error.message);
    }
    setIsSaving(false);
    await loadRules();
  };

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
        <p className="font-bold uppercase">Apenas operador pode gerenciar regras de preços.</p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up pb-12">
      <h1
        className="stencil-text mb-6 flex items-center gap-2"
        style={{
          fontSize: "2rem",
          background: "var(--primary)",
          padding: "0 10px",
          border: "2px solid var(--foreground)",
          width: "fit-content",
        }}
      >
        <Tag size={24} /> ADMIN / PREÇOS
      </h1>

      <div className="card" style={{ borderStyle: "dashed" }}>
        <p className="font-bold text-sm uppercase">
          Alterar preço impacta apenas recibos futuros. Ledger existente permanece imutável por auditoria.
        </p>
      </div>

      {errorMessage && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <p className="font-bold text-sm uppercase">Erro: {errorMessage}</p>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Unidade</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    Nenhuma regra encontrada.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.material_kind}</td>
                    <td>{rule.unit_kind}</td>
                    <td>{formatMoney(rule.amount_cents)}</td>
                    <td>{rule.active ? "ATIVA" : "INATIVA"}</td>
                    <td>
                      <button
                        onClick={() => toggleRule(rule)}
                        disabled={isSaving}
                        className="cta-button"
                        style={{ padding: "0.5rem 0.7rem", boxShadow: "none", background: rule.active ? "white" : "var(--primary)" }}
                      >
                        {rule.active ? "Desativar" : "Ativar"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
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
          font-size: 0.72rem;
          text-transform: uppercase;
        }
        .empty {
          text-align: center;
          font-weight: 700;
          color: #555;
        }
      `}</style>
    </div>
  );
}
