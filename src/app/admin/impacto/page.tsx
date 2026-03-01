"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import { BarChart3, RefreshCw, Layers, ShieldCheck, MapPin, ClipboardList, Target, AlertTriangle, Package, Activity, Info } from "lucide-react";
import Link from "next/link";
import { Neighborhood } from "@/types/eco";

// Helper to get Monday of a given date
const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff)).toISOString().split('T')[0];
};

export default function AdminImpactoPage() {
    const [cells, setCells] = useState<any[]>([]);
    const [neighborhoods, setNeighborhoods] = useState<any[]>([]);
    const [selectedCellId, setSelectedCellId] = useState<string>("");
    const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string>("all");
    const [selectedWeek, setSelectedWeek] = useState<string>(getMonday(new Date()));
    const [rollups, setRollups] = useState<any[]>([]);
    const [isCalculating, setIsCalculating] = useState(false);
    const [loading, setLoading] = useState(true);

    const supabase = createClient();

    useEffect(() => {
        async function loadInitial() {
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
        async function loadCellNeighborhoods() {
            if (!selectedCellId) return;
            const { data: nData } = await supabase
                .from("eco_cell_neighborhoods")
                .select("neighborhood_id, neighborhood:neighborhoods(id, name)")
                .eq("cell_id", selectedCellId);
            setNeighborhoods(nData || []);
            setSelectedNeighborhoodId("all");
        }
        loadCellNeighborhoods();
    }, [selectedCellId, supabase]);

    useEffect(() => {
        async function loadRollups() {
            if (!selectedCellId) return;
            let query = supabase
                .from("eco_impact_rollups_weekly")
                .select("*")
                .eq("cell_id", selectedCellId)
                .order("week_start", { ascending: false })
                .limit(8);

            if (selectedNeighborhoodId !== "all") {
                query = query.eq("neighborhood_id", selectedNeighborhoodId);
            } else {
                query = query.is("neighborhood_id", null); // Cell aggregate
            }

            const { data } = await query;
            setRollups(data || []);
        }
        loadRollups();
    }, [selectedCellId, selectedNeighborhoodId, selectedWeek, isCalculating, supabase]); // Refetch when isCalculating finishes

    const calculateWeek = async () => {
        if (!selectedCellId) return;
        setIsCalculating(true);
        try {
            const nId = selectedNeighborhoodId === "all" ? null : selectedNeighborhoodId;
            const { data, error } = await supabase.rpc('rpc_compute_impact_rollup', {
                p_cell_id: selectedCellId,
                p_week_start: selectedWeek,
                p_neighborhood_id: nId
            });

            if (error) throw error;
            alert(`Métricas computadas com sucesso!`);
        } catch (err: any) {
            alert("Erro ao computar: " + err.message);
        } finally {
            setIsCalculating(false);
        }
    };

    const currentRollup = rollups.find(r => r.week_start === selectedWeek);
    const metrics = currentRollup?.metrics || {};

    if (loading) return <LoadingBlock text="Carregando matriz de impacto..." />;

    return (
        <div className="animate-slide-up pb-12 max-w-6xl mx-auto space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <BarChart3 className="text-secondary" size={32} />
                    <div>
                        <h1 className="stencil-text text-3xl">IMPACTO E AUDITORIA</h1>
                        <p className="text-[10px] uppercase font-bold text-muted">Métricas consolidadas sem métricas de vaidade</p>
                    </div>
                </div>
            </header>

            {/* Controles */}
            <section className="card bg-muted/10 border-2 border-foreground/20 p-4 shrink-0 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full space-y-2">
                    <label className="text-[10px] font-black uppercase">Célula</label>
                    <select
                        className="field w-full"
                        value={selectedCellId}
                        onChange={(e) => setSelectedCellId(e.target.value)}
                    >
                        {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="flex-1 w-full space-y-2">
                    <label className="text-[10px] font-black uppercase">Bairro (Opcional)</label>
                    <select
                        className="field w-full"
                        value={selectedNeighborhoodId}
                        onChange={(e) => setSelectedNeighborhoodId(e.target.value)}
                    >
                        <option value="all">TODOS (Agregado da Célula)</option>
                        {neighborhoods.map(n => (
                            <option key={n.neighborhood_id} value={n.neighborhood_id}>
                                {n.neighborhood?.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 w-full space-y-2">
                    <label className="text-[10px] font-black uppercase">Semana (Start)</label>
                    <input
                        type="date"
                        className="field w-full"
                        value={selectedWeek}
                        onChange={(e) => setSelectedWeek(e.target.value)}
                        step="7"
                    />
                </div>
                <button
                    onClick={calculateWeek}
                    disabled={isCalculating}
                    className="cta-button bg-primary text-black whitespace-nowrap"
                >
                    {isCalculating ? <RefreshCw size={16} className="animate-spin" /> : <BarChart3 size={16} />}
                    COMPUTAR SEMANA
                </button>
            </section>

            {/* Cards de Métricas (Semana Atual) */}
            <section>
                <h2 className="stencil-text text-xl mb-4 flex items-center gap-2">
                    VISÃO DA SEMANA: {selectedWeek}
                    {!currentRollup && <span className="text-xs font-bold uppercase text-red-500 bg-red-100 px-2 py-1">Sem cálculo</span>}
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="card bg-white border-2 border-secondary/50 flex flex-col items-center text-center p-4">
                        <ClipboardList className="text-secondary mb-2" size={24} />
                        <span className="text-[10px] font-black uppercase opacity-60">Recibos Emitidos</span>
                        <span className="stencil-text text-4xl">{metrics.receipts_count ?? '-'}</span>
                    </div>
                    <div className="card bg-white border-2 border-green-500/50 flex flex-col items-center text-center p-4">
                        <ShieldCheck className="text-green-500 mb-2" size={24} />
                        <span className="text-[10px] font-black uppercase opacity-60">Taxa de Qualidade</span>
                        <span className="stencil-text text-4xl">{metrics.ok_rate ?? '-'}%</span>
                    </div>
                    <div className="card bg-white border-2 border-primary/50 flex flex-col items-center text-center p-4">
                        <Layers className="text-primary mb-2" size={24} />
                        <span className="text-[10px] font-black uppercase opacity-60">Tarefas do Comum</span>
                        <span className="stencil-text text-4xl">{metrics.tasks_done_count ?? '-'}</span>
                    </div>
                    <div className="card bg-white border-2 border-blue-500/50 flex flex-col items-center text-center p-4">
                        <Target className="text-blue-500 mb-2" size={24} />
                        <span className="text-[10px] font-black uppercase opacity-60">Âncoras Ativas</span>
                        <span className="stencil-text text-4xl">{metrics.partners_anchor_active_count ?? '-'}</span>
                    </div>

                    <div className="card bg-white border-2 border-orange-400/50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Package size={16} className="text-orange-500" />
                            <span className="text-[10px] font-black uppercase opacity-60">Logística</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="font-bold text-xs uppercase">Déficits de Estoque</span>
                            <span className="stencil-text text-2xl text-orange-600">{metrics.stock_deficits_count ?? '-'}</span>
                        </div>
                    </div>
                    <div className="card bg-white border-2 border-foreground/20 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <MapPin size={16} className="text-foreground" />
                            <span className="text-[10px] font-black uppercase opacity-60">Cobertura (Est.)</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="font-bold text-xs uppercase">Recorrência</span>
                            <span className="stencil-text text-2xl">{metrics.recurring_coverage_pct ?? '-'}%</span>
                        </div>
                    </div>

                    {/* Saude Interna */}
                    <div className="col-span-2 card bg-red-50 border-2 border-red-500/50 p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Activity size={16} className="text-red-500" />
                                <span className="text-[10px] font-black uppercase text-red-700">Saúde e Riscos (Interno)</span>
                            </div>
                            <Info size={14} className="text-red-400" />
                        </div>
                        <div className="flex justify-around items-center">
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] font-bold uppercase opacity-60">Incidentes</span>
                                <span className="stencil-text text-3xl text-red-600">{metrics.incidents_critical_count ?? '-'}</span>
                            </div>
                            <div className="h-8 w-px bg-red-200"></div>
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] font-bold uppercase opacity-60">OBS Críticas</span>
                                <span className="stencil-text text-3xl text-red-600">{metrics.obs_critical_count ?? '-'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Histórico das Últimas 8 Semanas */}
            <section>
                <h2 className="stencil-text text-xl mb-4">HISTÓRICO RECENTE (8 SEMANAS)</h2>
                <div className="card overflow-hidden p-0 border-2 border-foreground">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-foreground text-white">
                                <tr>
                                    <th className="p-3 text-[10px] font-black uppercase">Semana</th>
                                    <th className="p-3 text-[10px] font-black uppercase">Recibos</th>
                                    <th className="p-3 text-[10px] font-black uppercase">Qualidade</th>
                                    <th className="p-3 text-[10px] font-black uppercase">Tarefas</th>
                                    <th className="p-3 text-[10px] font-black uppercase">Âncoras</th>
                                    <th className="p-3 text-[10px] font-black uppercase">Déficits</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-foreground/10 bg-white">
                                {rollups.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-muted font-bold text-xs uppercase">Nenhum rollup calculado</td></tr>
                                ) : (
                                    rollups.map(r => (
                                        <tr key={r.id} className="hover:bg-muted/5 transition-colors">
                                            <td className="p-3 font-bold">{r.week_start}</td>
                                            <td className="p-3 font-black">{r.metrics.receipts_count || 0}</td>
                                            <td className="p-3 font-black text-green-600">{r.metrics.ok_rate || 0}%</td>
                                            <td className="p-3 font-black text-primary">{r.metrics.tasks_done_count || 0}</td>
                                            <td className="p-3 font-bold opacity-70">{r.metrics.partners_anchor_active_count || 0}</td>
                                            <td className="p-3 font-bold text-orange-600">{r.metrics.stock_deficits_count || 0}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
}
