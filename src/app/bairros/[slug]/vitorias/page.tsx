import { createClient } from "@supabase/supabase-js";
import {
    Trophy,
    Leaf,
    CheckCircle2,
    Users,
    TrendingUp,
    ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 3600; // Cache for 1 hour

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

export default async function PublicCollectiveWinsPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    // 1. Get neighborhood + cell
    const { data: nData } = await supabase
        .from("neighborhoods")
        .select("*, eco_cells(name)")
        .eq("slug", slug)
        .single();

    if (!nData) notFound();

    // 2. Load last 8 weeks of published collective wins (A53)
    const { data: wins } = await supabase
        .from("v_collective_wins_public")
        .select("*")
        .eq("neighborhood_id", nData.id)
        .order("week_start", { ascending: false })
        .limit(8);

    // Se a query pro bairro tiver vazia, vamos checar as genéricas da célula vinculada
    let finalWins = wins || [];
    if (finalWins.length === 0 && nData.cell_id) {
        const { data: cellWins } = await supabase
            .from("v_collective_wins_public")
            .select("*")
            .eq("cell_id", nData.cell_id)
            .is("neighborhood_id", null)
            .order("week_start", { ascending: false })
            .limit(8);
        finalWins = cellWins || [];
    }

    return (
        <div className="bg-[#f4f1ea] min-h-screen text-foreground pb-20">
            {/* Header */}
            <header className="bg-foreground text-white pt-16 pb-12 px-6 shadow-[0_8px_0_0_rgba(255,193,7,1)]">
                <div className="max-w-4xl mx-auto flex items-center gap-6">
                    <div className="p-4 bg-primary text-black rounded-sm shadow-[4px_4px_0_0_rgba(255,255,255,0.2)]">
                        <Trophy size={48} />
                    </div>
                    <div>
                        <Link href={`/bairros/${slug}`} className="text-[10px] font-black uppercase text-secondary hover:text-white transition-colors flex items-center gap-1 mb-2">
                            ← Bairro {nData.name}
                        </Link>
                        <h1 className="stencil-text text-5xl md:text-6xl uppercase tracking-tighter">VITÓRIAS DO COMUM</h1>
                        <p className="text-sm font-bold opacity-80 mt-2 max-w-xl">
                            Nosso reconhecimento da força coletiva. Não focamos em quem fez mais, mas no que conquistamos juntos cuidando da nossa terra. (A53)
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 mt-16 space-y-12">
                {finalWins.length === 0 ? (
                    <div className="text-center py-20 border-4 border-dashed border-foreground/10 opacity-40">
                        <ShieldCheck size={64} className="mx-auto mb-4" />
                        <h2 className="stencil-text text-2xl uppercase">INICIANDO A REGISTRO COLETIVO</h2>
                        <p className="text-xs font-bold uppercase tracking-widest mt-2">EM BREVE, A PRIMEIRA VITÓRIA SERÁ PUBLICADA.</p>
                    </div>
                ) : (
                    finalWins.map((win) => (
                        <article key={win.id} className="bg-white border-4 border-foreground shadow-[8px_8px_0_0_rgba(0,0,0,1)] flex flex-col md:flex-row group transition-all">
                            {/* Meta Column */}
                            <div className="bg-foreground text-white p-6 md:w-64 flex flex-col justify-between items-start">
                                <div>
                                    <span className="bg-primary text-black px-2 py-1 text-[10px] font-black uppercase shadow-[2px_2px_0_0_rgba(255,255,255,0.2)]">SEMANA</span>
                                    <h3 className="stencil-text text-3xl mt-4 leading-none">
                                        {new Date(win.week_start).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase()}
                                    </h3>
                                    <p className="text-[10px] font-black uppercase opacity-50 mt-1 flex items-center gap-1">
                                        <Leaf size={10} /> Célula {nData.eco_cells?.name || 'Local'}
                                    </p>
                                </div>

                                <div className="mt-8 space-y-4 w-full">
                                    <div className="flex justify-between items-center border-b border-white/20 pb-2">
                                        <span className="text-[9px] font-black uppercase opacity-60 flex items-center gap-1"><Users size={12} /> TAREFAS DA SEMANA</span>
                                        <span className="font-bold">{win.highlights?.tasks_done_count || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-white/20 pb-2">
                                        <span className="text-[9px] font-black uppercase opacity-60 flex items-center gap-1"><CheckCircle2 size={12} /> TAXA DE QUALIDADE</span>
                                        <span className="font-bold">{win.highlights?.ok_rate || 0}%</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-black uppercase opacity-60 flex items-center gap-1"><TrendingUp size={12} /> VOLUMES DESTINADOS</span>
                                        <span className="font-bold">{win.highlights?.receipts_count || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Content Column */}
                            <div className="p-8 flex-1">
                                <h2 className="stencil-text text-3xl uppercase text-foreground leading-tight mb-6">
                                    {win.title}
                                </h2>
                                <div className="prose max-w-none text-foreground/80 font-bold leading-relaxed whitespace-pre-wrap">
                                    {win.body_md}
                                </div>
                                {win.highlights?.evidence_approved_count > 0 && (
                                    <div className="mt-6 inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 border-2 border-green-600 text-[10px] font-black uppercase">
                                        <ShieldCheck size={14} /> {win.highlights.evidence_approved_count} COMPROVANTES ENVIADOS PELA COMUNIDADE VERIFICADOS
                                    </div>
                                )}
                            </div>
                        </article>
                    ))
                )}
            </main>
        </div>
    );
}
