"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface MaterialTipCount {
  material: string;
  tips_count: number;
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

const defaultMaterials = ["paper", "plastic", "metal", "glass", "oil", "ewaste", "reject"];

export default function AprenderClientPage() {
  const supabase = useMemo(() => createClient(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [countsByMaterial, setCountsByMaterial] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from("edu_tips")
        .select("material")
        .eq("active", true)
        .not("material", "is", null);

      const map: Record<string, number> = {};
      ((data || []) as Array<{ material?: string | null }>).forEach((row) => {
        const material = row.material || "";
        if (!material) return;
        map[material] = (map[material] || 0) + 1;
      });
      setCountsByMaterial(map);
      setIsLoading(false);
    };
    load();
  }, [supabase]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="animate-slide-up pb-12">
      <h1 className="stencil-text mb-6" style={{ fontSize: "2.3rem", background: "var(--primary)", padding: "0 10px", border: "2px solid var(--foreground)", width: "fit-content" }}>
        APRENDER
      </h1>

      <div className="card mb-6">
        <h2 className="stencil-text text-lg mb-2 flex items-center gap-2">
          <BookOpen size={18} /> Guia de materiais (VR)
        </h2>
        <p className="font-bold text-xs uppercase">
          Selecione um material para ver preparo correto, erros comuns e micro-aulas práticas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {defaultMaterials.map((material) => (
          <Link key={material} href={`/aprender/${material}`} className="card block">
            <p className="stencil-text text-sm">{materialLabelMap[material] || material}</p>
            <p className="font-bold text-xs uppercase mt-1">
              Micro-aulas: {countsByMaterial[material] || 0}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
