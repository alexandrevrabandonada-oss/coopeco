"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import { MessageSquare, ShieldAlert, Filter, CheckCircle2, Circle, Clock, ChevronDown, ListFilter, TrendingUp, Inbox } from "lucide-react";
import { VRBadge } from "@/components/vr-badge";

export default function FeedbackTriageClient() {
    const [cells, setCells] = useState<any[]>([]);
    const [selectedCellId, setSelectedCellId] = useState<string>("all");
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const ITEMS_PER_PAGE = 20;
    const [triagingId, setTriagingId] = useState<string | null>(null);

    // Triage state
    const [tempStatus, setTempStatus] = useState("");
    const [tempNotes, setTempNotes] = useState("");
    const [tempHint, setTempHint] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState("all");
    const [severityFilter, setSeverityFilter] = useState("all");

    const supabase = createClient();

    useEffect(() => {
        async function loadInitial() {
            const { data: cData } = await supabase.from("eco_cells").select("*").order("name");
            if (cData) setCells(cData);
            loadFeedback();
        }
        loadInitial();
    }, [supabase]);

    const loadFeedback = async (isNewSearch = false) => {
        setLoading(true);
        const currentPage = isNewSearch ? 1 : page;
        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        let query = supabase
            .from("eco_feedback_items")
            .select("*, profile:profiles!eco_feedback_items_created_by_fkey(name, role), neighborhood:neighborhoods(name)", { count: 'exact' })
            .order("created_at", { ascending: false })
            .range(from, to);

        if (selectedCellId !== "all") query = query.eq("cell_id", selectedCellId);
        if (statusFilter !== "all") query = query.eq("status", statusFilter);
        if (severityFilter !== "all") query = query.eq("severity", severityFilter);

        const { data, count } = await query;
        if (data) {
            if (isNewSearch) {
                setItems(data);
                setPage(1);
            } else {
                setItems(prev => [...prev, ...data]);
            }
            setHasMore(count ? (from + data.length) < count : false);
        }
        setLoading(false);
    };

    const loadMore = () => {
        if (!loading && hasMore) {
            const nextPage = page + 1;
            setPage(nextPage);
        }
    };

    useEffect(() => {
        if (page > 1) {
            loadFeedback();
        }
    }, [page]);

    const startTriage = (item: any) => {
        setTriagingId(item.id);
        setTempStatus(item.status);
        setTempNotes(item.triage_notes || "");
        setTempHint(item.next_prompt_hint || "");
    };

    const saveTriage = async () => {
        if (!triagingId) return;
        setIsSaving(true);
        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await supabase
            .from("eco_feedback_items")
            .update({
                status: tempStatus,
                triage_notes: tempNotes,
                next_prompt_hint: tempHint,
                triaged_by: user?.id
            })
            .eq("id", triagingId);

        if (error) {
            alert(error.message);
        } else {
            setTriagingId(null);
            loadFeedback();
        }
        setIsSaving(false);
    };

    const generateRollup = async () => {
        if (selectedCellId === "all") {
            alert("Selecione uma célula para gerar rollup.");
            return;
        }

        // Simple logic: counts for current week items
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const weekStr = startOfWeek.toISOString().split('T')[0];

        const topCategories = items.reduce((acc: any, item: any) => {
            acc[item.category] = (acc[item.category] || 0) + 1;
            return acc;
        }, {});

        const blockersCount = items.filter(item => item.severity === 'blocker').length;

        const { error } = await supabase
            .from("eco_feedback_rollups")
            .upsert({
                cell_id: selectedCellId,
                week_start: weekStr,
                top_categories: topCategories,
                blockers_count: blockersCount,
                notes: `Auto-gerado via triage dashboard em ${new Date().toLocaleDateString()}`
            }, { onConflict: 'cell_id, week_start' });

        if (error) alert(error.message);
        else alert("Rollup gerado com sucesso para a semana de " + weekStr);
    };

    if (loading && items.length === 0) return <LoadingBlock text="Triando feedback..." />;

    return (
        <div className="animate-slide-up pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <MessageSquare className="text-secondary" size={32} />
                    <h1 className="stencil-text text-3xl">TRIAGEM DE FEEDBACK</h1>
                </div>

                <div className="flex flex-wrap gap-2">
                    <select
                        className="field max-w-[150px] text-xs font-bold uppercase"
                        value={selectedCellId}
                        onChange={(e) => setSelectedCellId(e.target.value)}
                    >
                        <option value="all">TODAS AS CÉLULAS</option>
                        {cells.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <button className="cta-button small" onClick={() => loadFeedback(true)}>
                        REPETIR BUSCA
                    </button>
                    <button className="cta-button small bg-secondary text-white" onClick={generateRollup}>
                        GERAR ROLLUP SEMANAL
                    </button>
                </div>
            </header>

            {/* Triage Table */}
            <div className="card border-2 border-foreground bg-white p-0 overflow-hidden">
                <div className="bg-muted/5 p-4 border-b-2 border-foreground flex gap-4 flex-wrap items-center">
                    <div className="flex items-center gap-2">
                        <ListFilter size={16} />
                        <span className="font-black text-[10px] uppercase">Filtros:</span>
                    </div>
                    <select
                        className="field py-1 px-2 text-[10px] font-bold uppercase w-fit"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">TODOS OS STATUS</option>
                        <option value="new">NOVO</option>
                        <option value="triaged">TRIADO</option>
                        <option value="planned">PLANEJADO</option>
                        <option value="done">FEITO</option>
                        <option value="wontfix">IGNORADO</option>
                    </select>
                    <select
                        className="field py-1 px-2 text-[10px] font-bold uppercase w-fit"
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value)}
                    >
                        <option value="all">TODAS AS SEVERIDADES</option>
                        <option value="low">BAIXA</option>
                        <option value="medium">MÉDIA</option>
                        <option value="high">ALTA</option>
                        <option value="blocker">BLOQUEIO</option>
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-foreground text-white">
                            <tr>
                                <th className="p-4 stencil-text text-xs uppercase">Severidade</th>
                                <th className="p-4 stencil-text text-xs uppercase">Categoria</th>
                                <th className="p-4 stencil-text text-xs uppercase">Resumo</th>
                                <th className="p-4 stencil-text text-xs uppercase">Status</th>
                                <th className="p-4 stencil-text text-xs uppercase">Data</th>
                                <th className="p-4 stencil-text text-xs uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(item => (
                                <tr key={item.id} className="border-b-2 border-foreground/10 hover:bg-muted/5 transition-colors">
                                    <td className="p-4">
                                        <span className={`px-2 py-0.5 border-2 border-foreground font-black text-[10px] uppercase ${item.severity === 'blocker' ? 'bg-red-500 text-white' :
                                            item.severity === 'high' ? 'bg-orange-400' :
                                                item.severity === 'medium' ? 'bg-yellow-400' : 'bg-gray-200'
                                            }`}>
                                            {item.severity}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className="font-black text-[10px] uppercase text-muted leading-tight">{item.category}</span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-black text-xs uppercase leading-tight">{item.summary}</span>
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.neighborhood?.name || 'SEM BAIRRO'}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`font-black text-[10px] uppercase ${item.status === 'done' ? 'text-green-600' :
                                            item.status === 'planned' ? 'text-blue-600' :
                                                item.status === 'new' ? 'text-orange-600' : 'text-gray-400'
                                            }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="p-4 whitespace-nowrap">
                                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted">
                                            <Clock size={12} /> {new Date(item.created_at).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <button
                                            className="cta-button small"
                                            style={{ padding: '4px 8px' }}
                                            onClick={() => startTriage(item)}
                                        >
                                            TRIAR
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {items.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-20 text-center font-black text-xs uppercase text-muted opacity-50">
                                        <Inbox className="mx-auto mb-4" size={48} />
                                        Nenhum feedback encontrado nesta célula.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {hasMore && (
                    <div className="p-4 border-t-2 border-foreground bg-muted/5 text-center">
                        <button
                            className="cta-button small w-full md:w-fit"
                            onClick={loadMore}
                            disabled={loading}
                        >
                            {loading ? 'CARREGANDO...' : 'CARREGAR MAIS'}
                        </button>
                    </div>
                )}
            </div>

            {/* Triage Detail Slide/Modal */}
            {triagingId && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
                    <div className="w-full max-w-md bg-white border-l-4 border-foreground animate-slide-in p-8 h-full overflow-y-auto">
                        <h2 className="stencil-text text-2xl mb-8">TRIAR ITEM</h2>

                        <div className="mb-8">
                            <label className="font-black text-[10px] uppercase text-muted">Aberto por:</label>
                            <p className="font-black text-sm uppercase">{items.find(i => i.id === triagingId)?.profile?.name || 'ANÔNIMO'}</p>
                            <p className="text-[10px] font-bold uppercase text-muted">{items.find(i => i.id === triagingId)?.role_at_time}</p>
                        </div>

                        <div className="mb-8">
                            <label className="font-black text-[10px] uppercase text-muted">Detalhes coletados:</label>
                            <p className="text-xs font-bold uppercase leading-tight mt-2 bg-muted/5 p-4 border-2 border-foreground border-dashed">
                                {items.find(i => i.id === triagingId)?.details || 'SEM DETALHES ADICIONAIS'}
                            </p>
                        </div>

                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="font-black text-[10px] uppercase text-muted">Novo Status</label>
                                <select
                                    className="field font-bold uppercase text-sm"
                                    value={tempStatus}
                                    onChange={(e) => setTempStatus(e.target.value)}
                                >
                                    <option value="new">NOVO</option>
                                    <option value="triaged">TRIADO</option>
                                    <option value="planned">PLANEJADO</option>
                                    <option value="done">FEITO</option>
                                    <option value="wontfix">IGNORADO (WONTFIX)</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="font-black text-[10px] uppercase text-muted">Notas de Triagem (Interno, max 300)</label>
                                <textarea
                                    className="field font-bold uppercase text-xs min-h-[100px]"
                                    value={tempNotes}
                                    onChange={(e) => setTempNotes(e.target.value)}
                                    maxLength={300}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="font-black text-[10px] uppercase text-muted">Próximo Prompt (Contexto LLM pós-triagem)</label>
                                <input
                                    type="text"
                                    className="field font-bold uppercase text-xs"
                                    value={tempHint}
                                    onChange={(e) => setTempHint(e.target.value)}
                                    placeholder="Ex: Corrigir limite da janela no domingo"
                                />
                            </div>

                            <div className="flex gap-2 mt-4">
                                <button className="cta-button grow justify-center" style={{ background: 'white' }} onClick={() => setTriagingId(null)}>CANCELAR</button>
                                <button className="cta-button grow justify-center bg-secondary text-white" disabled={isSaving} onClick={saveTriage}>
                                    {isSaving ? 'SALVANDO...' : 'SALVAR TRIAGEM'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
