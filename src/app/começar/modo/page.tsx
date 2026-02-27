"use client";

import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase";
import { EcoDropPoint } from "@/types/eco";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Recycle, Truck, ArrowRight, CheckCircle2 } from "lucide-react";

export default function OnboardingMode() {
    const { user, profile } = useAuth();
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);
    const [dropPoints, setDropPoints] = useState<EcoDropPoint[]>([]);
    const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const p = profile as { neighborhood_id?: string } | null;

    useEffect(() => {
        if (!p?.neighborhood_id) return;
        async function load() {
            const { data } = await supabase
                .from("eco_drop_points")
                .select("*")
                .eq("neighborhood_id", p?.neighborhood_id)
                .eq("active", true);
            setDropPoints(data || []);
        }
        load();
    }, [p?.neighborhood_id, supabase]);

    const handleSelectDropPoint = async (pointId: string) => {
        if (!user) return;
        setLoading(true);
        const { error } = await supabase
            .from("onboarding_state")
            .update({
                step: 'first_action',
                chosen_mode: 'drop_point',
                chosen_drop_point_id: pointId
            })
            .eq("user_id", user.id);

        if (error) alert(error.message);
        else router.push("/começar/acao");
    };

    const handleSelectDoorstep = async () => {
        if (!user) return;
        setLoading(true);
        const { error } = await supabase
            .from("onboarding_state")
            .update({
                step: 'address',
                chosen_mode: 'doorstep'
            })
            .eq("user_id", user.id);

        if (error) alert(error.message);
        else router.push("/começar/endereco");
    };

    return (
        <div className="flex flex-col gap-8 animate-slide-up">
            <div className="space-y-1">
                <h2 className="stencil-text text-2xl uppercase">Como prefere agir?</h2>
                <p className="font-bold text-xs text-muted-foreground uppercase">Escolha o modo mais prático para sua rotina.</p>
            </div>

            <div className="flex flex-col gap-4">
                {/* Drop Point Option */}
                <section className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <h3 className="stencil-text text-sm uppercase text-primary">OPÇÃO 1: ENTREGA DIRETA</h3>
                    </div>
                    <div className="flex flex-col gap-2">
                        {dropPoints.map(dp => (
                            <button
                                key={dp.id}
                                disabled={loading}
                                onClick={() => handleSelectDropPoint(dp.id)}
                                className="card p-4 hover:border-primary transition-colors text-left flex justify-between items-center group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-primary/10 p-2 border border-primary group-hover:bg-primary transition-colors">
                                        <Recycle size={20} />
                                    </div>
                                    <div>
                                        <p className="font-black text-xs uppercase">{dp.name}</p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{dp.address_public}</p>
                                    </div>
                                </div>
                                <ArrowRight size={16} />
                            </button>
                        ))}
                        {dropPoints.length === 0 && (
                            <div className="card border-dashed p-4 text-center opacity-50">
                                <p className="font-black text-[10px] uppercase italic">Nenhum ponto ECO próximo ativo.</p>
                            </div>
                        )}
                    </div>
                </section>

                <div className="flex items-center gap-4 py-2">
                    <div className="h-[2px] bg-foreground/10 flex-1" />
                    <span className="font-black text-[10px] uppercase text-muted-foreground">Ou</span>
                    <div className="h-[2px] bg-foreground/10 flex-1" />
                </div>

                {/* Doorstep Option */}
                <section className="flex flex-col gap-3">
                    <h3 className="stencil-text text-sm uppercase text-primary">OPÇÃO 2: COLETA NA PORTA</h3>
                    <button
                        disabled={loading}
                        onClick={handleSelectDoorstep}
                        className="card p-6 bg-black text-white border-black hover:bg-zinc-800 transition-colors text-left flex justify-between items-center border-b-4 border-r-4"
                    >
                        <div className="flex items-center gap-4">
                            <Truck size={32} />
                            <div>
                                <p className="font-black text-sm uppercase">BUSCAR NA MINHA CASA</p>
                                <p className="font-bold text-[10px] uppercase text-zinc-400">Logística de rota otimizada.</p>
                            </div>
                        </div>
                        <ArrowRight size={24} />
                    </button>
                </section>
            </div>

            <div className="p-4 bg-muted/20 border-l-4 border-foreground">
                <p className="text-[10px] font-bold leading-tight uppercase">
                    <span className="font-black">DICA:</span> Entregar no Ponto ECO ajuda a reduzir as emissões das rotas e agiliza o processo de triagem.
                </p>
            </div>
        </div>
    );
}
