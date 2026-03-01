"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    ClipboardList,
    Play,
    CheckSquare,
    Square,
    ExternalLink,
    ChevronRight,
    MapPin,
    Calendar,
    CheckCircle2,
    XCircle,
    Send,
    FileUp,
    Paperclip,
    AlertCircle,
    Eye
} from "lucide-react";
import Link from "next/link";

export default function UserTasksPage() {
    const [loading, setLoading] = useState(true);
    const [tasks, setTasks] = useState<any[]>([]);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [actions, setActions] = useState<any[]>([]);
    const [receiptSummary, setReceiptSummary] = useState("");
    const [saving, setSaving] = useState(false);
    const [evidences, setEvidences] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        loadTasks();
    }, []);

    const loadTasks = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from("eco_common_tasks")
            .select("*, cell:eco_cells(name), neighborhood:neighborhoods(name)")
            .eq("assignee_id", user.id)
            .order("created_at", { ascending: false });

        setTasks(data || []);
        setLoading(false);
    };

    const loadActions = async (taskId: string) => {
        const { data } = await supabase
            .from("eco_task_actions")
            .select("*")
            .eq("task_id", taskId)
            .order("created_at");
        setActions(data || []);
    };

    const loadEvidences = async (taskId: string) => {
        const { data } = await supabase
            .from("eco_task_evidence")
            .select("*")
            .eq("task_id", taskId)
            .order("created_at");
        setEvidences(data || []);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedTask) return;

        setUploading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch("/api/task/evidence/upload-url", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    task_id: selectedTask.id,
                    filename: file.name,
                    mime_type: file.type,
                    size_bytes: file.size
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Upload directly to bucket using signed URL
            const uploadRes = await fetch(data.upload_url, {
                method: "PUT",
                headers: { "Content-Type": file.type },
                body: file
            });

            if (!uploadRes.ok) throw new Error("Falha no upload para o storage.");

            alert(`Anexo enviado! Status: ${data.initial_status}`);
            await loadEvidences(selectedTask.id);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setUploading(false);
            e.target.value = "";
        }
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

    const handleRequestReview = async (evId: string) => {
        setUploading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch("/api/task/evidence/submit-review", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ evidence_id: evId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            alert("Enviado para revisão editorial da célula.");
            await loadEvidences(selectedTask.id);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleStartTask = async (taskId: string) => {
        const { error } = await supabase
            .from("eco_common_tasks")
            .update({ status: 'in_progress', started_at: new Date().toISOString() })
            .eq("id", taskId);

        if (!error) {
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'in_progress' } : t));
            if (selectedTask?.id === taskId) setSelectedTask({ ...selectedTask, status: 'in_progress' });
        }
    };

    const handleActionToggle = async (actionId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'done' ? 'todo' : 'done';
        const { error } = await supabase
            .from("eco_task_actions")
            .update({
                status: newStatus,
                completed_at: newStatus === 'done' ? new Date().toISOString() : null
            })
            .eq("id", actionId);

        if (!error) {
            setActions(prev => prev.map(a => a.id === actionId ? { ...a, status: newStatus } : a));
        }
    };

    const handleCompleteTask = async () => {
        if (!receiptSummary || receiptSummary.length < 10) {
            alert("Por favor, forneça um breve relato do que foi feito (mínimo 10 caracteres).");
            return;
        }

        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Create Receipt
        const { error: rError } = await supabase.from("eco_task_receipts").insert({
            task_id: selectedTask.id,
            summary: receiptSummary.slice(0, 300),
            created_by: user?.id
        });

        if (rError) {
            alert("Erro ao salvar recibo: " + rError.message);
            setSaving(false);
            return;
        }

        // 2. Complete Task
        const { error: tError } = await supabase
            .from("eco_common_tasks")
            .update({ status: 'done', completed_at: new Date().toISOString() })
            .eq("id", selectedTask.id);

        if (!tError) {
            alert("Tarefa concluída! Obrigado pela sua contribuição ao comum.");
            setSelectedTask(null);
            loadTasks();
        } else {
            alert("Erro ao concluir tarefa: " + tError.message);
        }
        setSaving(false);
    };

    if (loading) return <LoadingBlock text="Sintonizando seus compromissos..." />;

    return (
        <div className="animate-slide-up pb-20">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b-4 border-foreground pb-8">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-foreground text-white rounded-sm shadow-[4px_4px_0_0_rgba(255,193,7,1)]">
                        <ClipboardList size={40} />
                    </div>
                    <div>
                        <h1 className="stencil-text text-5xl uppercase tracking-tighter">MINHAS TAREFAS</h1>
                        <p className="text-xs font-black uppercase opacity-60 flex items-center gap-2 mt-1">
                            LUGAR DE AJUDA MÚTUA E CUIDADO COLETIVO
                        </p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Task List */}
                <div className="lg:col-span-1 border-r-2 border-foreground/5 pr-8 space-y-4">
                    <h2 className="stencil-text text-xs uppercase opacity-50 mb-4 tracking-widest flex items-center gap-2">
                        <Calendar size={14} /> COMPROMISSOS ATIVOS
                    </h2>
                    {tasks.map(task => (
                        <button
                            key={task.id}
                            onClick={() => {
                                setSelectedTask(task);
                                loadActions(task.id);
                                loadEvidences(task.id);
                                setReceiptSummary("");
                            }}
                            className={`w-full text-left p-6 border-2 transition-all flex flex-col gap-3 relative overflow-hidden group ${selectedTask?.id === task.id ? 'border-primary bg-primary/5' : 'border-foreground/5 bg-white hover:border-foreground/20'}`}
                        >
                            <div className="flex justify-between items-center">
                                <span className="text-[8px] font-black uppercase opacity-40">{task.cell?.name}</span>
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 border-2 ${task.status === 'done' ? 'bg-green-600 text-white border-green-600' : task.status === 'in_progress' ? 'bg-secondary text-white border-secondary' : 'border-foreground/20 opacity-40'}`}>
                                    {task.status}
                                </span>
                            </div>
                            <h3 className="stencil-text text-lg uppercase leading-tight group-hover:text-primary transition-colors">{task.title}</h3>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                                <MapPin size={10} className="text-primary" />
                                <span className="opacity-60">{task.neighborhood?.name || 'Célula Inteira'}</span>
                            </div>
                            {selectedTask?.id === task.id && <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary"></div>}
                        </button>
                    ))}
                    {tasks.length === 0 && (
                        <div className="py-20 text-center border-4 border-dashed border-foreground/5 opacity-40">
                            <p className="stencil-text text-sm">SEM TAREFAS PENDENTES</p>
                            <p className="text-[10px] font-bold mt-2 uppercase">Vá ao mural da sua célula para ajudar!</p>
                        </div>
                    )}
                </div>

                {/* Task Execution Detail */}
                <div className="lg:col-span-2">
                    {selectedTask ? (
                        <div className="space-y-12 animate-slide-up">
                            <section className="bg-white border-4 border-foreground p-8 shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
                                <div className="flex justify-between items-start mb-6 border-b-2 border-foreground/10 pb-4">
                                    <div>
                                        <h2 className="stencil-text text-3xl uppercase leading-tight">{selectedTask.title}</h2>
                                        <p className="text-[10px] font-black uppercase opacity-60 mt-2">TIPO: {selectedTask.kind.replace('_', ' ')}</p>
                                    </div>
                                    {selectedTask.status === 'accepted' && (
                                        <button
                                            onClick={() => handleStartTask(selectedTask.id)}
                                            className="cta-button bg-secondary text-white"
                                        >
                                            <Play size={16} /> INICIAR AGORA
                                        </button>
                                    )}
                                </div>

                                <div className="prose prose-sm max-w-none font-bold text-foreground/80 mb-8 leading-relaxed">
                                    {selectedTask.description_md || "Nenhuma instrução adicional fornecida."}
                                </div>

                                {selectedTask.status !== 'accepted' && (
                                    <div className="space-y-6 pt-6 border-t border-foreground/5">
                                        <h3 className="stencil-text text-xs text-primary tracking-widest uppercase">CHECKLIST DE EXECUÇÃO</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {actions.map(action => (
                                                <button
                                                    key={action.id}
                                                    onClick={() => selectedTask.status !== 'done' && handleActionToggle(action.id, action.status)}
                                                    className={`flex items-center gap-3 p-4 border-2 text-left transition-all ${action.status === 'done' ? 'border-green-600 bg-green-50/50 opacity-60' : 'border-foreground/10 hover:border-foreground/30'}`}
                                                    disabled={selectedTask.status === 'done'}
                                                >
                                                    {action.status === 'done' ? <CheckSquare className="text-green-600" size={20} /> : <Square className="opacity-20" size={20} />}
                                                    <span className={`text-xs font-black uppercase ${action.status === 'done' ? 'line-through' : ''}`}>
                                                        {action.title}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* EVIDÊNCIAS A52 */}
                                {selectedTask.status === 'in_progress' && (
                                    <div className="space-y-4 pt-6 mt-6 border-t-4 border-foreground border-dashed">
                                        <div className="flex justify-between items-center">
                                            <h3 className="stencil-text text-xs text-secondary tracking-widest uppercase flex items-center gap-2">
                                                <Paperclip size={14} /> EVIDÊNCIA DO COMUM (OPCIONAL)
                                            </h3>
                                            <label className={`cta-button tiny bg-foreground text-white cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                                <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileUpload} disabled={uploading} />
                                                <FileUp size={14} /> {uploading ? 'ENVIANDO...' : 'ANEXAR ARQUIVO (MÁX 2MB)'}
                                            </label>
                                        </div>
                                        <p className="text-[10px] font-bold opacity-60 uppercase mb-4">Zero PII: Evite rostos, placas e endereços residenciais exatos.</p>

                                        <div className="space-y-2">
                                            {evidences.map(ev => (
                                                <div key={ev.id} className="flex flex-col md:flex-row md:items-center justify-between p-3 border-2 border-foreground/10 bg-white">
                                                    <div className="flex items-center gap-2 mb-2 md:mb-0">
                                                        <Paperclip size={16} className="text-secondary" />
                                                        <span className="text-[10px] font-black uppercase truncate max-w-[150px]">{ev.title}</span>
                                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 border-2 ${ev.status === 'approved' ? 'bg-green-600 text-white border-green-600' :
                                                                ev.status === 'needs_review' ? 'bg-orange-400 text-white border-orange-400' :
                                                                    ev.status === 'rejected' ? 'bg-red-600 text-white border-red-600' :
                                                                        'border-foreground/20'
                                                            }`}>
                                                            {ev.status}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleViewEvidence(ev.id)}
                                                            className="text-[10px] font-black uppercase underline hover:text-secondary opacity-60 flex items-center gap-1"
                                                        >
                                                            <Eye size={12} /> VER
                                                        </button>
                                                        {ev.status === 'uploaded' && (
                                                            <button
                                                                onClick={() => handleRequestReview(ev.id)}
                                                                disabled={uploading}
                                                                className="text-[10px] font-black uppercase bg-foreground text-amber-300 px-2 py-1"
                                                            >
                                                                REVISÃO
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {evidences.length === 0 && (
                                                <div className="p-4 text-center border-2 border-foreground/5 bg-muted/20">
                                                    <p className="text-[10px] uppercase font-bold opacity-40">NENHUM ARQUIVO ANEXADO.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </section>

                            {selectedTask.status === 'in_progress' && (
                                <section className="p-8 border-4 border-dashed border-primary bg-primary/5 space-y-6">
                                    <h3 className="stencil-text text-lg uppercase flex items-center gap-2">
                                        <CheckCircle2 size={24} className="text-primary" /> CONCLUIR E GERAR RECIBO
                                    </h3>
                                    <p className="text-xs font-bold leading-relaxed">
                                        Para finalizar este suporte ao comum, descreva brevemente o que foi realizado.
                                        Isso ajuda na transparência da célula e no acompanhamento de melhorias.
                                    </p>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase opacity-60">Relato da Execução (Máx 300 chars, Sem PII)</label>
                                        <textarea
                                            className="w-full bg-white border-2 border-foreground p-4 text-xs font-bold focus:shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-all outline-none h-32"
                                            placeholder="Ex: Movimentei as cestas conforme planejado, estoque atualizado na prateleira B..."
                                            maxLength={300}
                                            value={receiptSummary}
                                            onChange={e => setReceiptSummary(e.target.value)}
                                        />
                                        <div className="flex justify-between items-center">
                                            <p className="text-[8px] font-black uppercase opacity-40">NÃO CLUA NOMES, TELEFONES OU EMAILS.</p>
                                            <p className="text-[8px] font-black uppercase">{receiptSummary.length}/300</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleCompleteTask}
                                        disabled={saving}
                                        className="cta-button w-full justify-center"
                                    >
                                        <Send size={18} /> {saving ? "PROCESSANDO..." : "ENVIAR RECIBO E FINALIZAR"}
                                    </button>
                                </section>
                            )}

                            {selectedTask.status === 'done' && (
                                <div className="p-8 border-4 border-green-600 bg-green-50 text-center space-y-4">
                                    <div className="w-16 h-16 bg-green-600 text-white rounded-full flex items-center justify-center mx-auto shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <h3 className="stencil-text text-2xl text-green-700 uppercase">MISSO CUMPRIDA!</h3>
                                    <p className="text-xs font-black uppercase opacity-60">Sua contribuição foi registrada no coração da célula.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-32 border-4 border-dashed border-foreground/5 opacity-30 grayscale">
                            <ClipboardList size={64} className="mb-4" />
                            <p className="stencil-text text-xl">SELECIONE UMA TAREFA PARA EXECUÇÃO</p>
                            <p className="text-[10px] uppercase font-bold mt-2 tracking-widest">O COMUM CONTA COM VOCÊ</p>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .card { border-radius: 0; }
            `}</style>
        </div>
    );
}
