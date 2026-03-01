"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    Play,
    Scan,
    History,
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    Search,
    Database,
    ShieldAlert,
    Clock,
    User
} from "lucide-react";

export default function AdminCopyBatchPage() {
    const [loading, setLoading] = useState(true);
    const [jobs, setJobs] = useState<any[]>([]);
    const [cells, setCells] = useState<any[]>([]);
    const [selectedCell, setSelectedCell] = useState<string>("");
    const [selectedMode, setSelectedMode] = useState<'scan_only' | 'autofix_drafts' | 'autofix_all_with_history'>('scan_only');
    const [isRunning, setIsRunning] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const { data: jData } = await supabase.from("eco_copy_batch_jobs").select("*").order("created_at", { ascending: false }).limit(20);
        const { data: cData } = await supabase.from("eco_cells").select("id, name").order("name");
        setJobs(jData || []);
        setCells(cData || []);
        setLoading(false);
    };

    const handleCreateJob = async () => {
        setIsRunning(true);
        const { data: job, error } = await supabase.from("eco_copy_batch_jobs").insert({
            scope: selectedCell ? 'cell' : 'global',
            cell_id: selectedCell || null,
            mode: selectedMode,
            status: 'queued'
        }).select().single();

        if (error) {
            alert(error.message);
            setIsRunning(false);
            return;
        }

        // Run the RPC
        const { data: results, error: rpcError } = await supabase.rpc('rpc_run_copy_batch', { p_job_id: job.id });

        if (rpcError) alert(rpcError.message);

        await loadData();
        setIsRunning(false);
    };

    return (
        <div className="animate-slide-up pb-12">
            <header className="flex items-center gap-3 mb-8">
                <Database className="text-primary" size={32} />
                <h1 className="stencil-text text-3xl">BATCH COPY LINT & MIGRATION</h1>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                <div className="lg:col-span-1 border-4 border-foreground p-6 bg-white shadow-[8px_8px_0_0_rgba(0,0,0,1)] h-fit">
                    <h2 className="stencil-text text-xl mb-6">NOVA AUDITORIA EM LOTE</h2>

                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-1">
                            <label className="font-black text-[10px] uppercase">Escopo de Célula (Opcional)</label>
                            <select
                                className="field font-bold uppercase text-xs"
                                value={selectedCell}
                                onChange={e => setSelectedCell(e.target.value)}
                            >
                                <option value="">Global (Tudo)</option>
                                {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="font-black text-[10px] uppercase">Modo de Operação</label>
                            <div className="flex flex-col gap-2">
                                {[
                                    { id: 'scan_only', label: 'Somente Escanear', desc: 'Identifica e loga infrações sem alterar dados.' },
                                    { id: 'autofix_drafts', label: 'Corrigir Rascunhos', desc: 'Aplica autofix em conteúdos não publicados.' },
                                    { id: 'autofix_all_with_history', label: 'Corrigir Tudo (Auditoria)', desc: 'Altera tudo com registro de histórico. USE COM CAUTELA.' }
                                ].map(mode => (
                                    <label key={mode.id} className={`p-3 border-2 cursor-pointer transition-all ${selectedMode === mode.id ? 'border-primary bg-primary/5' : 'border-foreground/10 grayscale opacity-60'
                                        }`}>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="mode"
                                                checked={selectedMode === mode.id}
                                                onChange={() => setSelectedMode(mode.id as any)}
                                                className="accent-primary"
                                            />
                                            <span className="font-black text-[10px] uppercase">{mode.label}</span>
                                        </div>
                                        <p className="text-[9px] font-bold opacity-70 mt-1 leading-tight">{mode.desc}</p>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleCreateJob}
                            disabled={isRunning}
                            className={`w-full py-4 stencil-text text-xl flex items-center justify-center gap-3 transition-all ${isRunning ? 'bg-muted cursor-wait' : 'bg-primary hover:bg-primary/90'
                                }`}
                        >
                            {isRunning ? (
                                <Clock className="animate-spin" size={24} />
                            ) : (
                                <Play size={24} />
                            )}
                            {isRunning ? "PROCESSANDO..." : "INICIAR BATCH"}
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <h2 className="stencil-text text-xl mb-6 flex items-center gap-2">
                        <History size={24} /> HISTÓRICO DE JOBS
                    </h2>

                    <div className="flex flex-col gap-4">
                        {loading ? <LoadingBlock text="Carregando histórico..." /> : jobs.map(job => (
                            <div key={job.id} className="card bg-white border-2 border-foreground/10 p-5 hover:border-foreground transition-all">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 font-black text-[10px] uppercase text-white ${job.status === 'done' ? 'bg-green-600' : job.status === 'failed' ? 'bg-red-600' : 'bg-blue-600'
                                            }`}>
                                            {job.status}
                                        </div>
                                        <div>
                                            <span className="font-black text-xs uppercase block">Job #{job.id.slice(0, 8)}</span>
                                            <span className="text-[10px] font-bold opacity-40 uppercase">{new Date(job.created_at).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-black text-[10px] uppercase bg-muted px-2 py-0.5">{job.mode}</span>
                                        <span className="font-black text-[10px] uppercase bg-foreground text-white px-2 py-0.5">{job.scope}</span>
                                    </div>
                                </div>

                                {job.results && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="flex flex-col items-center p-2 bg-muted/5 border border-foreground/5">
                                            <span className="text-[8px] font-black uppercase opacity-50">Total</span>
                                            <span className="text-xl font-black">{job.results.totals || 0}</span>
                                        </div>
                                        <div className={`flex flex-col items-center p-2 border ${job.results.blockers > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-muted/5 border-foreground/5'}`}>
                                            <span className="text-[8px] font-black uppercase opacity-50 text-foreground">Blockers</span>
                                            <span className="text-xl font-black">{job.results.blockers || 0}</span>
                                        </div>
                                        <div className={`flex flex-col items-center p-2 border ${job.results.warns > 0 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-muted/5 border-foreground/5'}`}>
                                            <span className="text-[8px] font-black uppercase opacity-50 text-foreground">Warns</span>
                                            <span className="text-xl font-black">{job.results.warns || 0}</span>
                                        </div>
                                        <div className="flex flex-col items-center p-2 bg-muted/5 border border-foreground/5 overflow-hidden">
                                            <span className="text-[8px] font-black uppercase opacity-50">Fixes</span>
                                            <span className="text-xl font-black truncate">{job.results.autofix_simulated ? 'SIM' : 'NÃO'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
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
