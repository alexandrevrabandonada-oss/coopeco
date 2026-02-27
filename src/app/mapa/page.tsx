"use client";

import { useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { EcoDropPoint } from "@/types/eco";
import { MapPin } from "lucide-react";
import { LoadingBlock } from "@/components/loading-block";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { useQueryState } from "@/hooks/use-query-state";

type PointRow = EcoDropPoint & { duplicateCount?: number };

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function dedupePoints(points: EcoDropPoint[]): PointRow[] {
  const grouped = new Map<string, PointRow>();
  for (const point of points) {
    const key = `${normalizeText(point.name)}|${normalizeText(point.address_public || "")}`;
    const found = grouped.get(key);
    if (!found) {
      grouped.set(key, { ...point, duplicateCount: 1 });
      continue;
    }
    found.duplicateCount = (found.duplicateCount || 1) + 1;
    const merged = new Set([...(found.accepted_materials || []), ...(point.accepted_materials || [])]);
    found.accepted_materials = [...merged] as PointRow["accepted_materials"];
  }
  return [...grouped.values()];
}

export default function Mapa() {
  const supabase = useMemo(() => createClient(), []);
  const query = useQueryState<{ points: PointRow[], promotions: any[] }>(
    async () => {
      const [pointsRes, promoRes] = await Promise.all([
        supabase.from("eco_drop_points").select("*").eq("active", true).order("created_at", { ascending: false }),
        supabase.from("drop_point_promotions").select("*").gte("expires_at", new Date().toISOString())
      ]);

      if (pointsRes.error) throw new Error(pointsRes.error.message);
      return {
        points: dedupePoints((pointsRes.data || []) as EcoDropPoint[]),
        promotions: promoRes.data || []
      };
    },
    [supabase],
  );

  if (query.status === "loading" || query.status === "idle") return <LoadingBlock text="Carregando pontos ECO..." />;
  if (query.status === "error") {
    return (
      <ErrorState
        title="Não foi possível carregar o mapa"
        body={query.error || "Tente novamente em instantes."}
        onRetry={query.refetch}
        code={query.error === "Demorou demais" ? "ECO_MAP_TIMEOUT" : "ECO_MAP_LOAD_FAIL"}
      />
    );
  }

  const points = query.data?.points || [];
  const promotions = query.data?.promotions || [];

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
        MAPA / PONTOS ECO
      </h1>

      {query.status === "empty" ? (
        <EmptyState
          title="Sem Pontos ECO ativos ainda neste bairro."
          body="Quando novos pontos forem ativados, eles vão aparecer aqui."
          ctaLabel="Voltar para início"
          ctaHref="/"
        />
      ) : (
        <div className="flex flex-col gap-4">
          {points.map((point) => {
            const isPromoted = promotions.some(p => p.drop_point_id === point.id);
            return (
              <div key={point.id} className={`card ${isPromoted ? 'border-primary border-4 shadow-[6px_6px_0_0_rgba(0,0,0,1)]' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <h2 className="stencil-text text-lg flex items-center gap-2">
                    <MapPin size={18} />
                    {point.name}
                    {(point.duplicateCount || 1) > 1 && <span className="text-xs font-black uppercase">({`x${point.duplicateCount}`})</span>}
                  </h2>
                  {isPromoted && (
                    <span className="bg-primary text-foreground text-[10px] font-black uppercase px-2 py-1 border-2 border-foreground rotate-2">
                      RECOMENDADO
                    </span>
                  )}
                </div>
                <p className="font-bold uppercase text-xs mb-1">Endereço público: {point.address_public}</p>
                <p className="font-bold uppercase text-xs mb-1">Horários: {point.hours}</p>
                <p className="font-bold uppercase text-xs">Materiais: {(point.accepted_materials || []).join(", ")}</p>
                <Link href="/pedir-coleta" className="cta-button small mt-3 inline-flex">
                  Usar este ponto
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
