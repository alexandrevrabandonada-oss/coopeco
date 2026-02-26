"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ScrollText } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface DecisionPublicRow {
  id: string;
  slug: string;
  neighborhood_name: string;
  decision_date: string;
  title: string;
  summary_public: string;
  rationale_public?: string | null;
  implementation_public?: string | null;
}

export default function BairroDecisoesClient({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<DecisionPublicRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const { data, error } = await supabase
          .from("v_decision_receipts_public")
          .select("id, slug, neighborhood_name, decision_date, title, summary_public, rationale_public, implementation_public")
          .eq("slug", slug)
          .order("decision_date", { ascending: false })
          .limit(40);
        if (error) throw error;
        setRows((data || []) as DecisionPublicRow[]);
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

  return (
    <div className="animate-slide-up pb-12">
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/bairros/${slug}`} className="p-2 border-2 border-foreground hover:bg-primary transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="stencil-text" style={{ fontSize: "2rem", background: "var(--primary)", padding: "0 8px", border: "2px solid var(--foreground)" }}>
          DECISÕES DO BAIRRO
        </h1>
      </div>

      {errorMessage && (
        <div className="card mb-6" style={{ borderColor: "var(--accent)" }}>
          <p className="font-bold text-xs uppercase">Erro: {errorMessage}</p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card">
          <p className="font-bold text-xs uppercase">Sem recibos de decisão publicados.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.id} className="card">
              <p className="font-black text-xs uppercase mb-1 flex items-center gap-2">
                <ScrollText size={14} /> {new Date(row.decision_date).toLocaleDateString("pt-BR")}
              </p>
              <p className="stencil-text text-sm mb-2">{row.title}</p>
              <p className="font-bold text-xs uppercase">{row.summary_public}</p>
              {row.rationale_public && (
                <p className="font-bold text-xs uppercase mt-2">Justificativa: {row.rationale_public}</p>
              )}
              {row.implementation_public && (
                <p className="font-bold text-xs uppercase mt-1">Implementação: {row.implementation_public}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
