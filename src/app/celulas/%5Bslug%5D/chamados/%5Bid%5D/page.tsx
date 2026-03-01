"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    ChevronLeft,
    Calendar,
    Zap,
    Heart,
    AlertTriangle,
    ShieldCheck,
    CheckCircle2,
    Send,
    MapPin
} from "lucide-react";
import Link from "next/link";
import ReactMarkdown from 'react-markdown';

export default function CallDetail({ params }: { params: Promise<{ slug: string, id: string }> }) {
    const { slug, id } = use(params);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [call, setCall] = useState<any>(null);
    const [interest, setInterest] = useState<any>(null);
    const [message, setMessage] = useState("");
    const [user, setUser] = useState<any>(null);
    const supabase = createClient();

    useEffect(() => {
        async function loadDetail() {
            setLoading(true);
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            setUser(currentUser);

            const { data: callData } = await supabase
                .from("eco_calls")
                .select("*, cell:eco_cells(name, slug), neighborhood:neighborhoods(name)")
                .eq("id", id)
                .single();

            if (callData) {
                setCall(callData);
                if (currentUser) {
                    const { data: iData } = await supabase
                        .from("eco_call_interests")
                        .select("*")
                        .eq("call_id", id)
                        .eq("user_id", currentUser.id)
                        .maybeSingle();
                    setInterest(iData);
                }
            }
            setLoading(false);
        }
        loadDetail();
    }, [id, supabase]);

    const handleInterest = async () => {
        if (!user) {
            alert("Você precisa estar logado para manifestar interesse.");
            return;
        }

        setSaving(true);
        const { error } = await supabase.from("eco_call_interests").insert({
            call_id: id,
            user_id: user.id,
            message: message.slice(0, 200)
        });

        if (!error) {
            setInterest({ status: 'pending' });
            alert("Interesse enviado! Os coordenadores da célula entrarão em contato se necessário.");
        } else {
            alert("Erro ao enviar interesse: " + error.message);
        }
        setSaving(false);
    };

    if (loading) return <LoadingBlock text="Abrindo chamado do comum..." />;
    if (!call) return <div className="p-20 text-center font-black uppercase">Chamado não encontrado.</div>;

    return (
        <div className="max-w-4xl mx-auto animate-slide-up pb-20">
            <header className="flex items-center gap-4 mb-12 border-b-2 border-foreground pb-4">
                <Link href={`/celulas/${slug}/chamados`} className="p-2 border-2 border-foreground hover:bg-muted/10 transition-colors">
                    <ChevronLeft size={20} />
                </Link>
                <div>
                    <span className="text-[10px] font-black uppercase opacity-50">CÉLULA {call.cell?.name} / CHAMADO DO COMUM</span>
                    <h1 className="stencil-text text-2xl uppercase tracking-tighter">{call.kind.replace('_', ' ')}</h1>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-8">
                    <section className="bg-white border-4 border-foreground p-8 shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
                        <div className="flex justify-between items-start mb-6 border-b border-foreground/10 pb-4">
                            <h2 className="stencil-text text-3xl uppercase leading-tight">{call.title}</h2>
                            {call.urgency === 'high' && (
                                <span className="px-3 py-1 bg-red-600 text-white font-black text-[10px] uppercase flex items-center gap-1 shrink-0">
                                    <AlertTriangle size={12} /> URGENTE
                                </span>
                            )}
                        </div>

                        <div className="prose prose-sm max-w-none font-bold text-foreground/80 leading-relaxed">
                            <ReactMarkdown>{call.body_md}</ReactMarkdown>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="stencil-text text-xs uppercase opacity-50 flex items-center gap-2 tracking-widest">
                            <Zap size={14} /> COMPETÊNCIAS SUGERIDAS
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {call.skill_slugs?.map((s: string) => (
                                <span key={s} className="px-3 py-1 bg-foreground text-white text-[10px] font-black uppercase tracking-widest">{s}</span>
                            ))}
                            {(!call.skill_slugs || call.skill_slugs.length === 0) && <span className="text-xs font-bold italic opacity-40">Aberto a qualquer talento.</span>}
                        </div>
                    </section>
                </div>

                <aside className="space-y-8">
                    <div className="card bg-foreground text-white p-8 border-foreground sticky top-8 flex flex-col gap-6">
                        <h3 className="stencil-text text-sm border-b border-primary/30 pb-2 text-primary uppercase">TENHO INTERESSE</h3>

                        {!interest ? (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase opacity-50">Breve mensagem (opcional)</label>
                                    <textarea
                                        className="w-full bg-white/5 border border-white/20 p-3 text-xs font-bold text-white resize-none"
                                        placeholder="Ex: Já organizei mutirões antes..."
                                        rows={3}
                                        maxLength={200}
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                    />
                                    <p className="text-[8px] opacity-40 text-right uppercase font-black">{message.length}/200</p>
                                </div>

                                <button
                                    className="cta-button w-full justify-center bg-primary text-foreground disabled:opacity-30"
                                    onClick={handleInterest}
                                    disabled={saving}
                                >
                                    <Heart size={16} /> {saving ? "ENVIANDO..." : "MANIFESTAR INTERESSE"}
                                </button>

                                <p className="text-[9px] font-bold opacity-40 text-center uppercase leading-tight italic">
                                    Seus dados de contato não serão expostos. A célula entrará em contato via canais internos.
                                </p>
                            </div>
                        ) : (
                            <div className="text-center py-10 space-y-4 animate-slide-up">
                                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto border-2 border-primary border-dashed">
                                    <CheckCircle2 size={32} className="text-primary" />
                                </div>
                                <h4 className="stencil-text text-lg text-primary">INTERESSE REGISTRADO</h4>
                                <p className="text-[10px] uppercase font-bold opacity-60">Status: {interest.status}</p>
                                <p className="text-xs">Aguarde o contato da coordenação da célula. Obrigado pela ajuda mútua!</p>
                            </div>
                        )}
                    </div>

                    <div className="card bg-white border-2 border-foreground p-6">
                        <h3 className="stencil-text text-[10px] mb-4 uppercase opacity-50">Local de Atuação</h3>
                        <div className="flex items-center gap-3">
                            <MapPin size={24} className="text-secondary" />
                            <div>
                                <p className="text-xs font-black uppercase">{call.neighborhood?.name || 'Toda a Célula'}</p>
                                <p className="text-[10px] font-bold opacity-50">CÉLULA {call.cell?.name}</p>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>

            <style jsx>{`
                .card { border-radius: 0; }
            `}</style>
        </div>
    );
}
