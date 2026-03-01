"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import { Link2, Leaf, ShieldCheck, HeartHandshake, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

// Helper to get Monday of a given date
const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff)).toISOString().split('T')[0];
};

export default function NeighborhoodImpactPage({ params }: { params: { slug: string } }) {
    const [neighborhood, setNeighborhood] = useState<any>(null);
    const [recentImpacts, setRecentImpacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const supabase = createClient();

    useEffect(() => {
        async function loadData() {
            // 1. Resolve neighborhood by slug
            const { data: nData, error: nError } = await supabase
                .from("neighborhoods")
                .select("*, eco_cell_neighborhoods(cell_id, eco_cells(name))")
                .eq("slug", params.slug)
                .single();

            if (nError || !nData) {
                notFound();
                return;
            }
            setNeighborhood(nData);

            // 2. Fetch public metrics from the view
            // We query the underlying table using the supabase anon key. 
            // NOTE: We rely on the view `v_impact_public_weekly` which we need to fetch. 
            // If RLS blocks it, we fallback to an RPC or adjust RLS. 
            // For now, let's query the view.
            const { data: metricsData } = await supabase
                .from("v_impact_public_weekly")
                .select("*")
                .eq("neighborhood_id", nData.id)
                .order("week_start", { ascending: false })
                .limit(4);

            setRecentImpacts(metricsData || []);
            setLoading(false);
        }
        loadData();
    }, [params.slug, supabase]);

    if (loading) return <LoadingBlock text="Carregando impacto local..." />;
    if (!neighborhood) return null;

    const currentWeekInfo = recentImpacts[0];
    const thisMonday = getMonday(new Date());

    // Se a view mais recente for a semana atual
    const isCurrentWeek = currentWeekInfo && currentWeekInfo.week_start === thisMonday;
    const displayInfo = isCurrentWeek ? currentWeekInfo : null;

    return (
        <div className="min-h-screen bg-background font-mono text-foreground p-4 md:p-8 animate-slide-up">
            <div className="max-w-3xl mx-auto space-y-8">

                <Link href={`/bairros/${params.slug}`} className="inline-flex items-center gap-2 text-xs font-black uppercase hover:text-secondary transition-colors">
                    <ArrowLeft size={16} /> Voltar para o Bairro
                </Link>

                <header>
                    <h1 className="stencil-text text-4xl leading-none text-secondary mb-2">
                        IMPACTO DO COMUM
                    </h1>
                    <p className="font-bold text-lg uppercase bg-foreground text-background inline-block px-3 py-1">
                        {neighborhood.name}
                    </p>
                    <div className="mt-4 border-l-4 border-secondary pl-4 py-1">
                        <p className="text-xs font-bold uppercase opacity-80 max-w-lg">
                            O valor gerado coletivamente no bairro. Sem rankings individuais. Nossa métrica é o cuidado socioambiental e o suporte mútuo.
                        </p>
                    </div>
                </header>

                {displayInfo ? (
                    <section className="space-y-6">
                        <h2 className="font-black text-sm uppercase flex items-center gap-2 border-b-2 border-foreground pb-2">
                            ESTADO DA NAÇÃO: SEMANA ATUAL
                        </h2>

                        <div className="card bg-white border-4 border-foreground shadow-[8px_8px_0_0_rgba(0,0,0,1)] p-6 md:p-8">
                            <p className="text-lg md:text-xl font-bold leading-relaxed">
                                "Nesta semana, a rede coletou <span className="bg-primary/20 px-1 font-black">{displayInfo.receipts_count || 0} recibos</span> de cuidado, mantendo <span className="text-green-600 font-black">{displayInfo.ok_rate || 0}% de qualidade</span> na triagem.
                                A força de trabalho do bairro completou <span className="bg-secondary/20 px-1 font-black text-secondary">{displayInfo.tasks_done_count || 0} tarefas do comum</span>, e contamos com <span className="font-black underline decoration-wavy decoration-orange-400">{displayInfo.partners_anchor_active_count || 0} parceiros locais ativos</span>."
                            </p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white border-2 border-foreground p-4 text-center hover:-translate-y-1 transition-transform">
                                <div className="flex justify-center mb-2"><Leaf className="text-primary" /></div>
                                <div className="text-[10px] uppercase font-black opacity-60">Triagem (Check)</div>
                                <div className="stencil-text text-2xl">{displayInfo.receipts_count || 0}</div>
                            </div>
                            <div className="bg-white border-2 border-foreground p-4 text-center hover:-translate-y-1 transition-transform">
                                <div className="flex justify-center mb-2"><ShieldCheck className="text-green-500" /></div>
                                <div className="text-[10px] uppercase font-black opacity-60">Qualidade</div>
                                <div className="stencil-text text-2xl text-green-600">{displayInfo.ok_rate || 0}%</div>
                            </div>
                            <div className="bg-white border-2 border-foreground p-4 text-center hover:-translate-y-1 transition-transform">
                                <div className="flex justify-center mb-2"><HeartHandshake className="text-secondary" /></div>
                                <div className="text-[10px] uppercase font-black opacity-60">Apoio (Tarefas)</div>
                                <div className="stencil-text text-2xl text-secondary">{displayInfo.tasks_done_count || 0}</div>
                            </div>
                            <div className="bg-white border-2 border-foreground p-4 text-center hover:-translate-y-1 transition-transform">
                                <div className="flex justify-center mb-2"><Link2 className="text-orange-500" /></div>
                                <div className="text-[10px] uppercase font-black opacity-60">Cob. Recorrente</div>
                                <div className="stencil-text text-2xl text-orange-600">{displayInfo.recurring_coverage_pct || 0}%</div>
                            </div>
                        </div>
                    </section>
                ) : (
                    <div className="card bg-muted/10 border-2 border-dashed border-foreground/30 p-8 text-center">
                        <p className="font-bold text-xs uppercase opacity-60">Os dados desta semana ainda estão sendo processados pela Célula.</p>
                    </div>
                )}

                <section className="pt-8">
                    <h2 className="font-black text-sm uppercase flex items-center gap-2 border-b-2 border-foreground pb-2 mb-6">
                        MEMÓRIA DO COMUM (Últimas Semanas)
                    </h2>
                    <div className="space-y-2">
                        {recentImpacts.slice(isCurrentWeek ? 1 : 0).map(impact => (
                            <div key={impact.week_start} className="flex flex-col md:flex-row md:items-center justify-between p-3 border-2 border-foreground/10 bg-white/50 hover:bg-white transition-colors">
                                <span className="font-black text-xs uppercase text-secondary mb-2 md:mb-0">Semana: {impact.week_start}</span>
                                <div className="flex gap-4 md:gap-8 flex-wrap">
                                    <span className="text-[10px] font-bold uppercase"><span className="opacity-50">Recibos:</span> {impact.receipts_count || 0}</span>
                                    <span className="text-[10px] font-bold uppercase"><span className="opacity-50">Qualidade:</span> <span className="text-green-600">{impact.ok_rate || 0}%</span></span>
                                    <span className="text-[10px] font-bold uppercase"><span className="opacity-50">Tarefas:</span> {impact.tasks_done_count || 0}</span>
                                </div>
                            </div>
                        ))}
                        {recentImpacts.length <= (isCurrentWeek ? 1 : 0) && (
                            <p className="text-xs font-bold uppercase opacity-50 text-center py-4">Sem histórico anterior disponível.</p>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
