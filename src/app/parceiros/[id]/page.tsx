"use client";

import { useEffect, useMemo, useState, use } from "react";
import { createClient } from "@/lib/supabase";
import { AnchorCommitment, PartnerRank, TransparencyMonth, PartnerAnchor, Profile, RouteWindow } from "@/types/eco";
import { Loader2, ShieldCheck, Trophy, Package, Calendar, ArrowLeft, Repeat2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { formatWindowLabel } from "@/lib/route-windows";

export default function PartnerImpact({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, profile } = useAuth();
  const p = profile as Profile | null;
  const [rank, setRank] = useState<PartnerRank | null>(null);
  const [history, setHistory] = useState<TransparencyMonth[]>([]);
  const [anchor, setAnchor] = useState<PartnerAnchor | null>(null);
  const [windows, setWindows] = useState<RouteWindow[]>([]);
  const [commitments, setCommitments] = useState<AnchorCommitment[]>([]);
  const [partnerNeighborhoodId, setPartnerNeighborhoodId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [subscriptionMessage, setSubscriptionMessage] = useState<string>("");
  const [cadence, setCadence] = useState<"weekly" | "biweekly">("weekly");
  const [windowId, setWindowId] = useState("");
  const isAnchorsEnabled = (process.env.NEXT_PUBLIC_ECO_FEATURES_ANCHORS ?? process.env.ECO_FEATURES_ANCHORS ?? "false").toLowerCase() === "true";
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);

      const { data: rankData } = await supabase.from("v_rank_partner_30d").select("*").eq("id", id).single();

      if (rankData) {
        setRank(rankData);

        const { data: histData } = await supabase
          .from("metrics_daily")
          .select("day, impact_score, receipts_count")
          .eq("partner_id", id)
          .order("day", { ascending: false })
          .limit(30);

        if (histData) {
          const months: Record<string, TransparencyMonth> = {};
          histData.forEach((d) => {
            const m = d.day.substring(0, 7);
            if (!months[m]) {
              months[m] = {
                neighborhood_id: "",
                month: m,
                impact_score: 0,
                receipts_count: 0,
                mutiroes_count: 0,
                chamados_count: 0,
              };
            }
            months[m].impact_score += d.impact_score as number;
            months[m].receipts_count += d.receipts_count as number;
          });
          setHistory(Object.values(months));
        }
      }

      const [{ data: anchorData }, { data: partnerData }, { data: commitmentData }] = await Promise.all([
        supabase.from("partner_anchors").select("*").eq("partner_id", id).maybeSingle(),
        supabase.from("partners").select("id, neighborhood_id").eq("id", id).maybeSingle(),
        supabase.from("anchor_commitments").select("*").eq("partner_id", id).order("created_at", { ascending: false }).limit(12),
      ]);
      setAnchor((anchorData || null) as PartnerAnchor | null);
      setCommitments((commitmentData || []) as AnchorCommitment[]);

      const neighborhoodId = (partnerData?.neighborhood_id as string | undefined) || p?.neighborhood_id || "";
      setPartnerNeighborhoodId(neighborhoodId);

      if (neighborhoodId) {
        const { data: windowsData } = await supabase
          .from("route_windows")
          .select("*")
          .eq("neighborhood_id", neighborhoodId)
          .eq("active", true)
          .order("weekday", { ascending: true })
          .order("start_time", { ascending: true });
        const safeWindows = (windowsData || []) as RouteWindow[];
        setWindows(safeWindows);
        if (safeWindows.length > 0) setWindowId(safeWindows[0].id);
      }

      setIsLoading(false);
    }
    loadData();
  }, [id, p?.neighborhood_id, supabase]);

  const createPartnerSubscription = async () => {
    if (!user || !partnerNeighborhoodId) return;
    setSubscriptionMessage("");
    setIsSaving(true);
    try {
      const preferredWindow = windows.find((window) => window.id === windowId) || null;
      const { error } = await supabase.from("recurring_subscriptions").insert({
        created_by: user.id,
        neighborhood_id: partnerNeighborhoodId,
        scope: "partner",
        partner_id: id,
        cadence,
        preferred_weekday: preferredWindow?.weekday ?? new Date().getDay(),
        preferred_window_id: preferredWindow?.id ?? null,
        address_ref: "Parceiro âncora",
        status: "paused",
      });
      if (error) throw error;
      setSubscriptionMessage("Assinatura de parceiro criada (status pausado para aprovação do operador).");
    } catch (error) {
      setSubscriptionMessage(`Erro: ${(error as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={48} /></div>;

  if (!rank) return (
    <div className="card text-center py-12">
      <h2 className="stencil-text">PARCEIRO NÃO ENCONTRADO</h2>
      <Link href="/" className="cta-button mx-auto mt-6">VOLTAR</Link>
    </div>
  );

  return (
    <div className="animate-slide-up pb-12">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="p-2 border-2 border-foreground hover:bg-primary transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-primary" size={24} />
            <span className="font-black text-xs uppercase bg-primary px-1 border border-foreground">SELO ATIVO</span>
            {anchor?.active && (
              <span className="font-black text-xs uppercase bg-white px-1 border border-foreground">
                ÂNCORA {anchor.anchor_level.toUpperCase()}
              </span>
            )}
          </div>
          <h1 className="stencil-text text-3xl" style={{ padding: '0 8px', border: '2px solid var(--foreground)', width: 'fit-content' }}>
            {rank.name}
          </h1>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="stencil-text text-xl mb-6 flex items-center gap-2">
          <Calendar size={24} /> PERFORMANCE (30 DIAS)
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="card bg-primary/10 border-primary flex flex-col items-center py-6">
            <Trophy size={40} className="mb-2 text-primary" />
            <span className="font-black text-3xl">{rank.impact_score || 0}</span>
            <span className="font-bold text-[10px] uppercase">SCORE DE IMPACTO</span>
          </div>
          <div className="card flex flex-col items-center py-6">
            <Package size={40} className="mb-2 text-secondary" />
            <span className="font-black text-3xl">{rank.receipts_count || 0}</span>
            <span className="font-bold text-[10px] uppercase">COLETAS APOIADAS</span>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="stencil-text text-xl mb-6 flex items-center gap-2">
          HISTÓRICO DE TRANSPARÊNCIA
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-2 border-foreground">
            <thead>
              <tr className="bg-foreground text-white">
                <th className="p-2 text-left font-black uppercase text-xs">PERÍODO</th>
                <th className="p-2 text-center font-black uppercase text-xs">SCORE</th>
                <th className="p-2 text-center font-black uppercase text-xs">RECIBOS</th>
              </tr>
            </thead>
            <tbody>
              {history.map((m, i) => (
                <tr key={i} className="border-b-2 border-foreground/10 hover:bg-muted/5">
                  <td className="p-3 font-extrabold uppercase text-xs">{m.month}</td>
                  <td className="p-3 text-center font-black">{m.impact_score}</td>
                  <td className="p-3 text-center font-bold">{m.receipts_count}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-8 text-center font-bold text-muted uppercase">NENHUMA COLETA REGISTRADA NO PERÍODO</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isAnchorsEnabled && (
        <section className="mb-10">
          <h2 className="stencil-text text-xl mb-4">ÂNCORA & COMPROMISSOS MENSAIS</h2>
          <div className="card">
            <p className="font-black text-xs uppercase mb-2">
              Status de âncora: {anchor?.active ? `ATIVO (${anchor.anchor_level.toUpperCase()})` : "SEM ÂNCORA ATIVA"}
            </p>
            {commitments.length === 0 ? (
              <p className="font-bold text-xs uppercase">Nenhum compromisso mensal público cadastrado.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {commitments.map((commitment) => (
                  <div key={commitment.id} className="border-2 border-foreground bg-white p-3">
                    <p className="font-black text-xs uppercase">
                      {commitment.level.toUpperCase()} • {commitment.status.toUpperCase()}
                    </p>
                    <p className="font-bold text-xs uppercase mt-1">{commitment.monthly_commitment_text}</p>
                    <p className="font-bold text-[10px] uppercase mt-1">
                      Registro: {new Date(commitment.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <div className="card bg-muted/5 border-dashed py-8">
        <p className="font-black text-xs uppercase mb-4 text-center">ASSINATURA RECORRENTE COM PARCEIRO ÂNCORA</p>
        {!user ? (
          <p className="font-bold text-xs uppercase text-center">Faça login para criar assinatura de parceiro.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="stencil-text text-xs">Cadência</span>
              <select className="field" value={cadence} onChange={(e) => setCadence(e.target.value as "weekly" | "biweekly")}>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quinzenal</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="stencil-text text-xs">Janela</span>
              <select className="field" value={windowId} onChange={(e) => setWindowId(e.target.value)}>
                <option value="">Sem janela fixa</option>
                {windows.map((window) => (
                  <option key={window.id} value={window.id}>
                    {formatWindowLabel(window)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="cta-button md:col-span-2"
              onClick={createPartnerSubscription}
              disabled={isSaving}
            >
              <Repeat2 size={18} />
              {isSaving ? "Gravando..." : "Criar assinatura (aprovação do operador)"}
            </button>
            {subscriptionMessage && (
              <p className="font-bold text-xs uppercase md:col-span-2">{subscriptionMessage}</p>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .grid { display: grid; }
        .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
        .gap-3 { gap: 0.75rem; }
        .gap-4 { gap: 1rem; }
        .w-full { width: 100%; }
        @media (min-width: 768px) {
          .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .md\\:col-span-2 { grid-column: span 2 / span 2; }
        }
      `}</style>
    </div>
  );
}
