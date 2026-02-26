"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarRange, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";

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
          const { data: goalsData, error: goalsError } = await supabase
            .from("pilot_goals_weekly")
            .select("week_start, target_receipts, target_ok_rate, target_drop_points, target_recurring_generated")
            .eq("neighborhood_id", neighborhoodId)
            .order("week_start", { ascending: false })
            .limit(12);
          if (goalsError) throw goalsError;
          const map: Record<string, GoalRow> = {};
          ((goalsData || []) as GoalRow[]).forEach((goal) => {
            map[goal.week_start] = goal;
          });
          setGoalsByWeek(map);
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

      {errorMessage && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <p className="font-bold text-xs uppercase">Erro: {errorMessage}</p>
        </div>
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
