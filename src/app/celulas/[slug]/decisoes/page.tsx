import { createClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { Gavel, ArrowRight, ShieldCheck, MapPin, Calendar } from "lucide-react";
import Link from "next/link";

export default async function CellDecisionsPage({ params }: { params: { slug: string } }) {
    const supabase = createClient();

    const { data: cell } = await supabase
        .from("eco_cells")
        .select("*")
        .eq("slug", params.slug)
        .single();

    if (!cell) notFound();

    const { data: receipts } = await supabase
        .from("eco_cell_decision_receipts")
        .select("*")
        .eq("cell_id", cell.id)
        .eq("is_public", true)
        .order("created_at", { ascending: false });

    return (
        <div className="max-w-4xl mx-auto py-12 px-6 animate-slide-up">
            <header className="mb-12 border-b-4 border-foreground pb-8">
                <div className="flex items-center gap-3 mb-4">
                    <Gavel className="text-primary" size={40} />
                    <h1 className="stencil-text text-5xl leading-none uppercase">DECISÕES DO COMUM</h1>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="bg-foreground text-white px-3 py-1 w-fit stencil-text text-xs tracking-widest uppercase">
                        Célula: {cell.name}
                    </div>
                    <Link href={`/celulas/${params.slug}/carta`} className="text-[10px] font-black uppercase underline hover:text-primary transition-colors">
                        Ver Carta de Princípios
                    </Link>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-6">
                {receipts?.length === 0 ? (
                    <div className="py-24 text-center border-4 border-dashed border-foreground/10 bg-muted/5">
                        <Calendar size={48} className="mx-auto text-muted opacity-20 mb-4" />
                        <h3 className="stencil-text text-xl opacity-40 uppercase">Nenhum recibo público disponível</h3>
                        <p className="text-[10px] font-bold uppercase opacity-30 mt-2">As decisões desta célula ainda estão em processamento ou são de caráter interno.</p>
                    </div>
                ) : (
                    receipts?.map((receipt: any) => (
                        <Link
                            key={receipt.id}
                            href={`/celulas/${params.slug}/decisoes/${receipt.id}`}
                            className="group bg-white border-2 border-foreground/10 hover:border-primary p-6 transition-all hover:shadow-[8px_8px_0_0_rgba(var(--color-primary-rgb),0.1)] block"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-[8px] font-black uppercase px-2 py-0.5 border border-foreground bg-foreground text-white">
                                    Recibo #{receipt.id.split('-')[0]}
                                </span>
                                <span className="text-[10px] font-bold text-muted uppercase">
                                    {new Date(receipt.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <h3 className="stencil-text text-2xl uppercase group-hover:text-primary transition-colors leading-tight mb-2">
                                {receipt.title}
                            </h3>
                            <p className="text-xs font-bold uppercase opacity-60 line-clamp-2 max-w-2xl">
                                {receipt.summary_md}
                            </p>

                            <div className="mt-6 flex items-center justify-between">
                                <div className="flex gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black uppercase opacity-40">Resultado</span>
                                        <span className="text-xs font-black uppercase">{receipt.outcome?.threshold_met ? 'Aprovado' : 'Rejeitado'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black uppercase opacity-40">Quorum</span>
                                        <span className="text-xs font-black uppercase">{receipt.outcome?.total} Votos</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 font-black text-[10px] uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                                    Ver Detalhes <ArrowRight size={14} />
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>

            <aside className="mt-16 p-8 bg-muted/20 border-l-8 border-primary">
                <h3 className="stencil-text text-sm mb-4 uppercase">Por que publicamos isso?</h3>
                <p className="text-[10px] font-bold uppercase leading-relaxed opacity-70 italic max-w-2xl">
                    No ECO, a transparência não é uma "opção", é a base da confiança comum. Publicamos recibos de decisões aprovadas ou rejeitadas para que qualquer pessoa saiba o rumo da célula, mantendo a privacidade individual dos membros enquanto expomos a vontade política do território.
                </p>
            </aside>
        </div>
    );
}
