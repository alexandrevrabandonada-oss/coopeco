"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    AlertOctagon,
    CheckCircle2,
    Clock,
    Info,
    ChevronRight,
    XCircle,
    AlertTriangle,
    PlusCircle,
    LayoutList,
    Printer,
    ArrowRightCircle,
    Activity,
    BookOpen
} from "lucide-react";
import Link from "next/link";

export default function RunbookClient() {
    const [incidents, setIncidents] = useState<any[]>([]);
    const [playbookCards, setPlaybookCards] = useState<any[]>([]);
    const [cells, setCells] = useState<any[]>([]);
    const [neighborhoods, setNeighborhoods] = useState<any[]>([]);
    const [selectedCellId, setSelectedCellId] = useState<string>("all");
    const [loading, setLoading] = useState(true);
    const [openingIncident, setOpeningIncident] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState<any | null>(null);

    const supabase = createClient();

    const loadData = async () => {
        try {
            const [cRes, pRes, iRes, nRes] = await Promise.all([
                supabase.from("eco_cells").select("*").order("name"),
                supabase.from("eco_playbook_cards").select("*").order("severity", { ascending: false }),
                supabase.from("eco_incidents")
                    .select("*, neighborhoods(name), eco_cells(name), eco_incident_actions(*)")
                    .order("opened_at", { ascending: false }),
                supabase.from("neighborhoods").select("*").order("name")
            ]);

            setCells(cRes.data || []);
            setPlaybookCards(pRes.data || []);
            setIncidents(iRes.data || []);
            setNeighborhoods(nRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [supabase]);

    const openIncident = async (kind: string, neighborhoodId: string | null = null) => {
        setOpeningIncident(true);
        const card = playbookCards.find(c => c.key === kind);
        if (!card) return;

        const { data: userData } = await supabase.auth.getUser();

        // Find cell_id for the neighborhood if provided
        let cellId = selectedCellId;
        if (neighborhoodId) {
            const { data: cn } = await supabase
                .from("eco_cell_neighborhoods")
                .select("cell_id")
                .eq("neighborhood_id", neighborhoodId)
                .single();
            if (cn) cellId = cn.cell_id;
        }

        if (cellId === "all" && cells[0]) cellId = cells[0].id;

        const { data, error } = await supabase
            .from("eco_incidents")
            .insert({
                cell_id: cellId,
                neighborhood_id: neighborhoodId,
                kind: kind,
                severity: card.severity,
                status: 'open',
                opened_by: userData.user?.id
            })
            .select()
            .single();

        if (error) alert(error.message);
        else {
            await loadData();
            setSelectedIncident(incidents.find(i => i.id === data.id) || data);
        }
        setOpeningIncident(false);
    };

    const toggleAction = async (actionId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'done' ? 'todo' : 'done';
        const { error } = await supabase
            .from("eco_incident_actions")
            .update({
                status: newStatus,
                completed_at: newStatus === 'done' ? new Date().toISOString() : null
            })
            .eq("id", actionId);

        if (!error) await loadData();
    };

    const resolveIncident = async (id: string) => {
        const { error } = await supabase
            .from("eco_incidents")
            .update({
                status: 'resolved',
                resolved_at: new Date().toISOString()
            })
            .eq("id", id);

        if (!error) {
            setSelectedIncident(null);
            await loadData();
        }
    };

    if (loading) return <LoadingBlock text="Carregando Playbook..." />;

    const openIncidents = incidents.filter(i => i.status !== 'resolved' && (selectedCellId === 'all' || i.cell_id === selectedCellId));

    return (
        <div className="animate-slide-up pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <AlertOctagon className="text-primary" size={32} />
                    <h1 className="stencil-text text-3xl text-balance">RUNBOOK DE INCIDENTES</h1>
                </div>

                <div className="flex gap-2">
                    <select
                        className="field tiny bg-white"
                        value={selectedCellId}
                        onChange={(e) => setSelectedCellId(e.target.value)}
                    >
                        <option value="all">TODAS AS CÉLULAS</option>
                        {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Link href="/api/print/kit?kind=runbook_a4" target="_blank" className="cta-button tiny bg-foreground text-white">
                        <Printer size={14} className="mr-1" /> IMPRIMIR A4
                    </Link>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Active Incidents */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <section className="card bg-white border-2 border-primary/20">
                        <h3 className="stencil-text text-xl mb-6 flex items-center gap-2">
                            <Activity size={20} className="text-primary" /> INCIDENTES EM ABERTO
                        </h3>

                        {openIncidents.length === 0 ? (
                            <div className="py-12 text-center border-2 border-dashed border-muted/20 rounded-lg">
                                <p className="text-sm font-black uppercase opacity-30 italic">Nenhum incidente ativo. Estabilidade nominal.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {openIncidents.map(inc => (
                                    <div
                                        key={inc.id}
                                        className={`card p-4 border-2 transition-all cursor-pointer hover:shadow-md ${selectedIncident?.id === inc.id ? 'border-foreground ring-2 ring-primary/20' : 'border-muted/20'}`}
                                        onClick={() => setSelectedIncident(inc)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${inc.severity === 'critical' ? 'bg-red-600 text-white' :
                                                            inc.severity === 'warn' ? 'bg-yellow-400' : 'bg-foreground text-white'
                                                        }`}>
                                                        {inc.severity}
                                                    </span>
                                                    <h4 className="font-black text-xs uppercase">{inc.kind.replace('_', ' ')}</h4>
                                                </div>
                                                <p className="text-[10px] font-bold opacity-60">
                                                    {inc.neighborhoods?.name || 'GLOBAL'} • Aberto há {Math.floor((Date.now() - new Date(inc.opened_at).getTime()) / 60000)}min
                                                </p>
                                            </div>
                                            <button className="cta-button tiny border border-foreground/10 h-8 w-8 p-0 flex items-center justify-center">
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Incident Mitigation View */}
                    {selectedIncident && (
                        <section className="card bg-white border-2 border-foreground animate-slide-up">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="stencil-text text-2xl uppercase mb-1">MITIGAÇÃO: {selectedIncident.kind.replace('_', ' ')}</h2>
                                    <p className="text-xs font-bold text-muted uppercase">Aberto em {new Date(selectedIncident.opened_at).toLocaleString()}</p>
                                </div>
                                <button
                                    onClick={() => resolveIncident(selectedIncident.id)}
                                    className="cta-button tiny bg-green-600 border-2 border-green-700 text-white"
                                >
                                    RESOLVER INCIDENTE
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Checklist */}
                                <div>
                                    <h5 className="font-black text-[10px] uppercase text-muted mb-4 flex items-center gap-2">
                                        <LayoutList size={14} /> CHECKLIST DE MITIGAÇÃO
                                    </h5>
                                    <div className="flex flex-col gap-2">
                                        {selectedIncident.eco_incident_actions?.map((action: any) => (
                                            <label
                                                key={action.id}
                                                className={`flex items-start gap-3 p-3 rounded border-2 cursor-pointer transition-colors ${action.status === 'done' ? 'bg-green-50 border-green-200' : 'bg-white border-muted/10 hover:border-foreground/20'}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="mt-1 accent-green-600"
                                                    checked={action.status === 'done'}
                                                    onChange={() => toggleAction(action.id, action.status)}
                                                />
                                                <span className={`text-xs font-bold leading-snug ${action.status === 'done' ? 'line-through opacity-50' : ''}`}>
                                                    {action.description}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Guidance from Playbook */}
                                <div className="p-6 bg-muted/5 rounded border border-muted/10">
                                    <h5 className="font-black text-[10px] uppercase text-muted mb-4 flex items-center gap-2">
                                        <BookOpen size={14} /> DIAGNÓSTICO E APOIO
                                    </h5>
                                    <div className="prose prose-xs">
                                        <p className="text-xs font-bold leading-relaxed mb-4">
                                            {playbookCards.find(c => c.key === selectedIncident.kind)?.diagnosis_md}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-2 mt-6">
                                        <Link href="/admin/lancamento" className="cta-button tiny w-full justify-between">
                                            LANÇAMENTO CONTROLADO <ArrowRightCircle size={12} />
                                        </Link>
                                        <Link href="/admin/observabilidade" className="cta-button tiny w-full justify-between">
                                            OBSERVABILIDADE TÉCNICA <Activity size={12} />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}
                </div>

                {/* Right: Playbook Reference & Quick Action */}
                <aside className="flex flex-col gap-8">
                    <section className="card bg-foreground text-white">
                        <h3 className="stencil-text text-sm mb-6 uppercase text-primary">ABRIR NOVO INCIDENTE</h3>
                        <div className="flex flex-col gap-3">
                            {playbookCards.map(card => (
                                <button
                                    key={card.key}
                                    onClick={() => openIncident(card.key)}
                                    disabled={openingIncident}
                                    className={`flex items-center justify-between p-3 border-2 text-left rounded-lg transition-all hover:translate-x-1 ${card.severity === 'critical' ? 'border-red-600/50 hover:bg-red-600' :
                                            card.severity === 'warn' ? 'border-yellow-400/50 hover:bg-yellow-400 text-foreground' :
                                                'border-white/20 hover:bg-white text-foreground'
                                        }`}
                                >
                                    <span className="text-[10px] font-black uppercase">{card.title}</span>
                                    <PlusCircle size={16} />
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="card border-2 border-foreground bg-white">
                        <h3 className="stencil-text text-sm mb-4 uppercase">REGRAS DE RUNBOOK</h3>
                        <div className="flex flex-col gap-4">
                            <div className="flex items-start gap-3">
                                <Info className="text-primary shrink-0" size={16} />
                                <p className="text-[9px] font-bold uppercase opacity-80 leading-relaxed">
                                    Processo &gt; Herói: Siga o checklist padrão para garantir que nada seja esquecido sob pressão.
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <Info className="text-primary shrink-0" size={16} />
                                <p className="text-[9px] font-bold uppercase opacity-80 leading-relaxed">
                                    Anti-Culpa: Incidentes são problemas do sistema, não das pessoas. O Runbook é apoio, não vigilância.
                                </p>
                            </div>
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}
