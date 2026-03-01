import { createClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { ScrollText, ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function CellCharterPage({ params }: { params: { slug: string } }) {
    const supabase = createClient();

    const { data: cell } = await supabase
        .from("eco_cells")
        .select("*")
        .eq("slug", params.slug)
        .single();

    if (!cell) notFound();

    const { data: charter } = await supabase
        .from("eco_cell_charters")
        .select("*")
        .eq("cell_id", cell.id)
        .single();

    return (
        <div className="max-w-4xl mx-auto py-12 px-6 animate-slide-up">
            <header className="mb-12">
                <Link href={`/celulas/${params.slug}/decisoes`} className="flex items-center gap-2 font-black text-[10px] uppercase opacity-40 hover:opacity-100 mb-4 transition-all">
                    <ArrowLeft size={14} /> VER DECISÕES
                </Link>
                <div className="flex items-center gap-3 mb-4">
                    <ShieldCheck className="text-primary" size={40} />
                    <h1 className="stencil-text text-5xl leading-none">CARTA DE PRINCÍPIOS</h1>
                </div>
                <div className="bg-foreground text-white px-3 py-1 w-fit stencil-text text-xs tracking-widest uppercase">
                    Célula: {cell.name} • v{charter?.version || '0.1'}
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <main className="md:col-span-2 flex flex-col gap-12">
                    <section className="bg-white border-2 border-foreground p-8">
                        <h2 className="stencil-text text-xl mb-6 text-secondary flex items-center gap-2">
                            <ScrollText size={20} /> PRINCÍPIOS DO COMUM
                        </h2>
                        <div className="prose prose-sm max-w-none whitespace-pre-wrap font-bold text-sm uppercase leading-relaxed">
                            {charter?.principles_md || "Aguardando definição coletiva dos princípios da célula."}
                        </div>
                    </section>

                    <section className="bg-muted/10 border-2 border-dashed border-foreground/20 p-8">
                        <h2 className="stencil-text text-lg mb-6 flex items-center gap-2 opacity-60">
                            PROCESSO DECISÓRIO
                        </h2>
                        <div className="prose prose-sm max-w-none whitespace-pre-wrap font-bold text-xs uppercase opacity-70">
                            {charter?.decision_process_md || "Aguardando detalhamento do processo decisório (Quórum, Prazos)."}
                        </div>
                    </section>
                </main>

                <aside className="flex flex-col gap-6">
                    <div className="card bg-foreground text-white border-foreground p-6 shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
                        <h3 className="stencil-text text-sm mb-4 text-primary uppercase">O que é isso?</h3>
                        <p className="text-[10px] font-bold uppercase leading-relaxed opacity-80">
                            Esta é a carta de princípios que governa a operação autônoma desta célula do ECO.
                            <br /><br />
                            Aqui definimos como as decisões são tomadas, quem são os responsáveis temporários e quais os valores que protegem o nosso trabalho.
                        </p>
                    </div>

                    <div className="p-4 border border-foreground/10 text-center">
                        <p className="text-[8px] font-black uppercase opacity-40">
                            Última atualização: {charter?.updated_at ? new Date(charter.updated_at).toLocaleDateString() : 'N/A'}
                        </p>
                    </div>
                </aside>
            </div>

            <footer className="mt-20 pt-10 border-t border-foreground/10 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 italic">
                    ECO SOFTWARE v2.9 — DECENTRALIZED GOVERNANCE MODULE
                </p>
            </footer>
        </div>
    );
}
