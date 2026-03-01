"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    Kanban, AlertCircle, PlusCircle, CheckCircle2, Circle, Clock,
    Link2, Bug, MessageSquare, ShieldAlert, Activity
} from "lucide-react";
import Link from "next/link";
import { ProtectedRouteGate } from "@/components/protected-route-gate";

const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff)).toISOString().split('T')[0];
};

export default function HotfixSprintBoard() {
    return (
        <ProtectedRouteGate>
            <HotfixClient />
        </ProtectedRouteGate>
    );
}

function HotfixClient() {
    const [cells, setCells] = useState<any[]>([]);
    const [neighborhoods, setNeighborhoods] = useState<any[]>([]);
    const [selectedCellId, setSelectedCellId] = useState("");
    const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState("");
    const [weekStart, setWeekStart] = useState("");

    const [activeSprint, setActiveSprint] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Filters
    const [filterSev, setFilterSev] = useState("all");
    const [filterCat, setFilterCat] = useState("all");

    const supabase = createClient();

    useEffect(() => {
        async function loadInitial() {
            setLoading(true);
            const { data: cData } = await supabase.from("eco_cells").select("*").order("name");
            if (cData && cData.length > 0) {
                setCells(cData);
                setSelectedCellId(cData[0].id);
            }
            setWeekStart(getMonday(new Date()));
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
        if (!selectedCellId || !selectedNeighborhoodId || !weekStart) return;
        loadSprint();
    }, [selectedCellId, selectedNeighborhoodId, weekStart]);

    const loadSprint = async () => {
        setLoading(true);
        const { data: sprintData } = await supabase
            .from("eco_hotfix_sprints")
            .select("*")
            .eq("cell_id", selectedCellId)
            .eq("neighborhood_id", selectedNeighborhoodId)
            .eq("week_start", weekStart)
            .maybeSingle();

        setActiveSprint(sprintData);

        if (sprintData) {
            const { data: itemsData } = await supabase
                .from("eco_hotfix_items")
                .select("*")
                .eq("sprint_id", sprintData.id)
                .order("created_at", { ascending: false });
            setItems(itemsData || []);
        } else {
            setItems([]);
        }
        setLoading(false);
    };

    const createSprint = async () => {
        setActionLoading(true);
        const { data, error } = await supabase.from("eco_hotfix_sprints").insert({
            cell_id: selectedCellId,
            neighborhood_id: selectedNeighborhoodId,
            week_start: weekStart,
            created_by: (await supabase.auth.getUser()).data.user?.id
        }).select().single();

        if (error) {
            alert(error.message);
        } else {
            setActiveSprint(data);
        }
        setActionLoading(false);
    };

    const autoFillSprint = async () => {
        if (!activeSprint) return;
        setActionLoading(true);
        const { error } = await supabase.rpc("rpc_autofill_hotfix_sprint", {
            p_sprint_id: activeSprint.id
        });
        if (error) alert(error.message);
        await loadSprint();
        setActionLoading(false);
    };

    const updateItemStatus = async (id: string, current: string) => {
        const nextMap: Record<string, string> = { 'todo': 'doing', 'doing': 'done', 'done': 'wontfix', 'wontfix': 'todo' };
        const next = nextMap[current] || 'todo';

        await supabase.from("eco_hotfix_items").update({ status: next }).eq("id", id);
        loadSprint();
    };

    const closeSprint = async () => {
        if (!activeSprint) return;
        if (!confirm("Isso fechará a sprint atual da semana. Consolidar os avanças (A28)?")) return;
        setActionLoading(true);

        await supabase.from("eco_hotfix_sprints").update({ status: 'closed' }).eq("id", activeSprint.id);

        alert("Sprint Fechada! Os itens resolvidos poderão alimentar o painel de Vitória / Rollover da semana.");
        await loadSprint();
        setActionLoading(false);
    };

    const filteredItems = items.filter(i => {
        if (filterSev !== 'all' && i.severity !== filterSev) return false;
        if (filterCat !== 'all' && i.category !== filterCat) return false;
        return true;
    });

    const getSevColor = (sev: string) => {
        if (sev === 'blocker') return 'bg-red-600 text-white';
        if (sev === 'high') return 'bg-orange-500 text-white';
        if (sev === 'medium') return 'bg-yellow-400 text-black';
        return 'bg-muted text-foreground';
    };

    const getIcon = (kind: string) => {
        if (kind === 'feedback') return <MessageSquare size={14} />;
        if (kind === 'incident') return <ShieldAlert size={14} />;
        if (kind === 'launch' || kind === 'obs') return <Activity size={14} />;
        return <Bug size={14} />;
    };

    return (
        <div className="animate-slide-up pb-20 p-4 md:p-8">
            <Link href="/admin" className="text-[10px] font-black uppercase text-muted underline mb-4 flex w-fit">
                &lt; VOLTAR PARA O PAINEL ADMIN
            </Link>

            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-3">
                    <Kanban className="text-primary" size={40} />
                    <h1 className="stencil-text text-4xl">HOTFIX SPRINT BOARD</h1>
                </div>

                <div className="flex gap-4 items-center flex-wrap bg-white p-2 border-2 border-foreground">
                    <select
                        className="p-1 border border-foreground/20 text-xs font-bold uppercase min-w-[120px]"
                        value={selectedCellId}
                        onChange={(e) => setSelectedCellId(e.target.value)}
                    >
                        {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    <select
                        className="p-1 border border-foreground/20 text-xs font-bold uppercase min-w-[150px]"
                        value={selectedNeighborhoodId}
                        onChange={(e) => setSelectedNeighborhoodId(e.target.value)}
                    >
                        {neighborhoods.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>

                    <input
                        type="date"
                        className="p-1 border border-foreground/20 text-xs font-bold uppercase"
                        value={weekStart}
                        onChange={(e) => setWeekStart(e.target.value)}
                    />
                </div>
            </header>

            {loading ? (
                <LoadingBlock text="Carregando sprint..." />
            ) : !activeSprint ? (
                <div className="card text-center py-12 border-dashed border-4 border-foreground/30">
                    <Kanban className="mx-auto mb-4 opacity-10" size={64} />
                    <p className="stencil-text text-2xl mb-2">NENHUMA SPRINT ATIVA</p>
                    <p className="font-bold text-xs uppercase opacity-70 mb-6">Não há tracking de ajustes pós-rua iniciado nesta semana.</p>
                    <button
                        onClick={createSprint}
                        disabled={actionLoading}
                        className="cta-button mx-auto"
                    >
                        {actionLoading ? "CRIANDO..." : "CRIAR SPRINT DA SEMANA"}
                    </button>
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {/* Console & Actions */}
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 border-2 border-foreground shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                        <div className="flex items-center gap-4">
                            <span className={`px-2 py-1 text-xs font-black uppercase border-2 border-foreground ${activeSprint.status === 'open' ? 'bg-green-500 text-white' : 'bg-black text-white'}`}>
                                STATUS: {activeSprint.status}
                            </span>
                            <span className="text-[10px] font-bold uppercase opacity-60">
                                ITENS: {items.length} ({items.filter(i => i.status === 'done').length} FEITOS)
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <select
                                value={filterSev}
                                onChange={(e) => setFilterSev(e.target.value)}
                                className="text-[10px] font-bold uppercase p-1 border border-foreground"
                            >
                                <option value="all">Severidade: Todas</option>
                                <option value="blocker">Blocker</option>
                                <option value="high">High</option>
                            </select>
                            <select
                                value={filterCat}
                                onChange={(e) => setFilterCat(e.target.value)}
                                className="text-[10px] font-bold uppercase p-1 border border-foreground"
                            >
                                <option value="all">Categoria: Todas</option>
                                <option value="ux">UX</option>
                                <option value="ops">Ops</option>
                                <option value="infra">Infra</option>
                            </select>

                            {activeSprint.status === 'open' && (
                                <>
                                    <button
                                        onClick={autoFillSprint}
                                        disabled={actionLoading}
                                        className="bg-primary hover:bg-primary-dark text-black px-3 py-2 text-[10px] font-black uppercase transition-colors"
                                    >
                                        [ AUTO-PREENCHER (A22/A31/A32) ]
                                    </button>
                                    <button
                                        onClick={closeSprint}
                                        disabled={actionLoading}
                                        className="bg-secondary hover:bg-black text-white px-3 py-2 text-[10px] font-black uppercase transition-colors"
                                    >
                                        [ FECHAR SPRINT ]
                                    </button>
                                </>
                            )}
                            <Link
                                href={`/admin/hotfix/relatorio?sprint_id=${activeSprint.id}`}
                                className="bg-transparent border-2 border-foreground text-foreground px-3 py-1.5 text-[10px] font-black uppercase"
                            >
                                GERAR REPORT (COPY/PASTE)
                            </Link>
                        </div>
                    </div>

                    {/* Funnel/Board */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {['todo', 'doing', 'done', 'wontfix'].map(col => {
                            const colItems = filteredItems.filter(i => i.status === col);
                            return (
                                <div key={col} className="flex flex-col gap-3">
                                    <div className="bg-muted/30 border-b-4 border-foreground p-2 flex justify-between items-center">
                                        <h3 className="stencil-text text-sm">{col.toUpperCase()}</h3>
                                        <span className="bg-foreground text-background px-2 text-xs font-black">{colItems.length}</span>
                                    </div>
                                    <div className="flex flex-col gap-3 min-h-[50vh] p-2 bg-muted/10 border-2 border-dashed border-foreground/20">
                                        {colItems.map(item => (
                                            <div key={item.id} className="bg-white border-2 border-foreground shadow-[4px_4px_0_0_rgba(0,0,0,1)] p-3 relative group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex gap-1 items-center">
                                                        <span title={item.source_kind}>{getIcon(item.source_kind)}</span>
                                                        <span className="text-[9px] font-black uppercase bg-foreground text-background px-1">{item.category}</span>
                                                    </div>
                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 ${getSevColor(item.severity)}`}>
                                                        {item.severity}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-xs leading-tight mb-2 uppercase">{item.title}</h4>
                                                {item.summary && <p className="text-[10px] opacity-70 mb-3 leading-tight line-clamp-3">{item.summary}</p>}

                                                <div className="flex justify-between items-center pt-2 border-t border-foreground/10">
                                                    <span className="text-[9px] font-bold opacity-50 uppercase">
                                                        {new Date(item.created_at).toLocaleDateString()}
                                                    </span>
                                                    {activeSprint.status === 'open' && (
                                                        <button
                                                            onClick={async () => updateItemStatus(item.id, item.status)}
                                                            className="text-[10px] font-black text-primary underline uppercase hover:text-black"
                                                        >
                                                            Avançar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Quick Cross-Links */}
                    <div className="mt-8 pt-8 border-t-2 border-foreground/20">
                        <p className="font-bold text-xs uppercase opacity-50 mb-4">Investigação Rápida da Célula</p>
                        <div className="flex gap-3 flex-wrap">
                            <Link href="/admin/saude" className="bg-foreground text-background px-3 py-1 text-[10px] font-black uppercase">Monitor de Saúde (A25)</Link>
                            <Link href="/admin/runbook" className="bg-foreground text-background px-3 py-1 text-[10px] font-black uppercase">Incidentes Sev1/Sev2 (A32)</Link>
                            <Link href="/admin/painel" className="bg-foreground text-background px-3 py-1 text-[10px] font-black uppercase">Painel de Feedbacks</Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
