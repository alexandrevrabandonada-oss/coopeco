"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    Video,
    Volume2,
    Plus,
    Trash2,
    Link as LinkIcon,
    Save,
    Check,
    X,
    Send,
    Archive,
    RotateCcw,
    AlertTriangle,
    CheckCircle2,
    Search,
    Filter,
    MessageCircle,
    FileText,
    AlertCircle,
    Sparkles
} from "lucide-react";
import { VRBadge } from "@/components/vr-badge";
import { assertNoPII } from "@/lib/privacy/sanitize";
import { lintCopy, autofixCopy } from "@/lib/copy/lint";
import Link from "next/link";

type Status = 'draft' | 'review' | 'published' | 'archived';

export default function CellCurationAdmin() {
    const [loading, setLoading] = useState(true);
    const [media, setMedia] = useState<any[]>([]);
    const [tips, setTips] = useState<any[]>([]);
    const [cells, setCells] = useState<any[]>([]);
    const [selectedCell, setSelectedCell] = useState<string>("");
    const [activeTab, setActiveTab] = useState<Status>('draft');
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [form, setForm] = useState({
        title: "",
        slug: "",
        kind: "video",
        storage_path: "",
        description: "",
        material: "",
        flag: "",
        transcript_md: "",
        cell_id: "" as string | null,
        is_public: true,
        no_people_checkbox: false,
        tip_id: "" as string | null
    });

    const supabase = createClient();

    const loadData = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        // Load cells the user can manage
        const { data: mandates } = await supabase
            .from("eco_governance_mandates")
            .select("cell_id, cell:eco_cells(name)")
            .eq("user_id", user?.id)
            .eq("active", true);

        const availableCells = mandates?.map(m => ({ id: m.cell_id, name: (m.cell as any).name })) || [];
        setCells(availableCells);

        if (availableCells.length > 0 && !selectedCell) {
            setSelectedCell(availableCells[0].id);
        }

        const [mRes, tRes] = await Promise.all([
            supabase.from("edu_media_assets")
                .select("*")
                .eq("status", activeTab)
                .order("created_at", { ascending: false }),
            supabase.from("edu_tips")
                .select("id, title, material, flag")
                .eq("active", true)
                .order("title")
        ]);

        if (mRes.data) setMedia(mRes.data);
        if (tRes.data) setTips(tRes.data);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [activeTab, selectedCell]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // PII Check (A34)
        try {
            assertNoPII({ ...form });
        } catch (err: any) {
            alert(`Violação de Privacidade: ${err.message}`);
            return;
        }

        setIsSaving(true);
        if (!form.no_people_checkbox) {
            alert("Você deve confirmar que não há pessoas identificáveis na mídia.");
            setIsSaving(false);
            return;
        }

        // Limits validation (A42)
        // Note: Real file validation would happen on file input, but since we are using 'storage_path' string:
        // we'll implement a 'policy' check if metadata was available, or just log limits.
        // For now, enforcing a "best effort" check if values were provided:
        if (form.kind === 'video' && (form as any).size_bytes > 10 * 1024 * 1024) {
            alert("Vídeo excede limite de 10MB. Reduza a resolução ou duração.");
            setIsSaving(false);
            return;
        }
        if (form.kind === 'audio' && (form as any).size_bytes > 3 * 1024 * 1024) {
            alert("Áudio excede limite de 3MB.");
            setIsSaving(false);
            return;
        }

        const { no_people_checkbox, tip_id, ...mediaData } = form;
        const dataToSave = { ...mediaData, cell_id: selectedCell || null };

        const { error } = editingId
            ? await supabase.from("edu_media_assets").update(dataToSave).eq("id", editingId)
            : await supabase.from("edu_media_assets").insert([dataToSave]);

        if (error) {
            alert(error.message);
        } else {
            // Handle tip linking if provided
            if (!editingId && tip_id) {
                // We need the new media ID. For simplicity in this UI, we'll reload and let user link
                // or we could use the return from insert.
                // Re-calculating for just established linkage:
                const { data: newMedia } = await supabase.from("edu_media_assets").select("id").eq("slug", form.slug).single();
                if (newMedia) {
                    await supabase.from("edu_tip_media").insert([{ tip_id, media_id: newMedia.id }]);
                }
            } else if (editingId && tip_id) {
                await supabase.from("edu_tip_media").upsert([{ tip_id, media_id: editingId }], { onConflict: 'tip_id,media_id' });
            }

            // Handle flags
            if (form.flag) {
                const targetId = editingId || (await supabase.from("edu_media_assets").select("id").eq("slug", form.slug).single()).data?.id;
                if (targetId) {
                    await supabase.from("eco_content_flags").upsert([{
                        media_id: targetId,
                        flag: form.flag,
                        material: form.material
                    }], { onConflict: 'media_id,flag' });
                }
            }

            setEditingId(null);
            setForm({ title: "", slug: "", kind: "video", storage_path: "", description: "", material: "", flag: "", transcript_md: "", cell_id: null, is_public: true, no_people_checkbox: false, tip_id: "" });
            loadData();
        }
        setIsSaving(false);
    };

    const handleWorkflow = async (id: string, action: 'submit' | 'approve' | 'reject' | 'archive') => {
        setIsSaving(true);
        let error;

        if (action === 'submit') {
            const item = media.find(m => m.id === id);
            if (!item.transcript_md) {
                alert("Transcrição é obrigatória para enviar para revisão (A40).");
                setIsSaving(false);
                return;
            }
            const { error: err } = await supabase.rpc("rpc_submit_media_for_review", { p_media_id: id });
            error = err;
        } else if (action === 'approve') {
            const item = media.find(m => m.id === id);

            // A43: Copy Anti-Culpa Linting
            const lintResult = await lintCopy(`${item.title} ${item.description} ${item.transcript_md}`, {
                cell_id: item.cell_id,
                source_kind: 'edu_media_content'
            });

            if (!lintResult.ok) {
                const blockers = lintResult.findings.filter(f => f.severity === 'blocker');
                alert(`BLOQUEIO DE LINGUAGEM (Anti-Culpa):\n\n${blockers.map(b => `- ${b.excerpt}: ${b.hint}`).join('\n')}\n\nAjuste o texto antes de publicar.`);
                setIsSaving(false);
                return;
            }

            if (item.compression_status !== 'done') {
                if (!confirm("Esta mídia NÃO está comprimida (LEVE). Deseja publicar a versão ORIGINAL (pesada)?")) {
                    setIsSaving(false);
                    return;
                }
            }
            const { error: err } = await supabase.rpc("rpc_review_media", {
                p_media_id: id,
                p_decision: 'approve',
                p_notes: 'Aprovado via dashboard'
            });
            error = err;
        } else if (action === 'reject') {
            const notes = prompt("Motivo da rejeição:");
            if (!notes) { setIsSaving(false); return; }
            const { error: err } = await supabase.rpc("rpc_review_media", {
                p_media_id: id,
                p_decision: 'reject',
                p_notes: notes.slice(0, 200)
            });
            error = err;
        } else if (action === 'archive') {
            const { error: err } = await supabase.rpc("rpc_archive_media", { p_media_id: id });
            error = err;
        }

        if (error) alert(error.message);
        else loadData();
        setIsSaving(false);
    };

    const handleReprocess = async (id: string) => {
        setIsSaving(true);
        // Create a new job record to trigger reprocessing (assuming edge function/trigger listens)
        const { error } = await supabase.from("eco_media_jobs").insert([{
            media_id: id,
            job_kind: 'compress_video',
            status: 'queued'
        }]);

        if (error) alert(error.message);
        else {
            await supabase.from("edu_media_assets").update({ compression_status: 'queued' }).eq("id", id);
            loadData();
        }
        setIsSaving(false);
    };

    if (loading && media.length === 0) return <LoadingBlock text="Carregando curadoria local..." />;

    return (
        <div className="animate-slide-up pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="text-primary" size={32} />
                    <h1 className="stencil-text text-3xl">CURADORIA LOCAL</h1>
                </div>
                <div className="flex items-center gap-4">
                    <select
                        className="field text-xs font-bold uppercase"
                        value={selectedCell}
                        onChange={(e) => setSelectedCell(e.target.value)}
                    >
                        {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <VRBadge />
                </div>
            </header>

            <div className="flex gap-2 mb-8 border-b-4 border-foreground overflow-x-auto pb-4">
                {(['draft', 'review', 'published', 'archived'] as Status[]).map(status => (
                    <button
                        key={status}
                        onClick={() => setActiveTab(status)}
                        className={`cta-button small whitespace-nowrap ${activeTab === status ? 'bg-primary' : 'bg-white opacity-50'}`}
                    >
                        {status === 'draft' ? 'RASCUNHOS' :
                            status === 'review' ? 'EM REVISÃO' :
                                status === 'published' ? 'PUBLICADOS' : 'ARQUIVADOS'}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 flex flex-col gap-6">
                    {media.length === 0 ? (
                        <div className="card p-12 text-center opacity-30 italic font-black text-xs uppercase">
                            Nenhum conteúdo neste status.
                        </div>
                    ) : (
                        media.map(item => (
                            <div key={item.id} className="card border-2 border-foreground bg-white p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        {item.kind === 'video' ? <Video className="text-secondary" /> : <Volume2 className="text-secondary" />}
                                        <div>
                                            <h3 className="font-black text-sm uppercase">{item.title}</h3>
                                            <p className="text-[10px] font-mono opacity-50">{item.storage_path}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {activeTab === 'draft' && (
                                            <>
                                                <button onClick={() => setEditingId(item.id)} className="cta-button tiny">EDITAR</button>
                                                <button onClick={() => handleWorkflow(item.id, 'submit')} className="cta-button tiny bg-green-600 text-white border-green-800">
                                                    <Send size={12} /> ENVIAR
                                                </button>
                                            </>
                                        )}
                                        {activeTab === 'review' && (
                                            <>
                                                <button onClick={() => handleWorkflow(item.id, 'approve')} className="cta-button tiny bg-green-600 text-white border-green-800">APROVAR</button>
                                                <button onClick={() => handleWorkflow(item.id, 'reject')} className="cta-button tiny bg-red-600 text-white border-red-800">REJEITAR</button>
                                            </>
                                        )}
                                        {activeTab === 'published' && (
                                            <button onClick={() => handleWorkflow(item.id, 'archive')} className="cta-button tiny opacity-50"><Archive size={12} /></button>
                                        )}
                                        {activeTab === 'archived' && (
                                            <button onClick={() => handleWorkflow(item.id, 'submit')} className="cta-button tiny"><RotateCcw size={12} /> RESTAURAR</button>
                                        )}
                                        <button onClick={() => handleReprocess(item.id)} className="cta-button tiny opacity-50" title="Reprocessar Compressão">
                                            <RotateCcw size={12} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 mb-4">
                                    <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${item.compression_status === 'done' ? 'bg-green-100 text-green-700' :
                                        item.compression_status === 'failed' ? 'bg-red-100 text-red-700' :
                                            'bg-blue-100 text-blue-700 animate-pulse'
                                        }`}>
                                        Compressão: {item.compression_status || 'none'}
                                    </div>
                                    {item.bitrate_kbps && <span className="text-[8px] font-mono opacity-50">{item.bitrate_kbps}kbps</span>}
                                </div>

                                {item.transcript_md ? (
                                    <div className="mb-4 p-3 bg-muted/5 border border-dashed border-foreground/10 text-[10px] italic">
                                        {item.transcript_md.slice(0, 100)}...
                                    </div>
                                ) : (
                                    <div className="mb-4 p-3 bg-red-50 text-red-600 text-[10px] font-black uppercase flex items-center gap-2">
                                        <AlertTriangle size={14} /> Transcrição faltando!
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <aside>
                    <div className="card border-4 border-foreground bg-primary p-6">
                        <h2 className="stencil-text text-xl mb-6">{editingId ? 'EDITAR' : 'NOVO CONTEÚDO'}</h2>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <input className="field text-xs font-bold uppercase" placeholder="TÍTULO" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                            <input className="field text-xs font-bold" placeholder="SLUG" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} required />
                            <select className="field text-xs font-bold uppercase" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
                                <option value="video">VÍDEO</option>
                                <option value="audio">ÁUDIO</option>
                            </select>
                            <input className="field text-xs font-bold uppercase" placeholder="MATERIAL (EX: PLASTIC)" value={form.material} onChange={e => setForm({ ...form, material: e.target.value })} />
                            <select className="field text-xs font-bold uppercase" value={form.flag} onChange={e => setForm({ ...form, flag: e.target.value })}>
                                <option value="">SEM FLAG</option>
                                <option value="food">COMIDA</option>
                                <option value="liquids">LÍQUIDOS</option>
                                <option value="mixed">MISTURADO</option>
                                <option value="sharp">PERFURANTE</option>
                                <option value="volume">VOLUME</option>
                            </select>

                            <select className="field text-xs font-bold uppercase" value={form.tip_id || ""} onChange={e => setForm({ ...form, tip_id: e.target.value })}>
                                <option value="">VINCULAR A DICA (OPCIONAL)</option>
                                {tips.map(t => (
                                    <option key={t.id} value={t.id}>{t.title}</option>
                                ))}
                            </select>

                            <textarea className="field text-xs font-bold p-3 min-h-[100px]" placeholder="TRANSCRIÇÃO (OBRIGATÓRIO PARA PUBLICAR)" value={form.transcript_md} onChange={e => setForm({ ...form, transcript_md: e.target.value })} />

                            <label className="flex items-center gap-3 p-3 bg-white/10 border-2 border-foreground cursor-pointer transition-colors hover:bg-white/20">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 accent-primary"
                                    checked={form.no_people_checkbox}
                                    onChange={e => setForm({ ...form, no_people_checkbox: e.target.checked })}
                                />
                                <span className="text-[10px] font-black uppercase leading-tight">
                                    Confirmo que esta mídia não contém pessoas identificáveis (apenas materiais/objetos)
                                </span>
                            </label>

                            <button type="submit" className="cta-button w-full justify-center bg-foreground text-white" disabled={isSaving}>
                                <Save size={18} /> {isSaving ? 'SALVANDO...' : 'SALVAR RASCUNHO'}
                            </button>
                        </form>
                    </div>
                </aside>
            </div>
        </div>
    );
}
