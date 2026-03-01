"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    Activity,
    AlertTriangle,
    WifiOff,
    RefreshCcw,
    FileWarning,
    Database,
    Layout,
    ShieldCheck,
    ExternalLink,
    Clock,
    Filter
} from "lucide-react";
import Link from "next/link";

export default function ObservabilidadeClient() {
    const [events, setEvents] = useState<any[]>([]);
    const [rollups, setRollups] = useState<any[]>([]);
    const [cells, setCells] = useState<any[]>([]);
    const [selectedCellId, setSelectedCellId] = useState<string>("all");
    const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string>("all");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const EVENTS_PER_PAGE = 50;

    const supabase = createClient();

    const loadData = async (isNewSearch = false) => {
        setRefreshing(true);
        const currentPage = isNewSearch ? 1 : page;
        const from = (currentPage - 1) * EVENTS_PER_PAGE;
        const to = from + EVENTS_PER_PAGE - 1;

        try {
            // 1. Fetch Cells/Neighborhoods for filters
            if (isNewSearch || loading) {
                const { data: cData } = await supabase.from("eco_cells").select("*").order("name");
                setCells(cData || []);
            }

            // 2. Fetch Recent Events
            let query = supabase
                .from("eco_obs_events")
                .select("*, neighborhood:neighborhoods(name), cell:eco_cells(name)", { count: 'exact' })
                .order("created_at", { ascending: false })
                .range(from, to);

            if (selectedCellId !== "all") query = query.eq("cell_id", selectedCellId);
            if (selectedNeighborhoodId !== "all") query = query.eq("neighborhood_id", selectedNeighborhoodId);

            const { data: eData, count } = await query;
            if (eData) {
                if (isNewSearch) {
                    setEvents(eData);
                    setPage(1);
                } else {
                    setEvents(prev => [...prev, ...eData]);
                }
                setHasMore(count ? (from + eData.length) < count : false);
            }

            // 3. Fetch Rollups (Last 7 days)
            if (isNewSearch || loading) {
                const { data: rData } = await supabase
                    .from("eco_obs_rollups_daily")
                    .select("*")
                    .order("day", { ascending: false })
                    .limit(14);
                setRollups(rData || []);
            }

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadMore = () => {
        if (!refreshing && hasMore) {
            setPage(prev => prev + 1);
        }
    };

    useEffect(() => {
        if (page > 1) {
            loadData();
        }
    }, [page]);

    const openIncident = async (kind: string, neighborhoodId?: string) => {
        try {
            const res = await fetch("/api/admin/incidents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ kind, neighborhood_id: neighborhoodId })
            });
            if (!res.ok) throw new Error("Falha ao abrir incidente");
            alert("Incidente aberto no Runbook.");
            window.location.href = "/admin/runbook";
        } catch (err: any) {
            alert(err.message);
        }
    };

    useEffect(() => {
        loadData(true);
    }, [selectedCellId, selectedNeighborhoodId, supabase]);

    const stats = {
        total24h: events.length,
        critical24h: events.filter(e => e.severity === 'critical').length,
        errors24h: events.filter(e => e.severity === 'error').length,
        syncFails: events.filter(e => e.event_kind === 'sync_fail').length,
        uploadFails: events.filter(e => e.event_kind === 'upload_fail').length
    };

    if (loading) return <LoadingBlock text="Calculando telemetria..." />;

    return (
        <div className="animate-slide-up pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <Activity className="text-primary" size={32} />
                    <h1 className="stencil-text text-3xl">OBSERVABILIDADE TÉCNICA</h1>
                </div>

                <div className="flex gap-2">
                    <button
                        className="cta-button tiny border-2 border-foreground bg-white"
                        onClick={() => loadData(true)}
                        disabled={refreshing}
                    >
                        <RefreshCcw size={14} className={`mr-1 ${refreshing ? 'animate-spin' : ''}`} /> ATUALIZAR
                    </button>
                    <Link href="/admin/saude" className="cta-button tiny bg-foreground text-white">SAÚDE</Link>
                </div>
            </header>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className={`card border-2 ${stats.critical24h > 0 ? 'border-red-600 bg-red-50' : 'border-foreground/10 bg-white'}`}>
                    <span className="font-black text-[10px] uppercase text-muted">Críticos (24h)</span>
                    <p className={`text-3xl font-black ${stats.critical24h > 0 ? 'text-red-700' : 'text-foreground'}`}>{stats.critical24h}</p>
                </div>
                <div className="card border-2 border-foreground/10 bg-white">
                    <span className="font-black text-[10px] uppercase text-muted">Erros Técnicos</span>
                    <p className="text-3xl font-black">{stats.errors24h}</p>
                </div>
                <div className="card border-2 border-foreground/10 bg-white">
                    <span className="font-black text-[10px] uppercase text-muted">Sync/Upload Fail</span>
                    <p className="text-3xl font-black">{stats.syncFails + stats.uploadFails}</p>
                </div>
                <div className="card border-2 border-foreground/10 bg-white">
                    <span className="font-black text-[10px] uppercase text-muted">Amostras Recentes</span>
                    <p className="text-3xl font-black">{stats.total24h}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Event Log */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <section className="card bg-white border-2 border-foreground/10 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="stencil-text text-xl flex items-center gap-2">
                                <Database size={24} /> LOG DE EVENTOS (PII-FREE)
                            </h3>
                            <div className="flex gap-2">
                                <select
                                    className="field tiny"
                                    value={selectedCellId}
                                    onChange={(e) => setSelectedCellId(e.target.value)}
                                >
                                    <option value="all">TODAS AS CÉLULAS</option>
                                    {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-foreground/5 text-[10px] font-black uppercase text-muted">
                                        <th className="pb-3">Data/Hora</th>
                                        <th className="pb-3">Tipo</th>
                                        <th className="pb-3">Severidade</th>
                                        <th className="pb-3">Local</th>
                                        <th className="pb-3">Mensagem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {events.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center italic opacity-30 text-xs font-bold uppercase">
                                                Nenhum evento registrado no período.
                                            </td>
                                        </tr>
                                    ) : (
                                        events.map(event => (
                                            <tr key={event.id} className="border-b border-foreground/5 hover:bg-muted/5 transition-colors group">
                                                <td className="py-3 text-[9px] font-bold font-mono">
                                                    {new Date(event.created_at).toLocaleString()}
                                                </td>
                                                <td className="py-3">
                                                    <span className="text-[9px] font-black uppercase px-1 bg-muted">
                                                        {event.event_kind}
                                                    </span>
                                                </td>
                                                <td className="py-3">
                                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 border ${event.severity === 'critical' ? 'bg-red-600 text-white border-red-700' :
                                                        event.severity === 'error' ? 'bg-orange-400 text-white' :
                                                            event.severity === 'warn' ? 'bg-yellow-400' : 'bg-foreground text-white'
                                                        }`}>
                                                        {event.severity}
                                                    </span>
                                                </td>
                                                <td className="py-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black uppercase">{event.neighborhood?.name || 'GLOBAL'}</span>
                                                        <span className="text-[8px] font-bold uppercase opacity-40">{event.cell?.name || ''}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex justify-between items-start">
                                                            <p className="text-[10px] font-bold leading-tight line-clamp-1 group-hover:line-clamp-none transition-all">
                                                                {event.message}
                                                            </p>
                                                            {event.severity === 'critical' && (
                                                                <button
                                                                    onClick={() => openIncident('technical_instability', event.neighborhood_id)}
                                                                    className="ml-2 text-[7px] font-black uppercase bg-red-600 text-white px-1 border border-red-800"
                                                                >
                                                                    AÇÃO
                                                                </button>
                                                            )}
                                                        </div>
                                                        {event.context_key && (
                                                            <span className="text-[8px] font-mono opacity-50">{event.context_key}</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {hasMore && (
                            <div className="mt-6 border-t border-foreground/5 pt-4 text-center">
                                <button
                                    className="cta-button small w-full md:w-fit"
                                    onClick={loadMore}
                                    disabled={refreshing}
                                >
                                    {refreshing ? 'CARREGANDO...' : 'CARREGAR MAIS EVENTOS'}
                                </button>
                            </div>
                        )}
                    </section>
                </div>

                {/* Sidebar: Status and Trends */}
                <aside className="flex flex-col gap-8">
                    <section className="card bg-foreground text-white border-foreground">
                        <h3 className="stencil-text text-sm mb-4 uppercase text-primary">Invariantes Anti-Vigilância</h3>
                        <div className="flex flex-col gap-4">
                            <div className="flex items-start gap-3">
                                <ShieldCheck className="text-primary shrink-0" size={16} />
                                <p className="text-[9px] font-bold uppercase opacity-80 leading-relaxed">
                                    Zero PII: O servidor anonimiza e trunca mensagens de erro contendo e-mails ou números.
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <ShieldCheck className="text-primary shrink-0" size={16} />
                                <p className="text-[9px] font-bold uppercase opacity-80 leading-relaxed">
                                    Agregação: Dados servem para identificar falhas técnicas sistêmicas, não comportamento individual.
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <Activity className="text-primary shrink-0" size={16} />
                                <p className="text-[9px] font-bold uppercase opacity-80 leading-relaxed">
                                    Fingerprint Anônimo: Usado apenas para deduplicação de erros em burst.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="card border-2 border-foreground bg-white">
                        <h2 className="stencil-text text-sm mb-6 uppercase flex items-center justify-between">
                            Integridade Técnica
                            <ShieldCheck size={16} />
                        </h2>

                        <div className="flex flex-col gap-5">
                            {[
                                { label: 'Sync Offline', kind: 'sync_fail', threshold: 5 },
                                { label: 'Upload Mídia', kind: 'upload_fail', threshold: 3 },
                                { label: 'Access Errors', kind: 'rpc_error', threshold: 10 }
                            ].map(item => {
                                const count = events.filter(e => e.event_kind === item.kind).length;
                                const isBad = count >= item.threshold;
                                return (
                                    <div key={item.label} className="flex flex-col gap-1">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                            <span>{item.label}</span>
                                            <div className="flex gap-2 items-center">
                                                <span className={isBad ? 'text-red-600' : 'text-green-600'}>
                                                    {isBad ? 'NOMINAL LOW' : 'OPTIMAL'}
                                                </span>
                                                {isBad && (
                                                    <button
                                                        onClick={() => openIncident(item.kind === 'sync_fail' ? 'offline_sync_fail' : 'technical_instability')}
                                                        className="text-[7px] font-black uppercase border border-red-600 text-red-600 px-1 hover:bg-red-600 hover:text-white"
                                                    >
                                                        ABRIR
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-700 ${isBad ? 'bg-red-600' : 'bg-green-600'}`}
                                                style={{ width: `${Math.min(100, (count / item.threshold) * 50 + 50)}%` }}
                                            />
                                        </div>
                                        <p className="text-[8px] font-bold uppercase opacity-40">
                                            {count} incidentes / threshold: {item.threshold}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <section className="card bg-muted/10 border-foreground/20">
                        <h3 className="stencil-text text-[10px] mb-4 uppercase text-muted">Ações Rápidas</h3>
                        <div className="flex flex-col gap-2">
                            <Link href="/admin/melhorias" className="cta-button tiny w-full bg-white border border-foreground/10 justify-between">
                                CICLO DE MELHORIA <ExternalLink size={12} />
                            </Link>
                            <Link href="/admin/saude" className="cta-button tiny w-full bg-white border border-foreground/10 justify-between">
                                PAINEL DE SAÚDE <Layout size={12} />
                            </Link>
                            <Link href="/admin/lancamento" className="cta-button tiny w-full bg-white border border-foreground/10 justify-between">
                                CONTROLE DE LANÇAMENTO <Activity size={12} />
                            </Link>
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}
