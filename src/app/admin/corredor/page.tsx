"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    Route, ChevronRight, CheckCircle2, Circle, AlertCircle, ShieldAlert,
    PauseCircle, PlayCircle, Lock, Activity, Users, Settings, Waves
} from "lucide-react";
import Link from "next/link";
import { ProtectedRouteGate } from "@/components/protected-route-gate";

export default function LaunchCorridorDashboard() {
    return (
        <ProtectedRouteGate>
            <CorridorClient />
        </ProtectedRouteGate>
    );
}

function CorridorClient() {
    const [cells, setCells] = useState<any[]>([]);
    const [selectedCellId, setSelectedCellId] = useState("");

    const [activeCorridor, setActiveCorridor] = useState<any>(null);
    const [corridorRules, setCorridorRules] = useState<any>(null);
    const [neighborhoods, setNeighborhoods] = useState<any[]>([]);
    const [suggestion, setSuggestion] = useState<any>(null);

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        async function loadInitial() {
            setLoading(true);
            const { data: cData } = await supabase.from("eco_cells").select("*").order("name");
            if (cData && cData.length > 0) {
                setCells(cData);
                setSelectedCellId(cData[0].id);
            }
            setLoading(false);
        }
        loadInitial();
    }, [supabase]);

    useEffect(() => {
        if (!selectedCellId) return;
        loadCorridor();
    }, [selectedCellId]);

    const loadCorridor = async () => {
        setLoading(true);
        // GET latest active corridor for cell
        const { data: cData } = await supabase
            .from("eco_launch_corridors")
            .select("*")
            .eq("cell_id", selectedCellId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        setActiveCorridor(cData);

        if (cData) {
            const { data: rData } = await supabase.from("eco_corridor_rules").select("*").eq("corridor_id", cData.id).single();
            setCorridorRules(rData);

            const { data: nData } = await supabase
                .from("eco_corridor_neighborhoods")
                .select("*, neighborhood:neighborhoods(name)")
                .eq("corridor_id", cData.id)
                .order("order_index", { ascending: true });
            setNeighborhoods(nData || []);
        } else {
            setCorridorRules(null);
            setNeighborhoods([]);
        }
        setSuggestion(null);
        setLoading(false);
    };

    const getRecommendation = async () => {
        if (!activeCorridor) return;
        setActionLoading(true);
        const { data, error } = await supabase.rpc("rpc_suggest_corridor_next_open", { p_corridor_id: activeCorridor.id });
        if (error) {
            alert(error.message);
        } else {
            setSuggestion(data);
        }
        setActionLoading(false);
    };

    const applyOpening = async (neighborhoodId: string, mode: string) => {
        if (!activeCorridor) return;
        if (!confirm(`Abrir bairro no modo: ${mode.toUpperCase()}? (Isso criará rampas e liberará open data)`)) return;

        setActionLoading(true);
        const { error } = await supabase.rpc("rpc_apply_corridor_opening", {
            p_corridor_id: activeCorridor.id,
            p_neighborhood_id: neighborhoodId,
            p_mode: mode
        });

        if (error) {
            alert("Erro: " + error.message);
        } else {
            alert("Bairro ativado com sucesso. Automações engatilhadas (Campanhas, Feeds e Limits).");
            await loadCorridor();
        }
        setActionLoading(false);
    };

    const killGlobal = async () => {
        if (!activeCorridor) return;
        if (!confirm("Isso pausará a progressão do CORREDOR inteiro. Confirmar?")) return;
        setActionLoading(true);
        await supabase.from("eco_launch_corridors").update({ status: 'paused' }).eq("id", activeCorridor.id);
        await loadCorridor();
        setActionLoading(false);
    };

    const getStatusBlock = (status: string) => {
        switch (status) {
            case 'queued': return <span className="text-[9px] font-black uppercase bg-muted text-foreground px-1 py-0.5">NA FILA (BLOQUEADO)</span>;
            case 'invite_only': return <span className="text-[9px] font-black uppercase bg-black text-white px-1 py-0.5 shadow-[2px_2px_0_0_rgba(255,193,7,1)]">INVITE-ONLY</span>;
            case 'open_gradual': return <span className="text-[9px] font-black uppercase bg-primary text-black px-1 py-0.5 shadow-[2px_2px_0_0_rgba(0,0,0,1)]">RAMP GRADUAL</span>;
            case 'open_public': return <span className="text-[9px] font-black uppercase bg-green-500 text-white px-1 py-0.5">TOTALMENTE PÚBLICO</span>;
            case 'paused': return <span className="text-[9px] font-black uppercase bg-red-600 text-white px-1 py-0.5">PAUSADO (KILL SWITCH)</span>;
            default: return <span>{status}</span>;
        }
    };

    if (loading && cells.length === 0) return <LoadingBlock text="Carregando Células..." />;

    return (
        <div className="animate-slide-up pb-20 p-4 md:p-8">
            <Link href="/admin" className="text-[10px] font-black uppercase text-muted underline mb-4 flex w-fit">
                &lt; VOLTAR PARA O PAINEL ADMIN
            </Link>

            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-3">
                    <Waves className="text-secondary" size={40} />
                    <h1 className="stencil-text text-4xl leading-none">CORREDOR DE EXPANSÃO (A59)</h1>
                </div>

                <div className="flex gap-4 items-center flex-wrap bg-white p-2 border-2 border-foreground">
                    <span className="text-[10px] font-black uppercase opacity-60">Célula Alvo:</span>
                    <select
                        className="p-1 border border-foreground/20 text-xs font-bold uppercase min-w-[150px]"
                        value={selectedCellId}
                        onChange={(e) => setSelectedCellId(e.target.value)}
                    >
                        {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </header>

            {!activeCorridor ? (
                <div className="card text-center py-12 border-dashed border-4 border-foreground/30">
                    <Waves className="mx-auto mb-4 opacity-10" size={64} />
                    <p className="stencil-text text-2xl mb-2">NENHUM CORREDOR ATIVO</p>
                    <p className="font-bold text-xs uppercase opacity-70 mb-6">A expansão sequencial por bairros ainda não foi traçada nesta célula.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    <div className="bg-white border-4 border-foreground shadow-[6px_6px_0_0_rgba(0,0,0,1)] p-6">
                        <div className="flex justify-between items-start mb-6 border-b-2 border-foreground/10 pb-4">
                            <div>
                                <h2 className="stencil-text text-2xl">{activeCorridor.title}</h2>
                                <p className="text-[10px] font-black uppercase opacity-60 mt-1">STATUS DO MACRO-CORREDOR: <span className={activeCorridor.status === 'active' ? 'text-green-600' : 'text-red-600'}>{activeCorridor.status}</span></p>
                            </div>
                            <div className="flex bg-muted/20 p-2 border border-foreground/20 text-[9px] font-black uppercase gap-4 text-center">
                                <div><span className="opacity-50 block mb-1">HEALTH MIN</span> <Activity className="inline w-3 h-3" /> {corridorRules?.min_health_score}</div>
                                <div><span className="opacity-50 block mb-1">WEEKS OK</span> <CheckCircle2 className="inline w-3 h-3" /> {corridorRules?.required_weeks_stable}</div>
                                <div><span className="opacity-50 block mb-1">MAX SEV1</span> <ShieldAlert className="inline w-3 h-3 text-red-500" /> {corridorRules?.max_open_incidents_critical}</div>
                            </div>
                        </div>

                        {/* Recommendation Engine Box */}
                        <div className="mb-8 p-4 bg-primary/10 border-2 border-primary border-dashed">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-black text-[10px] uppercase flex items-center gap-2">
                                    <Activity size={14} /> ALGORITMO DE ESTABILIDADE (A25/A32/A58)
                                </h3>
                                <button
                                    onClick={getRecommendation}
                                    disabled={actionLoading || activeCorridor.status !== 'active'}
                                    className="bg-primary hover:bg-primary-dark text-black px-3 py-1 text-[10px] font-black uppercase transition-colors"
                                >
                                    {actionLoading ? "Processando..." : "SUGERIR PRÓXIMO DA FILA"}
                                </button>
                            </div>

                            {suggestion && (
                                <div className="mt-4 p-4 bg-white border-2 border-foreground shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                                    <div className="flex gap-4 items-center mb-4">
                                        <div className={`p-2 font-black text-white ${suggestion.readiness ? 'bg-green-600' : 'bg-red-600'}`}>
                                            {suggestion.readiness ? 'SAFE TO PROCEED' : 'NO GO (RISK DETECTED)'}
                                        </div>
                                        <p className="text-[10px] font-bold uppercase opacity-80">
                                            {suggestion.finished ? "FIM DA LINHA (CORREDOR VAZIO)" : "ANÁLISE DO PREDECESSOR E LIMITES CLÍNICOS CONCLUÍDA."}
                                        </p>
                                    </div>

                                    {suggestion.reasons?.length > 0 && (
                                        <ul className="text-xs font-bold opacity-80 list-disc pl-5 text-red-800 mb-4 space-y-1">
                                            {suggestion.reasons.map((r: string, idx: number) => <li key={idx}>{r}</li>)}
                                        </ul>
                                    )}

                                    {suggestion.readiness && suggestion.candidate_neighborhood_id && (
                                        <div className="flex gap-2 p-2 bg-green-50">
                                            <button
                                                onClick={() => applyOpening(suggestion.candidate_neighborhood_id, 'invite_only')}
                                                className="flex-1 bg-black text-white p-2 text-[10px] font-black uppercase text-center hover:bg-zinc-800"
                                            >
                                                LIBERAR INVITE-ONLY
                                            </button>
                                            <button
                                                onClick={() => applyOpening(suggestion.candidate_neighborhood_id, 'open_gradual')}
                                                className="flex-1 bg-primary text-black p-2 text-[10px] font-black uppercase text-center hover:bg-primary-dark"
                                            >
                                                LIBERAR RAMP GRADUAL
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Wave Visualizer */}
                        <div className="relative">
                            <div className="absolute top-0 bottom-0 left-6 w-1 bg-foreground/10 z-0"></div>
                            <div className="space-y-4">
                                {neighborhoods.map((n, idx) => (
                                    <div key={n.neighborhood_id} className="relative z-10 flex gap-4 items-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-2 border-foreground shadow-[2px_2px_0_0_rgba(0,0,0,1)]
                                            ${n.status !== 'queued' && n.status !== 'paused' ? 'bg-primary text-black' : 'bg-muted text-foreground'}
                                        `}>
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 bg-white border-2 border-foreground shadow-[4px_4px_0_0_rgba(0,0,0,1)] p-4 flex justify-between items-center group">
                                            <div>
                                                <h4 className="font-bold text-sm uppercase">{n.neighborhood.name}</h4>
                                                <div className="mt-1">{getStatusBlock(n.status)}</div>
                                            </div>
                                            {n.status === 'queued' ? (
                                                <Lock className="opacity-20 text-foreground" size={20} />
                                            ) : (
                                                <span className="text-[9px] font-black uppercase opacity-60">
                                                    Ativado em: {new Date(n.opened_at).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t-2 border-foreground/10 flex justify-between items-center">
                            <p className="text-[9px] font-bold uppercase opacity-50 flex gap-4">
                                <Link href="/admin/saude">↗ Saúde (A25)</Link>
                                <Link href="/admin/ramp">↗ Ramp Control (A33)</Link>
                                <Link href="/admin/hotfix">↗ Hotfixes (A58)</Link>
                            </p>

                            <button onClick={killGlobal} className="bg-red-600 text-white flex items-center gap-1 text-[10px] font-black uppercase px-3 py-1.5 hover:bg-red-700">
                                <PauseCircle size={14} /> PAUSAR CORREDOR (GLOBAL)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
