"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    GraduationCap,
    BarChart3,
    Download,
    Users,
    ChevronRight,
    MapPin,
    CheckCircle2,
    ShieldAlert
} from "lucide-react";

export default function AdminFormacaoPage() {
    const [cells, setCells] = useState<any[]>([]);
    const [selectedCellId, setSelectedCellId] = useState<string>("");
    const [stats, setStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function loadInitial() {
            setLoading(true);
            const { data: cData } = await supabase.from("eco_cells").select("*").order("name");
            setCells(cData || []);
            if (cData && cData.length > 0) {
                setSelectedCellId(cData[0].id);
                await loadCellStats(cData[0].id);
            }
            setLoading(false);
        }
        loadInitial();
    }, [supabase]);

    const loadCellStats = async (cellId: string) => {
        setLoading(true);
        // Simplified aggregation: count completed tracks for users associated with this cell
        // In a real scenario, we'd join with cell_profiles or similar.
        // For now, we'll fetch all certificates and simulate cell grouping if needed, 
        // or just show global completions if the schema doesn't yet have per-user cell association.

        const { data: tData } = await supabase.from("eco_training_tracks").select("*").order("title");
        const { data: cData } = await supabase.from("eco_training_certificates").select("track_id");

        if (tData) {
            const aggregated = tData.map(track => ({
                ...track,
                completions: cData?.filter(c => c.track_id === track.id).length || 0
            }));
            setStats(aggregated);
        }
        setLoading(false);
    };

    const exportCSV = () => {
        const headers = ["Trilha", "Concluídos"];
        const rows = stats.map(s => [s.title, s.completions]);
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `formacao_eco_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    if (loading) return <LoadingBlock text="Analizando prontidão de formação..." />;

    const currentCell = cells.find(c => c.id === selectedCellId);

    return (
        <div className="animate-slide-up pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div className="flex items-center gap-3">
                    <GraduationCap className="text-primary" size={40} />
                    <h1 className="stencil-text text-4xl">GESTÃO DE FORMAÇÃO</h1>
                </div>

                <div className="flex gap-4">
                    <select
                        className="field min-w-[200px]"
                        value={selectedCellId}
                        onChange={(e) => {
                            setSelectedCellId(e.target.value);
                            loadCellStats(e.target.value);
                        }}
                    >
                        {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    <button className="cta-button small bg-white" onClick={exportCSV}>
                        <Download size={16} /> EXPORTAR
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 flex flex-col gap-8">
                    {/* Resumo da Célula */}
                    <section className="card bg-white border-2 border-foreground p-8 border-dashed">
                        <h2 className="stencil-text text-xl mb-6 flex items-center gap-2">
                            STATUS: {currentCell?.name}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {stats.map(track => (
                                <div key={track.id} className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black uppercase opacity-60 line-clamp-1">{track.title}</span>
                                    <div className="flex items-end gap-2">
                                        <span className="text-3xl font-black">{track.completions}</span>
                                        <span className="text-[10px] font-bold pb-1 opacity-50 uppercase">Formados</span>
                                    </div>
                                    <div className="w-full h-1 bg-muted mt-2">
                                        <div
                                            className="h-full bg-primary"
                                            style={{ width: `${Math.min(100, (track.completions / 5) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Alertas de Prontidão */}
                    <section>
                        <h2 className="stencil-text text-xs mb-4 uppercase opacity-50 flex items-center gap-2">
                            <ShieldAlert size={14} /> ALERTAS DE CAPACITAÇÃO
                        </h2>
                        <div className="flex flex-col gap-4">
                            {stats.some(s => s.completions < 1) && (
                                <div className="card bg-red-50 border-2 border-red-600 p-4 flex gap-4 items-center">
                                    <ShieldAlert className="text-red-600 shrink-0" size={24} />
                                    <div>
                                        <p className="font-black text-xs uppercase text-red-600">Gargalo Crítico de Formação</p>
                                        <p className="text-[9px] font-bold uppercase opacity-70">A célula não possui cooperados formados em algumas trilhas mandatórias para escala.</p>
                                    </div>
                                </div>
                            )}
                            {stats.every(s => s.completions >= 2) && (
                                <div className="card bg-green-50 border-2 border-green-600 p-4 flex gap-4 items-center">
                                    <CheckCircle2 className="text-green-600 shrink-0" size={24} />
                                    <div>
                                        <p className="font-black text-xs uppercase text-green-600">Território Pronto para Escala</p>
                                        <p className="text-[9px] font-bold uppercase opacity-70">A célula possui redundância de operadores formados em todas as áreas core.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {/* Sidebar: Curadoria Local */}
                <aside className="flex flex-col gap-8">
                    <section className="card bg-foreground text-white border-foreground p-6 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                        <h3 className="stencil-text text-sm mb-4 text-primary">TRILHA DA CÉLULA</h3>
                        <p className="text-[10px] font-bold uppercase opacity-70 mb-6 leading-relaxed">
                            Adicione conteúdo específico sobre os galpões, horários e rituais locais do seu território.
                        </p>
                        <button className="cta-button small w-full justify-center bg-white text-black">
                            CRIAR TRILHA LOCAL
                        </button>
                    </section>

                    <section className="card border-2 border-foreground bg-white p-6">
                        <h3 className="stencil-text text-sm mb-4 uppercase">POLÍTICA DE FORMADORES</h3>
                        <div className="flex flex-col gap-4">
                            <div className="bg-muted/10 p-3 border-l-4 border-foreground">
                                <p className="text-[9px] font-black uppercase mb-1">Rotatividade</p>
                                <p className="text-[9px] font-bold opacity-60 leading-tight uppercase">Cada operador formado deve preparar um sucessor em até 6 meses.</p>
                            </div>
                            <div className="bg-muted/10 p-3 border-l-4 border-foreground">
                                <p className="text-[9px] font-black uppercase mb-1">Validação Prática</p>
                                <p className="text-[9px] font-bold opacity-60 leading-tight uppercase">Certificados são o ponto de partida. A maestria se prova no campo.</p>
                            </div>
                        </div>
                    </section>
                </aside>
            </div>

            <style jsx>{`
                .card { border-radius: 0; }
            `}</style>
        </div>
    );
}
