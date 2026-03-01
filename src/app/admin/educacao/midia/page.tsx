"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    Video,
    Volume2,
    Image as ImageIcon,
    Plus,
    Trash2,
    Link as LinkIcon,
    Save,
    Check,
    X,
    FileUp,
    Play
} from "lucide-react";
import { VRBadge } from "@/components/vr-badge";

export default function EduMediaAdmin() {
    const [loading, setLoading] = useState(true);
    const [media, setMedia] = useState<any[]>([]);
    const [tips, setTips] = useState<any[]>([]);
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
        transcript_md: ""
    });

    const supabase = createClient();

    const loadData = async () => {
        setLoading(true);
        const [mRes, tRes] = await Promise.all([
            supabase.from("edu_media_assets").select("*").order("created_at", { ascending: false }),
            supabase.from("edu_tips").select("id, title, material, flag").eq("active", true).order("title")
        ]);
        if (mRes.data) setMedia(mRes.data);
        if (tRes.data) setTips(tRes.data);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        const { error } = editingId
            ? await supabase.from("edu_media_assets").update(form).eq("id", editingId)
            : await supabase.from("edu_media_assets").insert([form]);

        if (error) {
            alert(error.message);
        } else {
            setEditingId(null);
            setForm({ title: "", slug: "", kind: "video", storage_path: "", description: "", material: "", flag: "", transcript_md: "" });
            loadData();
        }
        setIsSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir esta mídia? Isso removerá todos os vínculos com dicas.")) return;
        const { error } = await supabase.from("edu_media_assets").delete().eq("id", id);
        if (error) alert(error.message);
        else loadData();
    };

    const linkTip = async (mediaId: string, tipId: string) => {
        const { error } = await supabase.from("edu_tip_media").insert([{ media_id: mediaId, tip_id: tipId }]);
        if (error) {
            if (error.code === '23505') alert("Esta aula já está vinculada a esta dica.");
            else alert(error.message);
        } else {
            loadData();
        }
    };

    if (loading) return <LoadingBlock text="Carregando biblioteca multimídia..." />;

    return (
        <div className="animate-slide-up pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                <div className="flex items-center gap-3">
                    <Video className="text-primary" size={32} />
                    <h1 className="stencil-text text-3xl">BIBLIOTECA MULTIMÍDIA</h1>
                </div>
                <VRBadge />
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* LISTA */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <h2 className="stencil-text text-xl">MÍDIAS CADASTRADAS</h2>
                    {media.length === 0 ? (
                        <div className="card p-12 text-center opacity-30 italic font-black text-xs uppercase">
                            Nenhuma mídia educativa encontrada.
                        </div>
                    ) : (
                        media.map(item => (
                            <div key={item.id} className="card border-2 border-foreground bg-white p-6 transition-all hover:translate-x-1">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        {item.kind === 'video' ? <Video className="text-secondary" /> : <Volume2 className="text-secondary" />}
                                        <div>
                                            <h3 className="font-black text-sm uppercase">{item.title}</h3>
                                            <p className="text-[10px] font-mono opacity-50">{item.storage_path}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setEditingId(item.id);
                                                setForm({
                                                    title: item.title,
                                                    slug: item.slug,
                                                    kind: item.kind,
                                                    storage_path: item.storage_path,
                                                    description: item.description || "",
                                                    material: item.material || "",
                                                    flag: item.flag || "",
                                                    transcript_md: item.transcript_md || ""
                                                });
                                            }}
                                            className="cta-button tiny"
                                        >EDITAR</button>
                                        <button onClick={() => handleDelete(item.id)} className="cta-button tiny bg-red-600 text-white border-red-800">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6 text-[10px] font-black uppercase">
                                    <div className="bg-muted/10 p-2 border border-foreground/5">TIPO: {item.kind}</div>
                                    <div className="bg-muted/10 p-2 border border-foreground/5">SLUG: {item.slug}</div>
                                    <div className="bg-muted/10 p-2 border border-foreground/5">MAT: {item.material || 'TODOS'}</div>
                                    <div className="bg-muted/10 p-2 border border-foreground/5">FLAG: {item.flag || 'GERAL'}</div>
                                </div>

                                {item.transcript_md && (
                                    <div className="mb-6 p-4 bg-muted/5 border border-dashed border-foreground/20">
                                        <h4 className="font-black text-[10px] uppercase text-muted mb-2">Transcrição (A40)</h4>
                                        <p className="text-[10px] italic leading-tight opacity-60">{item.transcript_md}</p>
                                    </div>
                                )}

                                <div className="border-t-2 border-dashed border-foreground/10 pt-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-black text-[10px] uppercase text-muted">Vincular a Dica</h4>
                                        <LinkIcon size={12} className="opacity-20" />
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <select
                                            className="field text-[10px] font-bold uppercase py-1 px-2 h-auto"
                                            onChange={(e) => linkTip(item.id, e.target.value)}
                                            defaultValue=""
                                        >
                                            <option value="" disabled>SELECIONE UMA DICA...</option>
                                            {tips.map(t => (
                                                <option key={t.id} value={t.id}>{t.title} ({t.material || 'GERAL'})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* FORM */}
                <aside className="flex flex-col gap-6">
                    <div className="card border-4 border-foreground bg-primary p-6">
                        <h2 className="stencil-text text-xl mb-6 flex items-center gap-2">
                            {editingId ? <Save size={20} /> : <Plus size={20} />}
                            {editingId ? 'EDITAR MÍDIA' : 'NOVA MÍDIA'}
                        </h2>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="font-black text-[10px] uppercase">Título</label>
                                <input
                                    className="field text-xs font-bold uppercase"
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="font-black text-[10px] uppercase">Slug (único)</label>
                                <input
                                    className="field text-xs font-bold"
                                    value={form.slug}
                                    onChange={e => setForm({ ...form, slug: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="font-black text-[10px] uppercase">Tipo</label>
                                <select
                                    className="field text-xs font-bold uppercase"
                                    value={form.kind}
                                    onChange={e => setForm({ ...form, kind: e.target.value })}
                                >
                                    <option value="video">VÍDEO (MICRO-AULA)</option>
                                    <option value="audio">ÁUDIO (DICA)</option>
                                    <option value="image">INFOGRÁFICO</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="font-black text-[10px] uppercase flex justify-between">
                                    Caminho no Storage
                                    <span className="opacity-40 italic">Ex: edu/video.mp4</span>
                                </label>
                                <input
                                    className="field text-xs font-bold"
                                    value={form.storage_path}
                                    onChange={e => setForm({ ...form, storage_path: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="font-black text-[10px] uppercase text-muted">Acesso Privado</label>
                                <div className="p-3 bg-white/50 border-2 border-foreground/10 text-[9px] font-bold uppercase italic leading-tight">
                                    A39: Mídias em bucket privado serão servidas via Signed URL (10 min TTL) e cache A38.
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="font-black text-[10px] uppercase">Material Relacionado</label>
                                <input
                                    className="field text-xs font-bold"
                                    value={form.material}
                                    onChange={e => setForm({ ...form, material: e.target.value })}
                                    placeholder="Ex: plastic, paper"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="font-black text-[10px] uppercase">Flag de Erro (A15)</label>
                                <input
                                    className="field text-xs font-bold"
                                    value={form.flag}
                                    onChange={e => setForm({ ...form, flag: e.target.value })}
                                    placeholder="Ex: contaminated, food"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="font-black text-[10px] uppercase">Transcrição (Acessibilidade)</label>
                                <textarea
                                    className="field text-xs font-bold p-3 min-h-[100px]"
                                    value={form.transcript_md}
                                    onChange={e => setForm({ ...form, transcript_md: e.target.value })}
                                    placeholder="Texto para surdos/ensurdecidos ou ambientes ruidosos..."
                                />
                            </div>

                            <div className="flex gap-2 mt-4">
                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingId(null);
                                            setForm({ title: "", slug: "", kind: "video", storage_path: "", description: "", material: "", flag: "", transcript_md: "" });
                                        }}
                                        className="cta-button grow justify-center border-2 border-foreground bg-white"
                                    >CANCELAR</button>
                                )}
                                <button type="submit" className="cta-button grow justify-center bg-foreground text-white" disabled={isSaving}>
                                    {isSaving ? 'SALVANDO...' : editingId ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR MÍDIA'}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="card bg-white border-2 border-foreground/10 p-6 flex flex-col gap-4">
                        <h3 className="font-black text-[10px] uppercase text-muted flex items-center gap-2">
                            <Check size={14} className="text-green-600" /> REGRAS DE PESO (A39)
                        </h3>
                        <ul className="flex flex-col gap-2">
                            <li className="text-[10px] font-bold uppercase opacity-80">• Vídeos: Max 10MB (recomendado 15-30s)</li>
                            <li className="text-[10px] font-bold uppercase opacity-80">• Áudio: Max 3MB (MP3/AAC)</li>
                            <li className="text-[10px] font-bold uppercase opacity-80">• Imagens: Max 1MB (SVG/WebP)</li>
                        </ul>
                    </div>
                </aside>
            </div>
        </div>
    );
}
