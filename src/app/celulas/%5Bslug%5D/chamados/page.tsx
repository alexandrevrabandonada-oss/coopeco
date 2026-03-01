"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    Megaphone,
    Clock,
    AlertTriangle,
    ChevronRight,
    MapPin,
    Zap,
    Heart,
    Filter
} from "lucide-react";
import Link from "next/link";

export default function CellCallsPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const [loading, setLoading] = useState(true);
    const [cell, setCell] = useState<any>(null);
    const [calls, setCalls] = useState<any[]>([]);
    const [filterKind, setFilterKind] = useState<string>("all");
    const supabase = createClient();

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            const { data: cData } = await supabase.from("eco_cells").select("*").eq("slug", slug).single();
            if (cData) {
                setCell(cData);
                const { data: callsData } = await supabase
                    .from("eco_calls")
                    .select("*, neighborhood:neighborhoods(name)")
                    .eq("cell_id", cData.id)
                    .eq("status", "open")
                    .order("created_at", { ascending: false });
                setCalls(callsData || []);
            }
            setLoading(false);
        }
        loadData();
    }, [slug, supabase]);

    const getKindBadge = (kind: string) => {
        const colors: Record<string, string> = {
            volunteer: 'bg-primary text-black',
            cooperado_extra: 'bg-secondary text-white',
            mutirao: 'bg-green-600 text-white',
            comms: 'bg-blue-600 text-white',
            logistics: 'bg-orange-600 text-white',
            dev: 'bg-black text-white'
        };
        return <span className={`px-2 py-0.5 text-[8px] font-black uppercase ${colors[kind] || 'bg-muted'}`}>{kind.replace('_', ' ')}</span>;
    };

    const getUrgencyBadge = (urgency: string) => {
        if (urgency === 'high') return <span className="flex items-center gap-1 text-red-600 font-black text-[8px] animate-pulse"><AlertTriangle size={10} /> URGENTE</span>;
        return null;
    };

    const filteredCalls = filterKind === "all" ? calls : calls.filter(c => c.kind === filterKind);

    if (loading) return <LoadingBlock text="Sintonizando chamados do comum..." />;
    if (!cell) return <div className="p-20 text-center font-black uppercase">Célula não encontrada.</div>;

    return (
        <div className="animate-slide-up pb-20">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b-4 border-foreground pb-8">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-foreground text-white rounded-sm">
                        <Megaphone size={40} />
                    </div>
                    <div>
                        <h1 className="stencil-text text-5xl uppercase tracking-tighter">CHAMADOS DO COMUM</h1>
                        <p className="text-xs font-black uppercase opacity-60 flex items-center gap-2 mt-1">
                            <MapPin size={14} className="text-primary" /> CÉLULA {cell.name}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Filter className="opacity-40" size={16} />
                    <select
                        className="field text-[10px] font-black uppercase py-1 min-w-[150px]"
                        value={filterKind}
                        onChange={e => setFilterKind(e.target.value)}
                    >
                        <option value="all">TODOS OS TIPOS</option>
                        <option value="volunteer">VOLUNTARIADO</option>
                        <option value="cooperado_extra">COOPERADO EXTRA</option>
                        <option value="mutirao">MUTIRÃO</option>
                        <option value="comms">COMUNICAÇÃO</option>
                        <option value="logistics">LOGÍSTICA</option>
                    </select>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredCalls.map(call => (
                    <Link
                        key={call.id}
                        href={`/celulas/${slug}/chamados/${call.id}`}
                        className="card group bg-white border-2 border-foreground hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all p-6 relative flex flex-col justify-between shadow-[4px_4px_0_0_rgba(0,0,0,1)]"
                    >
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-2">
                                    {getKindBadge(call.kind)}
                                    {getUrgencyBadge(call.urgency)}
                                </div>
                                <span className="text-[10px] font-bold opacity-40 uppercase">{new Date(call.created_at).toLocaleDateString()}</span>
                            </div>

                            <h3 className="stencil-text text-xl mb-3 group-hover:text-primary transition-colors leading-tight">{call.title}</h3>
                            <div className="flex flex-wrap gap-1 mb-6">
                                {call.skill_slugs?.map((s: string) => (
                                    <span key={s} className="px-1.5 py-0.5 bg-muted/20 text-[8px] font-bold uppercase border border-foreground/10">{s}</span>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-foreground/5">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black uppercase opacity-40">Local</span>
                                <span className="text-[10px] font-black uppercase">{call.neighborhood?.name || 'Toda a Célula'}</span>
                            </div>
                            <div className="cta-button tiny group-hover:bg-primary group-hover:text-foreground">
                                AJUDAR <ChevronRight size={12} />
                            </div>
                        </div>
                    </Link>
                ))}

                {filteredCalls.length === 0 && (
                    <div className="md:col-span-2 py-32 text-center border-4 border-dashed border-foreground/10">
                        <Heart className="mx-auto mb-4 opacity-10" size={64} />
                        <p className="stencil-text text-2xl opacity-20">NENHUM CHAMADO ABERTO</p>
                        <p className="text-[10px] font-black uppercase opacity-20 tracking-widest mt-2">AUTOCUIDADO E EQUILÍBRIO EM DIA</p>
                    </div>
                )}
            </div>

            <style jsx>{`
                .card { border-radius: 0; }
            `}</style>
        </div>
    );
}
