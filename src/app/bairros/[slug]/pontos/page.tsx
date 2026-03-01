import { createClient } from "@supabase/supabase-js";
import {
    Coins,
    Leaf,
    Users,
    Gift,
    Scale,
    Trophy,
    Info
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 600; // 10 min cache

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

export default async function NeighborhoodPointsPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    // 1. Get Neighborhood Info
    const { data: neighborhood } = await supabase
        .from("neighborhoods")
        .select("id, name, eco_cells(id, name, slug)")
        .eq("slug", slug)
        .single();

    if (!neighborhood) notFound();

    // 2. Get Rules v1.0
    const { data: rules } = await supabase
        .from("eco_reward_rules")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    // 3. Get Points Balance
    const { data: balanceRecord } = await supabase
        .from("v_collective_points_balance")
        .select("*")
        .eq("neighborhood_id", neighborhood.id)
        .eq("scope", "neighborhood")
        .single();

    const currentPoints = balanceRecord?.points_balance || 0;
    const recentDelta = balanceRecord?.last_30d_delta || 0;

    const cellId = Array.isArray(neighborhood.eco_cells)
        ? neighborhood.eco_cells[0]?.id
        : (neighborhood.eco_cells as any)?.id;

    // 4. Get Active Catalog
    const { data: catalog } = await supabase
        .from("eco_reward_catalog")
        .select("*")
        .eq("cell_id", cellId)
        .is("drop_point_id", null) // neighborhood or cell scope
        .eq("status", "active")
        .order("cost_points", { ascending: true });

    return (
        <div className="bg-[#f4f1ea] min-h-screen text-foreground pb-20">
            <header className="bg-foreground text-white pt-16 pb-12 px-6 shadow-[0_8px_0_0_rgba(255,193,7,1)]">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-secondary text-white rounded-sm shadow-[4px_4px_0_0_rgba(255,255,255,0.2)]">
                            <Coins size={48} />
                        </div>
                        <div>
                            <Link href={`/bairros/${slug}`} className="text-[10px] font-black uppercase text-secondary hover:text-white transition-colors flex items-center gap-1 mb-2">
                                ← VOLTAR PARA {neighborhood.name}
                            </Link>
                            <h1 className="stencil-text text-4xl md:text-5xl uppercase tracking-tighter">PONTOS DO COMUM</h1>
                            <p className="text-sm font-bold opacity-80 mt-2 max-w-xl">
                                Esforço Coletivo do Bairro {neighborhood.name} (A55).
                            </p>
                        </div>
                    </div>

                    <div className="text-right border-l-4 border-secondary pl-6">
                        <div className="text-[10px] font-black uppercase opacity-60 mb-1">SALDO COLETIVO</div>
                        <div className="stencil-text text-6xl text-primary drop-shadow-[2px_2px_0_rgba(0,0,0,1)]">
                            {currentPoints}
                        </div>
                        <div className="text-xs font-bold mt-1 text-green-400">
                            {recentDelta >= 0 ? '+' : ''}{recentDelta} Pts nos últimos 30d
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 mt-16 space-y-12">
                <section className="bg-white border-4 border-foreground shadow-[8px_8px_0_0_rgba(0,0,0,1)] p-8">
                    <h2 className="stencil-text text-2xl mb-4 flex items-center gap-3">
                        <Info className="text-primary" /> COMO FUNCIONA (S/ RANKINGS)
                    </h2>
                    <div className="prose max-w-none text-sm text-foreground/80 font-bold leading-relaxed space-y-4">
                        <p>{rules?.rules_md || "A pontuação é coletiva e protege o esforço do território inteiro."}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            <div className="bg-muted/10 p-4 border-2 border-dashed border-foreground/20">
                                <h4 className="font-black text-xs uppercase mb-2">GERA PONTOS (+)</h4>
                                <ul className="list-disc pl-4 opacity-80 space-y-1">
                                    <li>Recibos Limpos (Qualidade OK): <strong>+{rules?.points_per_receipt_ok} pts</strong></li>
                                    <li>Recibos c/ Atenção: <strong>+{rules?.points_per_receipt_attention} pts</strong></li>
                                    <li>Tarefas do Comum Feitas: <strong>+{rules?.points_per_task_done} pts</strong></li>
                                    <li>Âncoras (Semanal): <strong>+{rules?.points_bonus_anchor_week} pts</strong></li>
                                </ul>
                            </div>
                            <div className="bg-red-50 p-4 border-2 border-dashed border-red-200">
                                <h4 className="font-black text-xs uppercase text-red-800 mb-2">PERDE PONTOS (-)</h4>
                                <ul className="list-disc pl-4 opacity-80 space-y-1 text-red-900">
                                    <li>Recibos Contaminados (Trabalho Perdido): <strong>{rules?.points_penalty_contaminated} pts</strong></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="stencil-text text-3xl mb-6">CATÁLOGO DE TROCAS</h2>
                    {(!catalog || catalog.length === 0) ? (
                        <div className="text-center py-12 border-4 border-dashed border-foreground/10 opacity-40 font-bold">
                            NENHUMA TROCA CADASTRADA NESTA CÉLULA AINDA.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {catalog.map((c: any) => {
                                const affordable = currentPoints >= c.cost_points;
                                const progress = Math.min((currentPoints / c.cost_points) * 100, 100);

                                return (
                                    <div key={c.id} className="relative bg-white border-4 border-foreground p-6 flex flex-col justify-between shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
                                        {affordable && (
                                            <div className="absolute -top-3 -right-3 bg-secondary text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 border-2 border-foreground shadow-[2px_2px_0_0_rgba(0,0,0,1)] rotate-3">
                                                ALCUNÇADO!
                                            </div>
                                        )}
                                        <div>
                                            <div className="flex justify-between items-start gap-4 mb-3">
                                                <h3 className="stencil-text text-xl">{c.title}</h3>
                                                <span className="stencil-text text-xl text-primary">{c.cost_points}</span>
                                            </div>
                                            <p className="text-xs font-bold opacity-70 mb-6 min-h-[40px]">{c.description_md}</p>
                                        </div>

                                        <div className="mt-auto space-y-3 border-t-2 border-foreground/10 pt-4">
                                            <div className="w-full bg-muted/20 h-2 border border-foreground/20 overflow-hidden">
                                                <div className="bg-primary h-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                                            </div>

                                            <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                                <span className="opacity-50">{progress.toFixed(0)}% OBTIDO</span>
                                                {c.needs_governance && (
                                                    <span className="flex items-center gap-1 text-accent opacity-80" title="Requer validação em assembleia após alcançado">
                                                        <Scale size={12} /> ASSEMBLÉIA
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </section>

                <div className="pt-8 text-center border-t-4 border-foreground/20">
                    <p className="text-xs font-bold uppercase opacity-60 mb-4">Gostaria de ver sua rua sugerindo uma troca diferente?</p>
                    <Link href="/admin/governance/propor" className="cta-button border-4 bg-white text-black hover:bg-black hover:text-white inline-flex">
                        <Scale size={16} /> SUGERIR RECOMPENSA (PROPOSTA)
                    </Link>
                </div>
            </main>
        </div>
    );
}
