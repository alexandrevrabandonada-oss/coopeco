"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { EcoDropPoint } from "@/types/eco";
import { Loader2, MapPin } from "lucide-react";

export default function Mapa() {
  const [points, setPoints] = useState<EcoDropPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("eco_drop_points")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setPoints((data || []) as EcoDropPoint[]);
      }
      setIsLoading(false);
    };

    run();
  }, [supabase]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-primary" size={44} />
      </div>
    );
  }

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

      {errorMessage && (
        <div className="card mb-6" style={{ borderColor: "var(--accent)" }}>
          <p className="font-bold uppercase text-sm">Erro: {errorMessage}</p>
        </div>
      )}

      {points.length === 0 ? (
        <div className="card text-center py-8">
          <p className="font-bold uppercase text-sm">Ainda não há Pontos ECO ativos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {points.map((point) => (
            <div key={point.id} className="card">
              <h2 className="stencil-text text-lg mb-2 flex items-center gap-2">
                <MapPin size={18} /> {point.name}
              </h2>
              <p className="font-bold uppercase text-xs mb-1">Endereço público: {point.address_public}</p>
              <p className="font-bold uppercase text-xs mb-1">Horários: {point.hours}</p>
              <p className="font-bold uppercase text-xs">
                Materiais: {(point.accepted_materials || []).join(", ")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
