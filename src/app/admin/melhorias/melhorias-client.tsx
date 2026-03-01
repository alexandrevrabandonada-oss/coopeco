"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    TrendingUp,
    Calendar,
    Filter,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    Rocket,
    RefreshCw,
    Plus,
    ClipboardList,
    AlertTriangle,
    CheckSquare,
    Square,
    ArrowRight,
    ShieldAlert,
    Megaphone
} from "lucide-react";
import Link from "next/link";

export default function MelhoriasClient() {
    const [cells, setCells] = useState<any[]>([]);
    const [selectedCellId, setSelectedCellId] = useState<string>("");
    const [currentCycle, setCurrentCycle] = useState<any>(null);
    const [cycleItems, setCycleItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');
    const [neighborhoods, setNeighborhoods] = useState<any[]>([]);
    const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>("all");

    const supabase = createClient();

    useEffect(() => {
        async function loadInitial() {
            const { data: cData } = await supabase.from("eco_cells").select("*").order("name");
            if (cData) {
                setCells(cData);
                if (cData.length > 0) {
                    setSelectedCellId(cData[0].id);
                    await loadCycleData(cData[0].id, activeTab);
                }
            }
            setLoading(false);
        }
        loadInitial();
    }, [supabase, activeTab]);

    const loadCycleData = async (cellId: string, kind: string) => {
        // Get newest cycle for this cell and kind
        const { data: cycles } = await supabase
            .from("eco_improvement_cycles")
            .select("*")
            .eq("cell_id", cellId)
            .eq("cycle_kind", kind)
            .order("period_start", { ascending: false })
            .limit(1);

        const cycle = cycles?.[0] || null;
        setCurrentCycle(cycle);

        if (cycle) {
            const { data: items } = await supabase
                .from("eco_improvement_items")
                .select("*")
                .eq("cycle_id", cycle.id)
                .order("severity", { ascending: false });

            // Check for associated completed tasks
            const { data: completedTasks } = await supabase
                .from("eco_common_tasks")
                .select("call_id")
                .eq("status", "done")
                .filter("call_id", "not.is", null);

            const { data: calls } = await supabase
                .from("eco_calls")
                .select("id, from_improvement");

            const itemsWithTasks = items?.map(item => {
                const associatedCall = calls?.find(c => c.from_improvement === item.id);
                const isTaskDone = associatedCall && completedTasks?.some(t => t.call_id === associatedCall.id);
                if (isTaskDone && item.status !== 'done') {
                    // Auto-sync status if task is done
                    return { ...item, status: 'done', auto_synced: true };
                }
                return item;
            });

            setCycleItems(itemsWithTasks || []);
        } else {
            setCycleItems([]);
        }

        const { data: nData } = await supabase
            .from("eco_cell_neighborhoods")
            .select("*, neighborhood:neighborhoods(*)")
            .eq("cell_id", cellId);
        setNeighborhoods(nData || []);
    };

    const openCycle = async () => {
        if (!selectedCellId) return;
        setActionLoading(true);
        try {
            // Find start of current week (Monday)
            const now = new Date();
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(now.setDate(diff));
            const startStr = activeTab === 'weekly'
                ? monday.toISOString().split('T')[0]
                : new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

            const { data, error } = await supabase.rpc('rpc_open_improvement_cycle', {
                p_cell_id: selectedCellId,
                p_kind: activeTab,
                p_start: startStr
            });

            if (error) throw error;
            await loadCycleData(selectedCellId, activeTab);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const autoFill = async () => {
        if (!currentCycle) return;
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc('rpc_autofill_cycle_items', {
                p_cycle_id: currentCycle.id
            });

            if (error) throw error;
            alert(`${data} novos itens encontrados e adicionados ao backlog.`);
            await loadCycleData(selectedCellId, activeTab);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const updateItemStatus = async (itemId: string, newStatus: string) => {
        const { error } = await supabase
            .from("eco_improvement_items")
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq("id", itemId);

        if (error) alert(error.message);
        else {
            setCycleItems(prev => prev.map(item =>
                item.id === itemId ? { ...item, status: newStatus } : item
            ));
        }
    };

    const closeCycle = async () => {
        if (!currentCycle) return;
        if (!confirm("Deseja fechar o ciclo e gerar o sumário consolidado?")) return;

        setActionLoading(true);
        try {
            const { error } = await supabase.rpc('rpc_close_cycle', {
                p_cycle_id: currentCycle.id
            });

            if (error) throw error;
            await loadCycleData(selectedCellId, activeTab);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <LoadingBlock text="Carregando ciclo de melhoria..." />;

    const filteredItems = selectedNeighborhood === "all"
        ? cycleItems
        : cycleItems.filter(i => i.neighborhood_id === selectedNeighborhood);

    const stats = {
        total: cycleItems.length,
        done: cycleItems.filter(i => i.status === 'done').length,
        blockers: cycleItems.filter(i => i.severity === 'blocker' && i.status !== 'done').length
    };

    return (
        <div className="animate-slide-up pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <TrendingUp className="text-secondary" size={32} />
                    <h1 className="stencil-text text-3xl">MELHORIA CONTÍNUA</h1>
                </div>

                <div className="flex gap-2">
                    <select
                        className="field max-w-xs"
                        value={selectedCellId}
                        onChange={(e) => {
                            setSelectedCellId(e.target.value);
                            loadCycleData(e.target.value, activeTab);
                        }}
                    >
                        {cells.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </header>

            <div className="flex gap-1 mb-6 border-b-2 border-foreground/10">
                <button
                    className={`px-6 py-2 font-black text-xs uppercase transition-all ${activeTab === 'weekly' ? 'border-b-4 border-secondary text-secondary bg-secondary/5' : 'opacity-40 hover:opacity-100'}`}
                    onClick={() => setActiveTab('weekly')}
                >
                    Ritual Semanal
                </button>
                <button
                    className={`px-6 py-2 font-black text-xs uppercase transition-all ${activeTab === 'monthly' ? 'border-b-4 border-secondary text-secondary bg-secondary/5' : 'opacity-40 hover:opacity-100'}`}
                    onClick={() => setActiveTab('monthly')}
                >
                    Retro Mensal
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 flex flex-col gap-6">
                    {!currentCycle ? (
                        <div className="card border-dashed border-2 flex flex-col items-center justify-center py-20 text-center">
                            <Calendar size={48} className="text-muted mb-4 opacity-20" />
                            <h3 className="stencil-text text-xl mb-2 opacity-40">NENHUM CICLO ABERTO</h3>
                            <button
                                className="cta-button bg-secondary text-white mt-4"
                                onClick={openCycle}
                                disabled={actionLoading}
                            >
                                <Plus size={16} className="mr-2" /> INICIAR CICLO {activeTab === 'weekly' ? 'DA SEMANA' : 'DO MÊS'}
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="bg-foreground text-white p-3 border-l-4 border-secondary">
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Período Atual</p>
                                        <p className="font-bold text-sm uppercase">
                                            {new Date(currentCycle.period_start).toLocaleDateString()} — {new Date(currentCycle.period_end).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`px-2 py-0.5 border border-foreground font-black text-[10px] uppercase ${currentCycle.status === 'open' ? 'bg-yellow-400' : 'bg-primary'}`}>
                                            STATUS: {currentCycle.status}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        className="cta-button small bg-white border-2 border-foreground hover:bg-muted"
                                        onClick={autoFill}
                                        disabled={actionLoading || currentCycle.status !== 'open'}
                                    >
                                        <Rocket size={14} className="mr-2" /> AUTO-PREENCHER
                                    </button>
                                    <button
                                        className="cta-button small bg-foreground text-white"
                                        onClick={closeCycle}
                                        disabled={actionLoading || currentCycle.status !== 'open'}
                                    >
                                        <CheckCircle2 size={14} className="mr-2" /> FECHAR CICLO
                                    </button>
                                </div>
                            </div>

                            <div className="card bg-white">
                                <div className="flex items-center justify-between mb-6 pb-4 border-b border-muted">
                                    <h3 className="stencil-text text-lg flex items-center gap-2">
                                        <ClipboardList size={20} /> FILA DE PRIORIDADES
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <Filter size={14} className="text-muted" />
                                        <select
                                            className="field py-1 text-[10px]"
                                            value={selectedNeighborhood}
                                            onChange={(e) => setSelectedNeighborhood(e.target.value)}
                                        >
                                            <option value="all">TODOS OS BAIRROS</option>
                                            {neighborhoods.map(n => (
                                                <option key={n.neighborhood_id} value={n.neighborhood_id}>{n.neighborhood?.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    {filteredItems.length === 0 ? (
                                        <div className="py-12 text-center opacity-30 italic font-bold uppercase text-xs">
                                            Nenhum item pendente. Use o "Auto-preencher" para carregar prioridades.
                                        </div>
                                    ) : (
                                        filteredItems.map(item => (
                                            <div
                                                key={item.id}
                                                className={`p-4 border-2 transition-all flex items-start gap-4 group ${item.status === 'done' ? 'bg-muted/30 border-muted opacity-60' :
                                                    item.severity === 'blocker' ? 'border-red-600 bg-red-50' :
                                                        item.severity === 'high' ? 'border-orange-400' : 'border-foreground/10 hover:border-secondary'
                                                    }`}
                                            >
                                                <button
                                                    className="mt-1"
                                                    onClick={() => updateItemStatus(item.id, item.status === 'done' ? 'todo' : 'done')}
                                                >
                                                    {item.status === 'done' ? (
                                                        <CheckSquare className="text-secondary" size={20} />
                                                    ) : (
                                                        <Square size={20} className="opacity-20 group-hover:opacity-100" />
                                                    )}
                                                </button>

                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 bg-foreground text-white`}>
                                                            {item.source_kind}
                                                        </span>
                                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 border border-foreground ${item.severity === 'blocker' ? 'bg-red-600 text-white' :
                                                            item.severity === 'high' ? 'bg-yellow-400 text-foreground' : ''
                                                            }`}>
                                                            {item.severity}
                                                        </span>
                                                        <span className="text-[8px] font-bold uppercase text-muted">
                                                            {item.category}
                                                        </span>
                                                    </div>
                                                    <h4 className={`font-black uppercase text-sm leading-tight ${item.status === 'done' ? 'line-through' : ''}`}>
                                                        {item.title}
                                                    </h4>
                                                    <p className="text-[10px] font-bold uppercase opacity-60 mt-1">
                                                        {item.summary}
                                                    </p>
                                                    {item.neighborhood_id && (
                                                        <div className="mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted/50 rounded-sm">
                                                            <MapPin size={8} />
                                                            <span className="text-[8px] font-black uppercase">
                                                                {neighborhoods.find(n => n.neighborhood_id === item.neighborhood_id)?.neighborhood?.name}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-col gap-1">
                                                    <select
                                                        className="field py-1 text-[8px] font-black"
                                                        value={item.status}
                                                        onChange={(e) => updateItemStatus(item.id, e.target.value)}
                                                    >
                                                        <option value="todo">TODO</option>
                                                        <option value="in_progress">RUNNING</option>
                                                        <option value="done">DONE</option>
                                                        <option value="wontfix">WONTFIX</option>
                                                    </select>
                                                    {item.status !== 'done' && (item.severity === 'blocker' || item.severity === 'high') && (
                                                        <Link
                                                            href={`/admin/chamados?from_improvement=${item.id}&title=${encodeURIComponent(item.title)}`}
                                                            className="mt-2 p-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all flex items-center justify-center"
                                                            title="Criar Chamado do Comum"
                                                        >
                                                            <Megaphone size={12} />
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <aside className="flex flex-col gap-8">
                    <section className="card bg-foreground text-white border-foreground">
                        <h3 className="stencil-text text-sm mb-4 uppercase text-secondary">Ritual da Célula</h3>
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-60">
                                <span>Itens Totais</span>
                                <span>{stats.total}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                <span>Resolvidos</span>
                                <span className="text-secondary">{stats.done}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                <span>Blockers Ativos</span>
                                <span className={stats.blockers > 0 ? "text-red-400" : "text-primary"}>{stats.blockers}</span>
                            </div>

                            {currentCycle && (
                                <Link
                                    href={`/admin/melhorias/relatorio?cycle_id=${currentCycle.id}`}
                                    className="cta-button small w-full justify-between"
                                    style={{ background: 'white' }}
                                >
                                    GERAR BRIEFING INTERNO
                                    <ChevronRight size={16} />
                                </Link>
                            )}
                        </div>
                    </section>

                    <section className="card border-2 border-foreground bg-white">
                        <h3 className="stencil-text text-sm mb-4 uppercase">Fontes de Dados</h3>
                        <div className="flex flex-col gap-3">
                            {[
                                { icon: AlertTriangle, label: 'Feedback da Rua', source: 'A22' },
                                { icon: TrendingUp, label: 'Saúde do Sistema', source: 'A25' },
                                { icon: ShieldAlert, label: 'Impedimentos Launch', source: 'A26' },
                                { icon: RefreshCw, label: 'Déficit Logístico', source: 'A23' }
                            ].map((f, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <div className="bg-muted p-2 border border-foreground">
                                        <f.icon size={12} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase leading-none">{f.label}</span>
                                        <span className="text-[8px] font-bold uppercase opacity-50">{f.source}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}

function MapPin({ size }: { size: number }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
    );
}
