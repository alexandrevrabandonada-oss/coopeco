"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    ChevronLeft,
    CheckCircle2,
    XCircle,
    History,
    AlertTriangle,
    ShieldAlert,
    Zap,
    Save,
    ArrowRight
} from "lucide-react";
import Link from "next/link";

export default function EditorialDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [item, setItem] = useState<any>(null);
    const [versions, setVersions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'review' | 'history'>('review');
    const supabase = createClient();

    useEffect(() => {
        async function loadDetail() {
            setLoading(true);
            const { data } = await supabase.from("eco_editorial_queue").select("*").eq("id", id).single();
            if (data) {
                setItem(data);
                const { data: vData } = await supabase.from("eco_editorial_versions").select("*").eq("queue_id", id).order("version", { ascending: false });
                setVersions(vData || []);
            }
            setLoading(false);
        }
        loadDetail();
    }, [id, supabase]);

    const handleDecision = async (decision: 'approved' | 'rejected') => {
        setSaving(true);
        const notes = window.prompt("Notas da revisão (opcional):") || "";
        const { error } = await supabase.rpc('rpc_submit_editorial_decision', {
            p_queue_id: id,
            p_decision: decision,
            p_notes: notes
        });

        if (!error) {
            setItem({ ...item, status: decision, reviewed_at: new Date().toISOString() });

            // A52: Sync task evidence status
            if (item.source_kind === 'task_evidence') {
                await supabase.from("eco_task_evidence")
                    .update({ status: decision, review_notes: notes })
                    .eq("id", item.source_id);
            }
        }
        setSaving(false);
    };

    if (loading) return <LoadingBlock text="Auditando conteúdo..." />;
    if (!item) return <div className="p-20 text-center font-black uppercase">Item não encontrado na fila.</div>;

    const latestVersion = versions[0];

    return (
        <div className="max-w-5xl mx-auto animate-slide-up pb-20">
            <header className="flex items-center justify-between mb-8 border-b-2 border-foreground pb-4">
                <div className="flex items-center gap-4">
                    <Link href="/admin/editorial" className="p-2 border-2 border-foreground hover:bg-muted/10 transition-colors">
                        <ChevronLeft size={20} />
                    </Link>
                    <div>
                        <span className="text-[10px] font-black uppercase opacity-50">{item.source_kind.replace('_', ' ')} / REVIEW</span>
                        <h1 className="stencil-text text-xl">DETALHE DA REVISÃO</h1>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('review')}
                        className={`px-4 py-2 text-[10px] font-black uppercase border-2 border-foreground ${activeTab === 'review' ? 'bg-foreground text-white' : 'bg-white'}`}
                    >
                        REVISÃO
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 text-[10px] font-black uppercase border-2 border-foreground ${activeTab === 'history' ? 'bg-foreground text-white' : 'bg-white'}`}
                    >
                        HISTÓRICO ({versions.length})
                    </button>
                </div>
            </header>

            {activeTab === 'review' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    <div className="lg:col-span-2 space-y-8">
                        {/* Comparativo / Texto ou Evidência */}
                        {item.source_kind === 'task_evidence' ? (
                            <section className="bg-white border-2 border-foreground p-8">
                                <h2 className="stencil-text text-sm mb-6 border-b border-foreground pb-2 flex justify-between items-center">
                                    <span>EVIDÊNCIA (A52)</span>
                                    <button
                                        onClick={async () => {
                                            const { data: { session } } = await supabase.auth.getSession();
                                            const res = await fetch(`/api/task/evidence/signed-url?evidence_id=${item.source_id}`, {
                                                headers: { "Authorization": `Bearer ${session?.access_token}` }
                                            });
                                            const data = await res.json();
                                            if (data.url) window.open(data.url, "_blank");
                                            else alert(data.error);
                                        }}
                                        className="cta-button tiny flex items-center gap-2"
                                    >VER ARQUIVO SEGURO</button>
                                </h2>
                                <p className="text-xs uppercase font-bold opacity-60">
                                    Esta evidência foi retida por heurísticas de privacidade (possível presença de rostos, documentos, ou metadados).
                                    Verifique o arquivo utilizando a chave temporária acima antes de tomar uma decisão.
                                </p>
                            </section>
                        ) : (
                            <section className="bg-white border-2 border-foreground p-8">
                                <h2 className="stencil-text text-sm mb-6 border-b border-foreground pb-2">CONTEÚDO PARA REVISÃO</h2>
                                <div className="min-h-[200px] font-bold text-sm leading-relaxed whitespace-pre-wrap bg-muted/5 p-4 border border-foreground/10">
                                    {latestVersion?.new_text || "Aguardando versão..."}
                                </div>
                            </section>
                        )}

                        {/* Achados do Lint */}
                        <section>
                            <h3 className="stencil-text text-xs mb-4 uppercase opacity-50 flex items-center gap-2">
                                <Zap size={14} /> ACHADOS DO LINTER ANTI-CULPA
                            </h3>
                            <div className="flex flex-col gap-3">
                                {item.lint_summary?.blockers > 0 && (
                                    <div className="p-4 bg-red-50 border-2 border-red-600 flex gap-4 items-center">
                                        <ShieldAlert className="text-red-600" size={24} />
                                        <div>
                                            <p className="font-black text-[10px] uppercase text-red-600">Bloqueio Crítico ({item.lint_summary.blockers})</p>
                                            <p className="text-[9px] font-bold uppercase opacity-70">Termos punitivos ou identificação de cooperados detectada.</p>
                                        </div>
                                    </div>
                                )}
                                {item.lint_summary?.warns > 0 && (
                                    <div className="p-4 bg-orange-50 border-2 border-orange-500 flex gap-4 items-center">
                                        <AlertTriangle className="text-orange-500" size={24} />
                                        <div>
                                            <p className="font-black text-[10px] uppercase text-orange-600">Aviso de Melhoria ({item.lint_summary.warns})</p>
                                            <p className="text-[9px] font-bold uppercase opacity-70">Sugestões de tom mais inclusivo e anti-culpa disponíveis.</p>
                                        </div>
                                    </div>
                                )}
                                {(!item.lint_summary || (item.lint_summary.blockers === 0 && item.lint_summary.warns === 0)) && (
                                    <div className="p-4 bg-green-50 border-2 border-green-600 flex gap-4 items-center opacity-60">
                                        <CheckCircle2 className="text-green-600" size={24} />
                                        <div>
                                            <p className="font-black text-[10px] uppercase text-green-600">Limpo</p>
                                            <p className="text-[9px] font-bold uppercase opacity-70">Nenhum gatilho de culpa ou PII detectado automaticamente.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    <aside className="space-y-8">
                        <section className="card bg-foreground text-white border-foreground p-6 shadow-[4px_4px_0_0_rgba(0,0,0,1)] flex flex-col gap-6">
                            <h3 className="stencil-text text-sm border-b border-primary/30 pb-2 text-primary">DECISÃO EDITORIAL</h3>

                            <div className="space-y-4">
                                <button
                                    className="cta-button w-full justify-center bg-green-500 text-white disabled:opacity-30"
                                    disabled={saving || item.status === 'approved'}
                                    onClick={() => handleDecision('approved')}
                                >
                                    <CheckCircle2 size={16} /> APROVAR
                                </button>
                                <button
                                    className="cta-button w-full justify-center bg-red-500 text-white disabled:opacity-30"
                                    disabled={saving || item.status === 'rejected'}
                                    onClick={() => handleDecision('rejected')}
                                >
                                    <XCircle size={16} /> REJEITAR
                                </button>
                                {item.status === 'approved' && (
                                    <button
                                        className="cta-button w-full justify-center bg-black text-white disabled:opacity-30"
                                        disabled={saving}
                                        onClick={async () => {
                                            setSaving(true);
                                            const { error } = await supabase.rpc('rpc_publish_from_editorial', { p_queue_id: id });
                                            if (!error) {
                                                setItem({ ...item, status: 'published' });
                                                alert("Publicação realizada com sucesso!");
                                            } else {
                                                alert("Erro na publicação: " + error.message);
                                            }
                                            setSaving(false);
                                        }}
                                    >
                                        <ArrowRight size={16} /> PUBLICAR AGORA
                                    </button>
                                )}
                            </div>

                            <div className="pt-4 border-t border-white/10">
                                <p className="text-[10px] font-black uppercase mb-1 opacity-50">Status Atual</p>
                                <p className="text-xs font-black uppercase text-secondary">{item.status}</p>
                            </div>
                        </section>

                        <section className="card bg-white border-2 border-foreground p-6">
                            <h3 className="stencil-text text-[10px] mb-4 uppercase">METADADOS DO ITEM</h3>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-[8px] font-bold uppercase opacity-50">Solicitado por</p>
                                    <p className="text-[10px] font-black uppercase">{item.requested_by?.split('-')[0]}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] font-bold uppercase opacity-50">Origem</p>
                                    <p className="text-[10px] font-black uppercase">{item.source_kind}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] font-bold uppercase opacity-50">ID da Fonte</p>
                                    <p className="text-[8px] font-mono break-all">{item.source_id}</p>
                                </div>
                            </div>
                        </section>
                    </aside>
                </div>
            ) : (
                <div className="space-y-6">
                    {versions.map((v, i) => (
                        <div key={v.id} className="card bg-white border-2 border-foreground p-6 flex items-start gap-6">
                            <div className="bg-foreground text-white w-10 h-10 flex items-center justify-center stencil-text text-xl shrink-0">
                                v{v.version}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-[10px] font-black uppercase mb-1">Motivo da alteração</p>
                                        <p className="text-sm font-bold opacity-70 italic">"{v.change_reason || 'Sem descrição'}"</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase mb-1">Data</p>
                                        <p className="text-[10px] font-bold opacity-50">{new Date(v.changed_at).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="p-4 bg-muted/5 border border-foreground/5 max-h-[100px] overflow-hidden relative grayscale">
                                    <div className="text-[10px] line-clamp-3 opacity-60">{v.new_text}</div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent" />
                                </div>
                            </div>
                        </div>
                    ))}
                    {versions.length === 0 && (
                        <div className="py-24 text-center border-4 border-dashed border-foreground/10">
                            <History className="mx-auto mb-4 opacity-10" size={64} />
                            <p className="stencil-text text-2xl opacity-20">SEM HISTÓRICO DE VERSÕES</p>
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                .card { border-radius: 0; }
            `}</style>
        </div>
    );
}
