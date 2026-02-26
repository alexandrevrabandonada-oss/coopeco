"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface TipRow {
  id: string;
  title: string;
  body: string;
  flag?: string | null;
}

const materialLabelMap: Record<string, string> = {
  paper: "Papel",
  plastic: "Plástico",
  metal: "Metal",
  glass: "Vidro",
  oil: "Óleo",
  ewaste: "Eletrônicos",
  reject: "Rejeitos",
};

export default function AprenderMaterialClientPage({ params }: { params: { material: string } }) {
  const material = params.material;
  const supabase = useMemo(() => createClient(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [tips, setTips] = useState<TipRow[]>([]);
  const [genericTips, setGenericTips] = useState<TipRow[]>([]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [{ data: materialTips }, { data: baseTips }] = await Promise.all([
        supabase
          .from("edu_tips")
          .select("id, title, body, flag")
          .eq("active", true)
          .eq("material", material)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("edu_tips")
          .select("id, title, body, flag")
          .eq("active", true)
          .is("material", null)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      setTips((materialTips || []) as TipRow[]);
      setGenericTips((baseTips || []) as TipRow[]);
      setIsLoading(false);
    };
    load();
  }, [material, supabase]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  const label = materialLabelMap[material] || material.toUpperCase();

  return (
    <div className="animate-slide-up pb-12">
      <Link href="/aprender" className="mb-4 inline-flex items-center gap-2 font-black text-xs uppercase">
        <ArrowLeft size={14} /> voltar ao catálogo
      </Link>
      <h1 className="stencil-text mb-6" style={{ fontSize: "2rem", background: "var(--primary)", padding: "0 10px", border: "2px solid var(--foreground)", width: "fit-content" }}>
        {label}
      </h1>

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-2 flex items-center gap-2">
          <BookOpen size={18} /> Micro-aulas deste material
        </h2>
        {tips.length === 0 ? (
          <p className="font-bold text-xs uppercase">Sem aulas específicas ainda; veja as dicas gerais abaixo.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {tips.map((tip) => (
              <div key={tip.id} className="border-2 border-foreground bg-white p-3">
                <p className="stencil-text text-sm">{tip.title}</p>
                <p className="font-bold text-xs mt-1">{tip.body}</p>
                {tip.flag && (
                  <p className="font-bold text-[10px] uppercase mt-1">Relacionada ao erro: {tip.flag}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {genericTips.length > 0 && (
        <div className="card">
          <h2 className="stencil-text text-lg mb-2">Dicas gerais do bairro</h2>
          <div className="flex flex-col gap-3">
            {genericTips.map((tip) => (
              <div key={tip.id} className="border-2 border-foreground bg-white p-3">
                <p className="stencil-text text-sm">{tip.title}</p>
                <p className="font-bold text-xs mt-1">{tip.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
