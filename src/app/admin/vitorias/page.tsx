"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    Trophy,
    RefreshCw,
    Share2,
    CheckCircle2,
    FileText,
    TrendingUp,
    ShieldCheck
} from "lucide-react";
import Link from "next/link";

export default function AdminVitoriasPage() {
    const [loading, setLoading] = useState(true);
    const [cells, setCells] = useState<any[]>([]);
    const [selectedCell, setSelectedCell] = useState<string>("");
    const [weekStart, setWeekStart] = useState<string>("");
    const [win, setWin] = useState<any>(null);
    const [generating, setGenerating] = useState(false);
    const [publishing, setPublishing] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        // Init default week (Monday)
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff)).toISOString().split('T')[0];
        setWeekStart(monday);

        loadCells();
    }, []);

    useEffect(() => {
        if (selectedCell && weekStart) {
            loadWin(selectedCell, weekStart);
        }
    }, [selectedCell, weekStart]);

    const loadCells = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: mandates } = await supabase.from("eco_mandates").select("cell_id").eq("user_id", user.id).eq("status", "active");
        const cellIds = mandates?.map(m => m.cell_id) || [];

        const { data: cData } = await supabase.from("eco_cells").select("*").in("id", cellIds).order("name");
        setCells(cData || []);

        if (cData && cData.length > 0) {
            setSelectedCell(cData[0].id);
        }
        setLoading(false);
    };

    const loadWin = async (cellId: string, wStart: string) => {
        setLoading(true);
        const { data } = await supabase
            .from("eco_collective_wins_weekly")
            .select("*")
            .eq("cell_id", cellId)
            .is("neighborhood_id", null) // Foco célula level
            .eq("week_start", wStart)
            .maybeSingle();

        setWin(data);
        setLoading(false);
    };

    const handleGenerateDraft = async () => {
        if (!selectedCell || !weekStart) return;
        setGenerating(true);

        const { error } = await supabase.rpc('rpc_generate_collective_wins', {
            p_cell_id: selectedCell,
            p_week_start: weekStart
        });

        if (error) {
            alert("Erro ao gerar rascunho: " + error.message);
        } else {
            await loadWin(selectedCell, weekStart);
        }
        setGenerating(false);
    };

    const handlePublish = async () => {
        if (!win) return;
        setPublishing(true);

        const { error } = await supabase
            .from("eco_collective_wins_weekly")
            .update({ status: 'published' })
            .eq("id", win.id);

        if (error) {
            alert("Erro ao publicar: " + error.message);
        } else {
            setWin({ ...win, status: 'published' });
            alert("Vitórias do Comum publicadas com sucesso! Disponíveis no bairro.");
        }
        setPublishing(false);
    };

    const handleGenerateCard = () => {
        window.open(`/api/share/card?kind=collective_wins_week&neighborhood_slug=${selectedCell}`, '_blank');
        // Usar slugs reais (A19 route adapta params custom para preview, idealmente passaria ID da win ou slug se renderizado do server)
        alert("Em A19, isso conectaria a geração visual passando o payload das métricas. Para mock de rota: gerando...");
    };

    if (loading && cells.length === 0) return <LoadingBlock text="Sintonizando reconhecimentos..." />;

    return (
        <div className="animate-slide-up pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b-4 border-foreground pb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-secondary text-white rounded-sm shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                        <Trophy size={32} />
                    </div>
                    <div>
                        <h1 className="stencil-text text-4xl uppercase tracking-tighter">VITÓRIAS DO COMUM</h1>
                        <p className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                            <ShieldCheck size={12} /> RECONHECIMENTO AGREGADO E ANTI-CULPA
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <select
                        className="field py-2 text-[10px] font-black uppercase bg-white border-2"
                        value={selectedCell}
                        onChange={e => setSelectedCell(e.target.value)}
                    >
                        {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input
                        type="date"
                        className="field py-2 text-[10px] font-black uppercase bg-white border-2 w-40"
                        value={weekStart}
                        onChange={e => setWeekStart(e.target.value)}
                    />
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-8">
                    {!win ? (
                        <div className="py-24 text-center border-4 border-dashed border-foreground/20 bg-muted/5">
                            <Trophy size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="stencil-text text-xl mb-2">Nenhum rascunho para esta semana</p>
                            <p className="text-[10px] font-bold uppercase opacity-60 max-w-sm mx-auto mb-6">
                                O sistema avaliará automaticamente métricas de qualidade, evidências anexadas e tarefas entregues (A51+A50+A52) para compor a narrativa do cuidar.
                            </p>
                            <button
                                onClick={handleGenerateDraft}
                                disabled={generating}
                                className="cta-button bg-foreground text-white mx-auto disabled:opacity-50"
                            >
                                <RefreshCw size={16} className={generating ? "animate-spin" : ""} />
                                {generating ? "PROCESSANDO DADOS..." : "SINTETIZAR VITÓRIA"}
                            </button>
                        </div>
                    ) : (
                        <div className="card bg-white border-4 border-foreground shadow-[8px_8px_0_0_rgba(0,0,0,1)] p-8">
                            <div className="flex justify-between items-start mb-6 pb-6 border-b-2 border-foreground/10">
                                <div>
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 border-2 ${win.status === 'published' ? 'border-primary bg-primary text-black' : 'border-dashed border-foreground/30'}`}>
                                        {win.status === 'published' ? 'PUBLICADO PUBLICAMENTE' : 'RASCUNHO PRIVADO'}
                                    </span>
                                    <h2 className="stencil-text text-3xl mt-4 leading-tight">{win.title}</h2>
                                    <p className="text-[10px] font-bold uppercase opacity-50 mt-1">SEMANA DE {new Date(win.week_start).toLocaleDateString('pt-BR')}</p>
                                </div>
                            </div>

                            <div className="prose max-w-none text-sm font-bold leading-relaxed mb-8 bg-muted/10 p-6 border border-foreground/5 whitespace-pre-wrap">
                                {win.body_md}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                <div className="p-3 border-2 border-primary/20 bg-primary/5 text-center">
                                    <span className="block text-[8px] font-black opacity-50 mb-1">QUALIDADE</span>
                                    <span className="stencil-text text-xl text-primary">{win.highlights?.ok_rate || 0}%</span>
                                </div>
                                <div className="p-3 border-2 border-secondary/20 bg-secondary/5 text-center">
                                    <span className="block text-[8px] font-black opacity-50 mb-1">TAREFAS VOLUNTÁRIAS</span>
                                    <span className="stencil-text text-xl text-secondary">{win.highlights?.tasks_done_count || 0}</span>
                                </div>
                                <div className="p-3 border-2 border-green-600/20 bg-green-50 text-center">
                                    <span className="block text-[8px] font-black opacity-50 mb-1">VOLUMES COLETADOS</span>
                                    <span className="stencil-text text-xl text-green-700">{win.highlights?.receipts_count || 0}</span>
                                </div>
                                <div className="p-3 border-2 border-foreground/10 text-center">
                                    <span className="block text-[8px] font-black opacity-50 mb-1">EVIDÊNCIAS APROVADAS</span>
                                    <span className="stencil-text text-xl">{win.highlights?.evidence_approved_count || 0}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="card border-2 border-foreground bg-primary/10 p-6">
                        <h3 className="stencil-text text-sm mb-4 border-b border-foreground/20 pb-2">AÇÕES EDITORIAIS</h3>

                        <div className="space-y-3">
                            {win?.status === 'draft' && (
                                <button
                                    onClick={handlePublish}
                                    disabled={publishing}
                                    className="cta-button w-full justify-center bg-black text-white disabled:opacity-50"
                                >
                                    <CheckCircle2 size={16} /> {publishing ? "TORNANDO PÚBLICO..." : "PUBLICAR VITÓRIA"}
                                </button>
                            )}

                            {win && (
                                <button
                                    onClick={handleGenerateDraft}
                                    disabled={generating}
                                    className="cta-button w-full justify-center bg-white border-2 border-foreground"
                                >
                                    <RefreshCw size={16} className={generating ? "animate-spin" : ""} /> RE-GERAR DADOS
                                </button>
                            )}

                            {win?.status === 'published' && (
                                <button
                                    onClick={handleGenerateCard}
                                    className="cta-button w-full justify-center bg-secondary text-white mt-4"
                                >
                                    <Share2 size={16} /> GERAR CARD MÍDIA (A19)
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="card text-xs font-bold opacity-60 border-2 border-dashed border-foreground/20 p-4 space-y-2">
                        <p><TrendingUp size={14} className="inline mr-1" /> Os dados refletem o esforço somado da célula.</p>
                        <p><ShieldCheck size={14} className="inline mr-1" /> Nossa narrativa exclui rankings individuais para prevenir competição, valorizando a solidariedade e aprendizado coletivo (Anti-Culpa).</p>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .card { border-radius: 0; }
                .field { border-radius: 0; }
            `}</style>
        </div>
    );
}
