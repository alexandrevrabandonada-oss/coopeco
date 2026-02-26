"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface TipRow {
  id: string;
  title: string;
  body: string;
  flag?: string | null;
}

const flagLabelMap: Record<string, string> = {
  food: "Resíduos de alimento",
  liquids: "Líquidos nas embalagens",
  mixed: "Materiais misturados",
  sharp: "Perfurocortantes sem proteção",
};

export function NeighborhoodErrorsWidget({ neighborhoodId, compact = false }: { neighborhoodId?: string | null; compact?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [flags, setFlags] = useState<string[]>([]);
  const [tipsByFlag, setTipsByFlag] = useState<Record<string, TipRow | null>>({});

  useEffect(() => {
    const load = async () => {
      if (!neighborhoodId) {
        setFlags([]);
        setTipsByFlag({});
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const { data: rankRow } = await supabase
        .from("v_rank_neighborhood_30d")
        .select("contam_top_flags")
        .eq("id", neighborhoodId)
        .maybeSingle<{ contam_top_flags?: string[] | null }>();

      const topFlags = ((rankRow?.contam_top_flags || []) as string[]).filter(Boolean).slice(0, 3);
      setFlags(topFlags);

      if (topFlags.length === 0) {
        setTipsByFlag({});
        setIsLoading(false);
        return;
      }

      const map: Record<string, TipRow | null> = {};
      for (const flag of topFlags) {
        const { data: tip } = await supabase
          .from("edu_tips")
          .select("id, title, body, flag")
          .eq("active", true)
          .eq("flag", flag)
          .limit(1)
          .maybeSingle<TipRow>();
        map[flag] = tip || null;
      }
      setTipsByFlag(map);
      setIsLoading(false);
    };
    load();
  }, [neighborhoodId, supabase]);

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin text-primary" size={16} />
          <p className="font-bold text-xs uppercase">Carregando erros comuns do bairro...</p>
        </div>
      </div>
    );
  }

  if (flags.length === 0) return null;

  return (
    <div className="card" style={{ borderColor: "var(--accent)" }}>
      <h3 className="stencil-text text-sm mb-3 flex items-center gap-2">
        <AlertTriangle size={16} /> Top 3 erros do bairro + como corrigir
      </h3>
      <div className="flex flex-col gap-2">
        {flags.map((flag) => (
          <div key={flag} className="border-2 border-foreground bg-white p-3">
            <p className="font-black text-xs uppercase">{flagLabelMap[flag] || flag}</p>
            <p className="font-bold text-xs uppercase mt-1">
              {tipsByFlag[flag]?.title || "Separar e higienizar melhor o material"}
            </p>
            {!compact && (
              <p className="font-bold text-[11px] mt-1">
                {tipsByFlag[flag]?.body || "Drene líquidos e separe por tipo antes da coleta para elevar a qualidade."}
              </p>
            )}
          </div>
        ))}
      </div>
      <Link href="/aprender" className="cta-button small mt-3 inline-flex">
        Ver guia completo de materiais
      </Link>
    </div>
  );
}
