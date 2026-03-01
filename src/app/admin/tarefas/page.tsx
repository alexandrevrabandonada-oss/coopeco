"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    ClipboardList,
    Filter,
    CheckCircle2,
    Clock,
    Search,
    MapPin,
    BarChart3,
    ChevronDown,
    Activity,
    FileText,
    ExternalLink,
    Paperclip,
    Eye
} from "lucide-react";

export default function AdminTasksPage() {
    const [loading, setLoading] = useState(true);
    const [tasks, setTasks] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [selectedCell, setSelectedCell] = useState<string>("all");
    const [cells, setCells] = useState<any[]>([]);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [generatingRollup, setGeneratingRollup] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        loadData();
    }, [selectedCell, filterStatus]);

    const loadData = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Mandates for cell access
        const { data: mandates } = await supabase.from("eco_mandates").select("cell_id").eq("user_id", user.id).eq("status", "active");
        const cellIds = mandates?.map(m => m.cell_id) || [];

        // 1. Cells
        const { data: cData } = await supabase.from("eco_cells").select("*").in("id", cellIds).order("name");
        setCells(cData || []);

        // 2. Tasks
        let query = supabase
            .from("eco_common_tasks")
            .select(`
                *,
                cell:eco_cells(name),
                neighborhood:neighborhoods(name),
                assignee:auth_users_view(display_name),
                receipts:eco_task_receipts(summary, created_at),
                evidences:eco_task_evidence(id, title, status, kind)
            `)
            .in("cell_id", cellIds)
            .order("created_at", { ascending: false });

        if (selectedCell !== "all") query = query.eq("cell_id", selectedCell);
        if (filterStatus !== "all") query = query.eq("status", filterStatus);

        const { data: tData } = await query;
        setTasks(tData || []);

        // 3. Simple Stats
        if (tData) {
            setStats({
                total: tData.length,
                done: tData.filter(t => t.status === 'done').length,
                running: tData.filter(t => t.status === 'in_progress').length,
                pending: tData.filter(t => t.status === 'accepted').length
            });
        }

        setLoading(false);
    };

    const generateWeeklyRollup = async () => {
        if (selectedCell === "all") {
            alert("Selecione uma célula específica para gerar o rollup.");
            return;
        }

        setGeneratingRollup(true);
        // Find start of current week (Monday)
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff)).toISOString().split('T')[0];

        // Aggregate locally for the rollup
        const cellTasks = tasks.filter(t => t.status === 'done' && t.completed_at?.startsWith(new Date().toISOString().split('T')[0]));
        const kindsCount: Record<string, number> = {};
        cellTasks.forEach(t => {
            kindsCount[t.kind] = (kindsCount[t.kind] || 0) + 1;
        });

        const { error } = await supabase.from("eco_task_rollups_weekly").upsert({
            cell_id: selectedCell,
            week_start: monday,
            done_count: cellTasks.length,
            kinds: kindsCount
        }, { onConflict: 'cell_id, week_start' });

        if (!error) {
            alert("Rollup semanal gerado com sucesso!");
        } else {
            alert("Erro ao gerar rollup: " + error.message);
        }
        setGeneratingRollup(false);
    };

    const handleViewEvidence = async (evId: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/task/evidence/signed-url?evidence_id=${evId}`, {
            headers: { "Authorization": `Bearer ${session?.access_token}` }
        });
        const data = await res.json();
        if (!res.ok) alert(data.error);
        else window.open(data.url, "_blank");
    };

    if (loading && tasks.length === 0) return <LoadingBlock text="Auditando tarefas do comum..." />;

    return (
        <div className="animate-slide-up pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b-4 border-foreground pb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-secondary text-white rounded-sm shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                        <Activity size={32} />
                    </div>
                    <div>
                        <h1 className="stencil-text text-4xl uppercase tracking-tighter">GESTÃO DE TAREFAS</h1>
                        <p className="text-[10px] font-black uppercase opacity-60">MONITORAMENTO DE TRABALHO COLETIVO</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <select
                        className="field py-2 text-[10px] font-black uppercase bg-white border-2"
                        value={selectedCell}
                        onChange={e => setSelectedCell(e.target.value)}
                    >
                        <option value="all">TODAS AS CÉLULAS</option>
                        {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select
                        className="field py-2 text-[10px] font-black uppercase bg-white border-2"
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                    >
                        <option value="all">TODOS STATUS</option>
                        <option value="accepted">ACEITO</option>
                        <option value="in_progress">EM CURSO</option>
                        <option value="done">CONCLUÍDO</option>
                    </select>
                    <button
                        onClick={generateWeeklyRollup}
                        disabled={generatingRollup || selectedCell === "all"}
                        className="cta-button small bg-foreground text-white disabled:opacity-30"
                    >
                        <BarChart3 size={16} /> {generatingRollup ? "GERANDO..." : "GERAR ROLLUP"}
                    </button>
                </div>
            </header>

            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                    {[
                        { label: 'Total', val: stats.total, color: 'border-foreground' },
                        { label: 'Concluídas', val: stats.done, color: 'border-green-600 text-green-600' },
                        { label: 'Em Curso', val: stats.running, color: 'border-secondary text-secondary' },
                        { label: 'Pendente', val: stats.pending, color: 'border-muted opacity-60' }
                    ].map(s => (
                        <div key={s.label} className={`card p-4 border-2 bg-white flex flex-col items-center justify-center ${s.color}`}>
                            <span className="text-[10px] font-black uppercase opacity-40 mb-1">{s.label}</span>
                            <span className="stencil-text text-3xl">{s.val}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="space-y-4">
                {tasks.map(task => (
                    <div key={task.id} className="card bg-white border-2 border-foreground/5 hover:border-foreground/20 p-6 flex flex-col md:flex-row justify-between gap-6 transition-all group">
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-foreground text-white">{task.kind}</span>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 border-2 ${task.status === 'done' ? 'border-green-600 text-green-600' : task.status === 'in_progress' ? 'border-secondary text-secondary' : 'border-foreground/20 opacity-40'}`}>
                                    {task.status}
                                </span>
                                <span className="text-[10px] font-bold opacity-40 uppercase line-clamp-1">{task.cell?.name} / {task.neighborhood?.name || 'Célula'}</span>
                            </div>
                            <h3 className="stencil-text text-xl uppercase leading-tight group-hover:text-primary transition-colors">{task.title}</h3>
                            <div className="flex items-center gap-2">
                                <FileText size={14} className="opacity-40" />
                                <span className="text-[10px] font-black uppercase">Responsável: {task.assignee?.display_name || 'Usuário'}</span>
                            </div>
                        </div>

                        <div className="md:w-1/3 flex flex-col justify-center gap-4 pl-6 border-l-2 border-foreground/5">
                            {task.status === 'done' && task.receipts?.[0] ? (
                                <div className="space-y-2">
                                    <h4 className="text-[9px] font-black uppercase text-primary tracking-widest flex items-center gap-1">
                                        <CheckCircle2 size={12} /> RECIBO RECEBIDO
                                    </h4>
                                    <p className="text-[11px] font-bold italic opacity-70 line-clamp-3">"{task.receipts[0].summary}"</p>
                                    <span className="text-[8px] font-black opacity-30 uppercase">{new Date(task.receipts[0].created_at).toLocaleString()}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 opacity-30 italic text-[10px] font-bold">
                                    <Clock size={16} />
                                    <span>Aguardando execução...</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {tasks.length === 0 && (
                    <div className="py-32 text-center border-4 border-dashed border-foreground/5 opacity-40 grayscale">
                        <Search size={64} className="mx-auto mb-4" />
                        <p className="stencil-text text-2xl uppercase">Nenhuma tarefa encontrada</p>
                        <p className="text-[10px] uppercase font-bold mt-2">Ajuste os filtros para ampliar a busca.</p>
                    </div>
                )}
            </div>

            <style jsx>{`
                .card { border-radius: 0; }
                .field { border-radius: 0; }
            `}</style>
        </div>
    );
}
