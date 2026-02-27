"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarRange, Loader2, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { WeeklyBulletin } from "@/types/eco";
import { LoadingBlock } from "@/components/loading-block";

interface WeeklyRow {
  neighborhood_id: string;
  slug: string;
  name: string;
  week_start: string;
  week_end: string;
  requests_count: number;
  drop_point_count: number;
  recurring_count: number;
  receipts_count: number;
  ok_rate: number;
  attention_rate: number;
  contaminated_rate: number;
  top_flags: string;
}

interface GoalRow {
  week_start: string;
  target_receipts: number;
  target_ok_rate: number;
  target_drop_points: number;
  target_recurring_generated: number;
}

interface LotSanitizedRow {
  lot_id: string;
  lot_date: string;
  receipts_count: number;
  ok_count: number;
  misto_count: number;
  contaminado_count: number;
  rejeito_count: number;
  perigoso_count: number;
  dominant_flag?: string | null;
  education_highlight?: string | null;
}

export default function BairroTransparenciaClient({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const supabase = useMemo(() => createClient(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<WeeklyRow[]>([]);
  const [goalsByWeek, setGoalsByWeek] = useState<Record<string, GoalRow>>({});
  const [lotRows, setLotRows] = useState<LotSanitizedRow[]>([]);
  const [bulletin, setBulletin] = useState<any | null>(null);
  const [opsSummary, setOpsSummary] = useState<any | null>(null);
  const [promotion, setPromotion] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const { data: weeklyData, error: weeklyError } = await supabase
          .from("v_transparency_neighborhood_weekly")
          .select("*")
          .eq("slug", slug)
          .order("week_start", { ascending: false })
          .limit(12);
        if (weeklyError) throw weeklyError;
        const safeRows = ((weeklyData || []) as WeeklyRow[]).filter((row) => row.requests_count > 0 || row.receipts_count > 0);
        setRows(safeRows);

        if (safeRows.length > 0) {
          const neighborhoodId = safeRows[0].neighborhood_id;

          // Load latest published bulletin
          const { data: bData } = await supabase
            .from("weekly_bulletins")
            .select("*")
            .eq("neighborhood_id", neighborhoodId)
            .eq("status", "published")
            .order("year", { ascending: false })
            .order("week_number", { ascending: false })
            .limit(1)
            .maybeSingle();
          setBulletin(bData as any);

          // Load goals
          const { data: goalsData, error: goalsError } = await supabase
            .from("eco_pilot_goals_weekly")
            .select("week_start, target_receipts, target_ok_rate, target_drop_point_share_pct")
            .eq("neighborhood_id", neighborhoodId)
            .order("week_start", { ascending: false })
            .limit(12);
          if (goalsError) throw goalsError;
          const map: Record<string, GoalRow> = {};
          ((goalsData || []) as any[]).forEach((goal) => {
            map[goal.week_start] = {
              week_start: goal.week_start,
              target_receipts: goal.target_receipts,
              target_ok_rate: goal.target_ok_rate,
              target_drop_points: 0,
              target_recurring_generated: 0
            };
          });
          setGoalsByWeek(map);

          // Load ops summary
          const { data: opsData } = await supabase
            .from("v_neighborhood_ops_summary_7d")
            .select("*")
            .eq("neighborhood_id", neighborhoodId)
            .maybeSingle();
          setOpsSummary(opsData);

          // Load active promotion
          const { data: promoData } = await supabase
            .from("drop_point_promotions")
            .select("*, drop_point:eco_drop_points(name)")
            .eq("neighborhood_id", neighborhoodId)
            .lte("starts_at", new Date().toISOString())
            .gte("ends_at", new Date().toISOString())
            .maybeSingle();
          setPromotion(promoData);
        }

        const { data: lotsData, error: lotsError } = await supabase
          .from("v_lot_transparency_sanitized")
          .select("lot_id, lot_date, receipts_count, ok_count, misto_count, contaminado_count, rejeito_count, perigoso_count, dominant_flag, education_highlight")
          .eq("slug", slug)
          .order("lot_date", { ascending: false })
          .limit(6);
        if (lotsError) throw lotsError;
        setLotRows((lotsData || []) as LotSanitizedRow[]);
      } catch (error) {
        setErrorMessage((error as Error).message);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [slug, supabase]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="card text-center py-12">
        <h2 className="stencil-text">SEM DADOS SEMANAIS</h2>
        <Link href={`/bairros/${slug}`} className="cta-button mx-auto mt-6">VOLTAR</Link>
      </div>
    );
  }

  const currentWeek = rows[0];
  const currentGoal = goalsByWeek[currentWeek.week_start];

  return (
    <div className="animate-slide-up pb-12">
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/bairros/${slug}`} className="p-2 border-2 border-foreground hover:bg-primary transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="stencil-text" style={{ fontSize: "2rem", background: "var(--primary)", padding: "0 8px", border: "2px solid var(--foreground)" }}>
          TRANSPARÊNCIA SEMANAL
        </h1>
      </div>

      {bulletin && (
        <section className="mb-8 animate-slide-up">
          <div className="card bg-primary/10 border-primary p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-foreground px-3 py-1 font-black text-[10px] uppercase">
              ÚLTIMO BOLETIM • {new Date(bulletin.week_start).toLocaleDateString("pt-BR")}
            </div>
            <h2 className="stencil-text text-2xl mb-4 text-primary">{bulletin.title}</h2>
            <div className="prose prose-sm max-w-none font-bold uppercase text-xs mb-6 text-muted-foreground whitespace-pre-wrap">
              {bulletin.body_md}
            </div>
            {bulletin.highlights && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(bulletin.highlights as Record<string, string>).map(([key, val]) => (
                  <div key={key} className="bg-white border-2 border-foreground p-3">
                    <span className="font-black text-[10px] uppercase text-primary d-block mb-1">{key}</span>
                    <p className="font-extrabold text-xs">{val}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <Link href={`/bairros/${slug}/boletins`} className="font-black text-[10px] uppercase underline hover:text-primary">
                VER BOLETINS ANTERIORES
              </Link>
            </div>
          </div>
        </section>
      )}

      {errorMessage && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <p className="font-bold text-xs uppercase">Erro: {errorMessage}</p>
        </div>
      )}

      {promotion && (
        <section className="mb-8 animate-pulse">
          <div className="card bg-accent/5 border-accent p-6 border-4">
            <h2 className="stencil-text text-xl mb-2 text-accent flex items-center gap-2">
              🚨 ENERGIA COLETIVA: REATIVAÇÃO
            </h2>
            <p className="font-bold text-sm uppercase mb-4">
              O Ponto <strong>{promotion.drop_point?.name}</strong> está precisando de energia!
              Estamos em campanha para reativar este ponto e garantir que o comum continue circulando.
            </p>
            <div className="bg-white border-2 border-foreground p-4">
              <p className="font-black text-xs uppercase text-accent mb-2">{promotion.title}</p>
              <p className="font-bold text-xs uppercase">{promotion.message}</p>
              <div className="mt-4 flex justify-between items-end">
                <p className="font-black text-[10px] uppercase opacity-60">Expira em: {new Date(promotion.ends_at).toLocaleDateString("pt-BR")}</p>
                <Link href="/mapa" className="cta-button small" style={{ background: "var(--accent)", color: "white" }}>
                  VER NO MAPA
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {opsSummary && (
        <section className="mb-6">
          <div className="card border-2 border-foreground bg-white shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
            <h2 className="stencil-text text-lg mb-4 flex items-center gap-2">
              📟 PULSO OPERACIONAL (ÚLTIMOS 7 DIAS)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-black text-[10px] uppercase text-muted">Janela preferida</span>
                <p className="font-black text-xs uppercase">{opsSummary.busiest_window_label || 'Ponto ECO predominante'}</p>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-black text-[10px] uppercase text-muted">Ponto ECO ativo</span>
                <p className="font-black text-xs uppercase">{opsSummary.busiest_drop_point_name || 'Porta a Porta predominante'}</p>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-black text-[10px] uppercase text-muted">Cobertura Recorrência</span>
                <p className="font-black text-xs uppercase">
                  {Math.round((opsSummary.recurring_coverage_pct || 0) * 100)}% dos pedidos
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-3 flex items-center gap-2">
          <CalendarRange size={18} /> Semana atual ({new Date(currentWeek.week_start).toLocaleDateString("pt-BR")} - {new Date(currentWeek.week_end).toLocaleDateString("pt-BR")})
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border-2 border-foreground p-3 bg-white">
            <p className="font-black text-xs uppercase">Coletas</p>
            <p className="font-black text-2xl">{currentWeek.requests_count}</p>
          </div>
          <div className="border-2 border-foreground p-3 bg-white">
            <p className="font-black text-xs uppercase">Recibos</p>
            <p className="font-black text-2xl">{currentWeek.receipts_count}</p>
          </div>
          <div className="border-2 border-foreground p-3 bg-white">
            <p className="font-black text-xs uppercase">OK rate</p>
            <p className="font-black text-2xl">{Number(currentWeek.ok_rate || 0).toFixed(1)}%</p>
          </div>
          <div className="border-2 border-foreground p-3 bg-white">
            <p className="font-black text-xs uppercase">Recorrentes</p>
            <p className="font-black text-2xl">{currentWeek.recurring_count}</p>
          </div>
        </div>
        <p className="font-bold text-xs uppercase mt-2">
          Cobertura de recorrência da semana:{" "}
          {currentWeek.requests_count > 0
            ? `${((currentWeek.recurring_count / currentWeek.requests_count) * 100).toFixed(1)}%`
            : "0.0%"}
        </p>
        <p className="font-bold text-xs uppercase mt-3">
          Top flags da semana: {currentWeek.top_flags || "sem alertas relevantes"}
        </p>
        {currentGoal && (
          <p className="font-bold text-xs uppercase mt-2">
            Meta: {currentGoal.target_receipts} recibos | {Number(currentGoal.target_ok_rate || 0).toFixed(1)}% OK | {currentGoal.target_recurring_generated} recorrentes
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="stencil-text text-lg mb-4">Histórico (12 semanas)</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Semana</th>
                <th>Coletas</th>
                <th>Recibos</th>
                <th>OK rate</th>
                <th>Recorrentes</th>
                <th>% Recorrência</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.neighborhood_id}-${row.week_start}`}>
                  <td>{new Date(row.week_start).toLocaleDateString("pt-BR")}</td>
                  <td>{row.requests_count}</td>
                  <td>{row.receipts_count}</td>
                  <td>{Number(row.ok_rate || 0).toFixed(1)}%</td>
                  <td>{row.recurring_count}</td>
                  <td>{row.requests_count > 0 ? ((row.recurring_count / row.requests_count) * 100).toFixed(1) : "0.0"}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="stencil-text text-lg mb-4">Galpão (lotes fechados)</h2>
        {lotRows.length === 0 ? (
          <p className="font-bold text-xs uppercase">Sem lotes fechados no período.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {lotRows.map((lot) => (
              <div key={lot.lot_id} className="border-2 border-foreground bg-white p-3">
                <p className="font-black text-xs uppercase mb-1">
                  Lote {new Date(lot.lot_date).toLocaleDateString("pt-BR")} • Recibos: {lot.receipts_count}
                </p>
                <p className="font-bold text-xs uppercase">
                  OK {lot.ok_count} | Misto {lot.misto_count} | Contaminado {lot.contaminado_count} | Rejeito {lot.rejeito_count} | Perigoso {lot.perigoso_count}
                </p>
                <p className="font-bold text-xs uppercase mt-1">Flag dominante: {lot.dominant_flag || "-"}</p>
                {["food", "liquids"].includes((lot.dominant_flag || "").toLowerCase()) && (
                  <p className="font-black text-xs uppercase mt-2" style={{ color: "var(--accent)" }}>
                    Dica do bairro: {lot.education_highlight || "Reforce separação limpa e seca para reduzir contaminação por alimento/líquido."}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
