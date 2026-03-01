import { createClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { Gavel, CheckCircle2, XCircle, Users, ArrowLeft, Vote as VoteIcon, Calendar } from "lucide-react";
import Link from "next/link";

export default async function DecisionDetailPage({ params }: { params: { slug: string, id: string } }) {
    const supabase = createClient();

    const { data: cell } = await supabase
        .from("eco_cells")
        .select("*")
        .eq("slug", params.slug)
        .single();

    if (!cell) notFound();

    const { data: receipt } = await supabase
        .from("eco_cell_decision_receipts")
        .select("*, proposal:eco_cell_proposals(*)")
        .eq("id", params.id)
        .eq("is_public", true)
        .single();

    if (!receipt) notFound();

    const outcome = receipt.outcome || {};
    const isApproved = outcome.threshold_met && outcome.quorum_met;

    return (
        <div className="max-w-3xl mx-auto py-12 px-6 animate-slide-up">
            <header className="mb-8">
                <Link href={`/celulas/${params.slug}/decisoes`} className="flex items-center gap-2 font-black text-[10px] uppercase opacity-40 hover:opacity-100 mb-6 transition-all">
                    <ArrowLeft size={16} /> VOLTAR PARA LISTA
                </Link>
                <div className="flex items-center gap-2 bg-foreground text-white px-2 py-0.5 w-fit stencil-text text-[10px] tracking-widest uppercase mb-4">
                    RECIBO DE DECISÃO #{receipt.id.split('-')[0]}
                </div>
                <h1 className="stencil-text text-4xl uppercase leading-tight mb-4">
                    {receipt.title}
                </h1>
                <div className="flex items-center gap-4 text-[10px] font-black uppercase opacity-60">
                    <span className="flex items-center gap-1"><Calendar size={12} /> Decidido em: {new Date(receipt.created_at).toLocaleDateString()}</span>
                    <span>Célula: {cell.name}</span>
                </div>
            </header>

            <div className="bg-white border-4 border-foreground p-8 md:p-12 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-10">
                <section className="flex flex-col md:flex-row gap-8 items-center justify-between bg-muted/5 p-6 border-2 border-dashed border-foreground/10">
                    <div className="flex flex-col text-center md:text-left">
                        <span className="text-[10px] font-black uppercase opacity-40 mb-1 block">Resultado Final</span>
                        <div className="flex items-center gap-3">
                            {isApproved ? (
                                <>
                                    <CheckCircle2 size={32} className="text-primary" />
                                    <span className="stencil-text text-3xl text-primary">APROVADO</span>
                                </>
                            ) : (
                                <>
                                    <XCircle size={32} className="text-red-600" />
                                    <span className="stencil-text text-3xl text-red-600">REJEITADO</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-8">
                        <div className="text-center">
                            <span className="text-[10px] font-black uppercase opacity-40 mb-1 block">Votos Sim</span>
                            <span className="text-2xl font-black">{outcome.yes || 0}</span>
                        </div>
                        <div className="text-center">
                            <span className="text-[10px] font-black uppercase opacity-40 mb-1 block">Votos Não</span>
                            <span className="text-2xl font-black">{outcome.no || 0}</span>
                        </div>
                        <div className="text-center">
                            <span className="text-[10px] font-black uppercase opacity-40 mb-1 block">Abstenções</span>
                            <span className="text-2xl font-black">{outcome.abstain || 0}</span>
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="stencil-text text-xl mb-4 text-secondary uppercase">RESUMO DA PROPOSTA</h2>
                    <div className="prose prose-sm max-w-none font-bold text-sm uppercase leading-relaxed whitespace-pre-wrap italic opacity-80">
                        {receipt.summary_md}
                    </div>
                    {receipt.proposal?.body_md && receipt.proposal.body_md !== receipt.summary_md && (
                        <div className="mt-8 pt-8 border-t border-muted">
                            <h3 className="text-[10px] font-black uppercase opacity-40 mb-4">Texto Original Completo</h3>
                            <div className="prose prose-sm max-w-none text-xs whitespace-pre-wrap font-medium">
                                {receipt.proposal.body_md}
                            </div>
                        </div>
                    )}
                </section>

                <section className="bg-foreground text-white p-6">
                    <h2 className="stencil-text text-sm mb-4 text-primary uppercase flex items-center gap-2">
                        <Users size={16} /> VALIDAÇÃO DO PROCESSO
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <span className="text-[8px] font-black uppercase opacity-60 block">Quorum Total</span>
                            <p className="text-sm font-black">{outcome.total || 0} membros</p>
                        </div>
                        <div>
                            <span className="text-[8px] font-black uppercase opacity-60 block">Quorum Mínimo</span>
                            <p className="text-sm font-black">{receipt.proposal?.quorum_min || 3} membros</p>
                        </div>
                        <div>
                            <span className="text-[8px] font-black uppercase opacity-60 block">Aprovação</span>
                            <p className="text-sm font-black">
                                {outcome.total > 0 ? Math.round((outcome.yes / outcome.total) * 100) : 0}%
                            </p>
                        </div>
                        <div>
                            <span className="text-[8px] font-black uppercase opacity-60 block">Threshold</span>
                            <p className="text-sm font-black">{receipt.proposal?.approval_threshold_pct || 60}%</p>
                        </div>
                    </div>
                </section>

                <footer className="pt-8 border-t-2 border-dashed border-foreground/20 text-center">
                    <p className="text-[8px] font-bold uppercase opacity-40 italic">
                        Este recibo é um documento de prova pública de decisão autogestionada.
                        <br />
                        As identidades dos votantes são preservadas para evitar captura político-social.
                    </p>
                </footer>
            </div>
        </div>
    );
}
