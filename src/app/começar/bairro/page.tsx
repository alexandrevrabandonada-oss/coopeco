"use client";

import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase";
import { Neighborhood, PilotProgram } from "@/types/eco";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Search, ArrowRight, Info } from "lucide-react";
import Link from "next/link";

export default function OnboardingNeighborhood() {
    const { user, profile } = useAuth();
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);
    const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
    const [pilotPrograms, setPilotPrograms] = useState<Record<string, boolean>>({});
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function load() {
            const { data: nData } = await supabase.from("neighborhoods").select("*").order("name");
            setNeighborhoods(nData || []);

            const { data: pData } = await supabase
                .from("pilot_programs")
                .select("*, neighborhoods:pilot_program_neighborhoods(*)")
                .eq("status", "active");

            const pilotsMap: Record<string, boolean> = {};
            pData?.forEach(p => {
                p.neighborhoods?.forEach((pn: any) => {
                    pilotsMap[pn.neighborhood_id] = true;
                });
            });
            setPilotPrograms(pilotsMap);
        }
        load();
    }, [supabase]);

    const filtered = neighborhoods.filter(n =>
        n.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = async (n: Neighborhood) => {
        if (!user) return;
        setLoading(true);

        // Update profile + onboarding state
        const [pUpdate, oUpdate] = await Promise.all([
            supabase.from("profiles").update({ neighborhood_id: n.id }).eq("user_id", user.id),
            supabase.from("onboarding_state").update({ step: 'mode' }).eq("user_id", user.id)
        ]);

        if (pUpdate.error || oUpdate.error) {
            alert("Erro ao salvar bairro.");
            setLoading(false);
        } else {
            router.push("/começar/modo");
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-slide-up">
            <div className="space-y-1">
                <h2 className="stencil-text text-2xl uppercase">Qual seu território?</h2>
                <p className="font-bold text-xs text-muted-foreground uppercase">Precisamos localizar suas rotas locais.</p>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                    type="text"
                    placeholder="BUSCAR BAIRRO..."
                    className="field pl-10"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-1">
                {filtered.map(n => {
                    const isPilot = pilotPrograms[n.id];
                    return (
                        <button
                            key={n.id}
                            disabled={loading}
                            onClick={() => handleSelect(n)}
                            className="card flex items-center justify-between p-4 hover:border-primary transition-colors text-left"
                        >
                            <div className="flex flex-col">
                                <span className="font-black text-sm uppercase">{n.name}</span>
                                {isPilot && (
                                    <span className="bg-primary px-1 font-black text-[8px] uppercase w-fit mt-1">Bairro Piloto</span>
                                )}
                            </div>
                            <ArrowRight size={16} />
                        </button>
                    );
                })}
                {filtered.length === 0 && (
                    <p className="text-center py-8 font-bold text-xs uppercase text-muted italic">Bairro não encontrado.</p>
                )}
            </div>

            {filtered.some(n => pilotPrograms[n.id]) && (
                <div className="bg-primary/10 border-2 border-primary p-4 flex gap-3 items-start">
                    <Info className="text-primary shrink-0" size={20} />
                    <div className="space-y-1">
                        <p className="font-black text-[10px] uppercase">Rituais Ativos</p>
                        <p className="text-[10px] font-bold leading-tight uppercase">
                            Alguns bairros já possuem planos semanais completos. Procure a tag amarela!
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
