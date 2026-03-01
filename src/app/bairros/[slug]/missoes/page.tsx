"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase";
import { Target, Users, Zap, Calendar, Heart, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Mission {
    id: string;
    kind: 'bring_neighbor' | 'become_anchor' | 'start_recurring' | 'reactivate_point';
    title: string;
    body: string;
    active: boolean;
    progress?: {
        progress_count: number;
        goal_count: number;
    }[];
}

export default function NeighborhoodMissionsPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const [loading, setLoading] = useState(true);
    const [neighborhood, setNeighborhood] = useState<{ id: string, name: string } | null>(null);
    const [missions, setMissions] = useState<Mission[]>([]);
    const supabase = createClient();

    useEffect(() => {
        async function load() {
            setLoading(true);
            const { data: nData } = await supabase
                .from("neighborhoods")
                .select("id, name")
                .eq("slug", slug)
                .single();

            if (nData) {
                setNeighborhood(nData);
                const { data: mData } = await supabase
                    .from("community_missions")
                    .select("*, progress:mission_progress(*)")
                    .eq("neighborhood_id", nData.id)
                    .eq("active", true);
                setMissions(mData || []);
            }
            setLoading(false);
        }
        load();
    }, [slug, supabase]);

    const getIcon = (kind: string) => {
        switch (kind) {
            case 'bring_neighbor': return <Users size={24} className="text-primary" />;
            case 'become_anchor': return <Heart size={24} className="text-accent" />;
            case 'start_recurring': return <Calendar size={24} className="text-primary" />;
            case 'reactivate_point': return <Zap size={24} className="text-yellow-400" />;
            default: return <Target size={24} />;
        }
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={48} /></div>;
    if (!neighborhood) return <div className="p-20 text-center font-black uppercase">Bairro não encontrado</div>;

    return (
        <div className="container max-w-2xl py-8 animate-slide-up">
            <div className="flex items-center gap-4 mb-8">
                <Link href={`/bairros/${slug}`} className="p-2 border-2 border-foreground hover:bg-primary transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <header className="space-y-1">
                    <h1 className="stencil-text text-3xl uppercase leading-none">Missões do Comum</h1>
                    <p className="font-black text-[10px] uppercase text-muted-foreground">
                        Território: <span className="text-foreground">{neighborhood.name}</span>
                    </p>
                </header>
            </div>

            <div className="flex flex-col gap-6">
                {missions.map(mission => {
                    const progress = mission.progress?.[0] || { progress_count: 0, goal_count: 10 };
                    const pct = Math.min(100, (progress.progress_count / progress.goal_count) * 100);

                    return (
                        <section key={mission.id} className="card bg-white hover:border-primary transition-all p-6 border-b-4 border-r-4">
                            <div className="flex gap-4 items-start mb-6">
                                <div className="bg-muted p-3 border-2 border-foreground/10 shrink-0">
                                    {getIcon(mission.kind)}
                                </div>
                                <div className="space-y-1">
                                    <h3 className="stencil-text text-xl uppercase leading-tight">{mission.title}</h3>
                                    <p className="font-bold text-[10px] text-muted-foreground uppercase leading-tight">
                                        {mission.body}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <span className="font-black text-[10px] uppercase">Progresso Coletivo</span>
                                    <span className="font-black text-sm">{progress.progress_count} / {progress.goal_count}</span>
                                </div>
                                <div className="w-full bg-muted h-3 border-2 border-foreground overflow-hidden">
                                    <div
                                        className="h-full bg-primary border-r-2 border-foreground transition-all duration-1000"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <p className="text-[8px] font-bold italic uppercase opacity-60">
                                    *Atualizado em tempo real pelas ações do bairro.
                                </p>
                            </div>
                        </section>
                    );
                })}

                {missions.length === 0 && (
                    <div className="card border-dashed py-16 flex flex-col items-center text-center gap-4">
                        <Target size={48} className="text-muted-foreground opacity-20" />
                        <p className="font-black text-sm uppercase text-muted-foreground">Nenhuma missão ativa no momento.</p>
                        <p className="text-[10px] font-bold uppercase max-w-xs">
                            O administrador do bairro ainda não definiu as metas para este ciclo.
                        </p>
                    </div>
                )}
            </div>

            <footer className="mt-16 p-6 border-t-4 border-foreground bg-muted/10">
                <p className="text-[10px] font-bold uppercase leading-snug">
                    Missões do comum são metas compartilhadas. Não há ranking individual, apenas o fortalecimento da nossa rede local.
                    <span className="font-black text-primary"> Sua ação é a nossa prova.</span>
                </p>
            </footer>
        </div>
    );
}
