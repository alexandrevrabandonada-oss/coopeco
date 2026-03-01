"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    Rocket, ChevronRight, CheckCircle2, Circle, AlertCircle, ShieldAlert,
    PauseCircle, PlayCircle, Settings, Users, BookOpen, Activity, Lock
} from "lucide-react";
import Link from "next/link";
import { ProtectedRouteGate } from "@/components/protected-route-gate";

export default function PilotLaunchWizard() {
    return (
        <ProtectedRouteGate>
            <WizardClient />
        </ProtectedRouteGate>
    );
}

function WizardClient() {
    const [cells, setCells] = useState<any[]>([]);
    const [neighborhoods, setNeighborhoods] = useState<any[]>([]);
    const [selectedCellId, setSelectedCellId] = useState("");
    const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState("");
    const [goLiveDate, setGoLiveDate] = useState("");

    const [activeLaunch, setActiveLaunch] = useState<any>(null);
    const [launchSteps, setLaunchSteps] = useState<any[]>([]);
    const [criticalIncidents, setCriticalIncidents] = useState<any[]>([]);
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
            // Set default date to today's date
            setGoLiveDate(new Date().toISOString().split('T')[0]);
            setLoading(false);
        }
        loadInitial();
    }, [supabase]);

    useEffect(() => {
        if (!selectedCellId) return;
        async function loadNeighborhoods() {
            const { data } = await supabase
                .from("eco_cell_neighborhoods")
                .select("*, neighborhood:neighborhoods(*)")
                .eq("cell_id", selectedCellId);

            const nbhs = data?.map(d => d.neighborhood).filter(Boolean) || [];
            setNeighborhoods(nbhs);
            if (nbhs.length > 0 && !selectedNeighborhoodId) {
                setSelectedNeighborhoodId(nbhs[0].id);
            }
        }
        loadNeighborhoods();
    }, [selectedCellId, supabase]);

    useEffect(() => {
        if (!selectedCellId || !selectedNeighborhoodId) return;
        loadLaunchStatus();
    }, [selectedCellId, selectedNeighborhoodId]);

    const loadLaunchStatus = async () => {
        setLoading(true);
        // Load active launch for this combo
        const { data: launchData } = await supabase
            .from("eco_pilot_launches")
            .select("*")
            .eq("cell_id", selectedCellId)
            .eq("neighborhood_id", selectedNeighborhoodId)
            .maybeSingle();

        setActiveLaunch(launchData);

        if (launchData) {
            const { data: stepsData } = await supabase
                .from("eco_pilot_launch_steps")
                .select("*")
                .eq("launch_id", launchData.id)
                .order("step_key");
            setLaunchSteps(stepsData || []);
        } else {
            setLaunchSteps([]);
        }

        // Check for incidents A32
        const { data: incidents } = await supabase
            .from("eco_incidents")
            .select("*")
            .eq("cell_id", selectedCellId)
            .in("status", ["investigating", "identified"])
            .in("severity", ["sev1", "sev2"]);

        setCriticalIncidents(incidents || []);
        setLoading(false);
    };

    // RPC Calls
    const initLaunch = async () => {
        setActionLoading(true);
        const { data, error } = await supabase.rpc("rpc_init_pilot_launch", {
            p_cell_id: selectedCellId,
            p_neighborhood_id: selectedNeighborhoodId,
            p_go_live: goLiveDate
        });
        if (error) alert(error.message);
        await loadLaunchStatus();
        setActionLoading(false);
    };

    const prepareLaunch = async () => {
        if (!activeLaunch) return;
        setActionLoading(true);
        const { error } = await supabase.rpc("rpc_prepare_pilot_launch", {
            p_launch_id: activeLaunch.id
        });
        if (error) alert(error.message);
        await loadLaunchStatus();
        setActionLoading(false);
    };

    const openInviteOnly = async () => {
        if (!activeLaunch) return;
        if (!confirm("Isso bloqueia o bairro em Invite-Only (20 spots/dia). Confirmar?")) return;
        setActionLoading(true);
        const { error } = await supabase.rpc("rpc_open_pilot_invite_only", {
            p_launch_id: activeLaunch.id
        });
        if (error) alert(error.message);
        await loadLaunchStatus();
        setActionLoading(false);
    };

    const openGradual = async () => {
        if (!activeLaunch) return;
        if (!confirm("Isso libera o Ramp Mode gradual. Confirmar?")) return;
        setActionLoading(true);
        const { error } = await supabase.rpc("rpc_open_pilot_gradual", {
            p_launch_id: activeLaunch.id
        });
        if (error) alert(error.message);
        await loadLaunchStatus();
        setActionLoading(false);
    };

    const pausePilot = async () => {
        if (!activeLaunch) return;
        const reason = prompt("Explicação para Pausa (Surgimento de fila, incidente)?");
        if (!reason) return;
        setActionLoading(true);
        const { error } = await supabase.rpc("rpc_pause_pilot", {
            p_launch_id: activeLaunch.id,
            p_reason: reason
        });
        if (error) alert(error.message);
        await loadLaunchStatus();
        setActionLoading(false);
    };

    const getStepIcon = (status: string) => {
        if (status === 'done') return <CheckCircle2 className="text-green-500" size={16} />;
        if (status === 'blocked') return <ShieldAlert className="text-red-500" size={16} />;
        return <Circle className="text-muted-foreground" size={16} />;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'planning': return 'bg-muted text-foreground';
            case 'ready': return 'bg-primary text-black';
            case 'live': return 'bg-green-500 text-white';
            case 'paused': return 'bg-red-500 text-white';
            case 'week1': return 'bg-secondary text-white';
            case 'closed': return 'bg-black text-white';
            default: return 'bg-muted text-foreground';
        }
    };

    if (loading && cells.length === 0) return <LoadingBlock text="Carregando matriz de lançamento..." />;

    return (
        <div className="animate-slide-up pb-20">
            {/* A56 Breadcrumb */}
            <Link href="/admin" className="text-[10px] font-black uppercase text-muted underline mb-4 flex w-fit">
                &lt; VOLTAR PARA O PAINEL ADMIN
            </Link>

            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-3">
                    <Rocket className="text-secondary" size={40} />
                    <h1 className="stencil-text text-4xl">WIZARD DE LANÇAMENTO</h1>
                </div>

                <div className="flex gap-4 items-center flex-wrap">
                    <select
                        className="field min-w-[150px]"
                        value={selectedCellId}
                        onChange={(e) => setSelectedCellId(e.target.value)}
                    >
                        {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    <select
                        className="field min-w-[200px]"
                        value={selectedNeighborhoodId}
                        onChange={(e) => setSelectedNeighborhoodId(e.target.value)}
                    >
                        {neighborhoods.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>

                    <input
                        type="date"
                        className="field"
                        value={goLiveDate}
                        onChange={(e) => setGoLiveDate(e.target.value)}
                    />
                </div>
            </header>

            {criticalIncidents.length > 0 && (
                <div className="mb-6 bg-red-50 border-2 border-red-500 p-4">
                    <div className="flex items-center gap-2 text-red-700 font-bold uppercase mb-2">
                        <ShieldAlert size={20} /> ALERTA CRÍTICO: INCIDENTES ABERTOS
                    </div>
                    <p className="text-sm font-bold text-red-900 leading-snug">
                        Há {criticalIncidents.length} incidente(s) Sev1/Sev2 na célula. O lançamento deve ser pausado até a resolução.
                    </p>
                    <Link href="/admin/runbook" className="text-red-700 underline text-xs font-black mt-2 inline-block">
                        IR PARA O RUNBOOK DE INCIDENTES (A32)
                    </Link>
                </div>
            )}

            {!activeLaunch ? (
                <div className="card text-center py-12">
                    <Rocket className="mx-auto mb-4 opacity-10" size={64} />
                    <p className="stencil-text text-2xl mb-2">TERRITÓRIO NÃO INICIADO</p>
                    <p className="font-bold text-xs uppercase opacity-70 mb-6">Comece o plano de voo para este bairro.</p>

                    <button
                        onClick={initLaunch}
                        disabled={actionLoading}
                        className="cta-button mx-auto"
                    >
                        {actionLoading ? "INICIALIZANDO..." : "INICIAR WIZARD (DIA 0)"} <ChevronRight size={20} />
                    </button>
                    <p className="text-[10px] font-black uppercase text-secondary mt-4">Isso não abrirá o aplicativo para o público ainda.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Status Console */}
                    <div className="md:col-span-2 flex flex-col gap-6">
                        <div className="card p-6 border-4">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="stencil-text text-xl">CONSOLE (STATUS: <span className={`px-2 py-1 ${getStatusColor(activeLaunch.status)}`}>{activeLaunch.status}</span>)</h2>
                                <button className="text-xs font-black uppercase underline" onClick={loadLaunchStatus}>Atualizar</button>
                            </div>

                            <div className="space-y-4">
                                <section>
                                    <h3 className="font-black text-xs uppercase text-primary mb-2 flex items-center justify-between">
                                        DIA 0: PREPARAÇÃO
                                        <button
                                            onClick={prepareLaunch}
                                            disabled={actionLoading || activeLaunch.status !== 'planning'}
                                            className="bg-primary text-black px-2 py-1 text-[10px] disabled:opacity-50"
                                        >
                                            RODAR PREP SCRIPT
                                        </button>
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2 text-xs font-bold uppercase">
                                        {launchSteps.map(step => (
                                            <div key={step.id} className="flex gap-2 items-center bg-muted/20 p-2 border border-foreground/10">
                                                {getStepIcon(step.status)}
                                                <span className="truncate">{step.step_key.replace(/_/g, ' ')}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] font-bold opacity-60 mt-2">Dica: Confirme as placas e o estoque antes de avançar.</p>
                                </section>

                                <div className="h-[2px] bg-foreground/10 w-full my-4" />

                                <section>
                                    <h3 className="font-black text-xs uppercase text-green-600 mb-2">DIA 1: IGNIÇÃO E TRANSIÇÃO</h3>
                                    <div className="flex flex-wrap gap-3">
                                        <button
                                            onClick={openInviteOnly}
                                            disabled={actionLoading || activeLaunch.status === 'live'}
                                            className="flex-1 bg-black text-white font-black text-xs py-3 border-2 border-transparent disabled:opacity-50 hover:bg-zinc-800"
                                        >
                                            [1] ABRIR INVITE-ONLY
                                        </button>
                                        <button
                                            onClick={openGradual}
                                            disabled={actionLoading || activeLaunch.status !== 'live'}
                                            className="flex-1 bg-green-500 text-white font-black text-xs py-3 border-2 border-transparent disabled:opacity-50 hover:bg-green-600"
                                        >
                                            [2] ABRIR RAMP GRADUAL
                                        </button>
                                        <button
                                            onClick={pausePilot}
                                            disabled={actionLoading || activeLaunch.status === 'paused'}
                                            className="w-full bg-red-600 text-white font-black text-xs py-3 border-2 border-transparent disabled:opacity-50 hover:bg-red-700 flex justify-center items-center gap-2"
                                        >
                                            <PauseCircle size={16} /> PAUSE / KILL SWITCH
                                        </button>
                                    </div>
                                </section>

                                <div className="h-[2px] bg-foreground/10 w-full my-4" />

                                <section>
                                    <h3 className="font-black text-xs uppercase text-secondary mb-2">SEMANA 1: CONSOLIDAÇÃO</h3>
                                    <p className="text-[10px] font-bold uppercase opacity-80 mb-3">
                                        Após rodar o Dia 1, a semana deve focar em saúde. Ferramentas:
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Link href="/bairros" className="bg-white border-2 border-foreground p-2 text-[10px] font-black uppercase text-center hover:bg-secondary hover:text-white transition-colors">
                                            PUBLICAR VITÓRIA (A53)
                                        </Link>
                                        <Link href="/admin/formacao" className="bg-white border-2 border-foreground p-2 text-[10px] font-black uppercase text-center hover:bg-secondary hover:text-white transition-colors">
                                            AJUSTAR SCRIPT EDU (A55)
                                        </Link>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>

                    {/* Quick Links Column */}
                    <div className="flex flex-col gap-4">
                        <div className="bg-primary text-black p-4 border-2 border-foreground shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                            <h3 className="stencil-text text-sm mb-3">ATALHOS DA CÉLULA</h3>
                            <div className="flex flex-col gap-2">
                                <QuickLink href="/admin/saude" icon={<Activity size={14} />} label="Saúde & Limitadores" />
                                <QuickLink href="/admin/privacidade" icon={<Lock size={14} />} label="Auditoria Privacidade" />
                                <QuickLink href="/admin/ramp" icon={<Settings size={14} />} label="Ramp Plans" />
                                <QuickLink href="/admin/campanha" icon={<Users size={14} />} label="Campanhas no Bairro" />
                                <QuickLink href="/admin/runbook" icon={<BookOpen size={14} />} label="Runbook / Incidentes" />
                            </div>
                        </div>

                        {activeLaunch.notes && (
                            <div className="bg-white p-4 border-2 border-red-500">
                                <h3 className="font-black text-[10px] uppercase text-red-600 mb-1">ÚLTIMO MOTIVO DA PAUSA</h3>
                                <p className="font-bold text-xs uppercase opacity-80">{activeLaunch.notes}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function QuickLink({ href, icon, label }: { href: string, icon: React.ReactNode, label: string }) {
    return (
        <Link href={href} className="flex items-center gap-2 p-2 bg-white/50 hover:bg-white border border-foreground/20 text-xs font-black uppercase transition-colors">
            {icon} {label}
        </Link>
    );
}
