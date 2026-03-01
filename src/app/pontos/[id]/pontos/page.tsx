import { createClient } from "@supabase/supabase-js";
import {
    Coins,
    MapPin,
    Info,
    Scale
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 600; // 10 min cache

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

export default async function DropPointPointsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // 1. Get Drop Point Info
    const { data: point } = await supabase
        .from("eco_drop_points")
        .select("id, name, cell_id, neighborhood_id, status")
        .eq("id", id)
        .single();

    if (!point || point.status !== 'active') notFound();

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
        .eq("drop_point_id", point.id)
        .eq("scope", "drop_point")
        .single();

    const currentPoints = balanceRecord?.points_balance || 0;
    const recentDelta = balanceRecord?.last_30d_delta || 0;

    // 4. Get Active Catalog (Point specific or Cell fallback)
    const { data: catalog } = await supabase
        .from("eco_reward_catalog")
        .select("*")
        .eq("cell_id", point.cell_id)
        .or(`drop_point_id.eq.${id},scope.in.('cell','neighborhood')`)
        .eq("status", "active")
        .order("cost_points", { ascending: true });

    return (
        <div className="bg-[#f4f1ea] min-h-screen text-foreground pb-20">
            <header className="bg-foreground text-white pt-16 pb-12 px-6 shadow-[0_8px_0_0_rgba(255,193,7,1)]">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-primary text-black rounded-sm shadow-[4px_4px_0_0_rgba(255,255,255,0.2)]">
                            <Coins size={48} />
                        </div>
                        <div>
                            <Link href={`/pontos`} className="text-[10px] font-black uppercase text-secondary hover:text-white transition-colors flex items-center gap-1 mb-2">
                                ← VOLTAR PARA MAPA
                            </Link>
                            <h1 className="stencil-text text-4xl md:text-5xl uppercase tracking-tighter">ESTAÇÃO {point.name}</h1>
                            <p className="text-sm font-bold opacity-80 mt-2 max-w-xl">
                                Cofrinho Coletivo deste Ponto de Entrega (A55).
                            </p>
                        </div>
                    </div>

                    <div className="text-right border-l-4 border-primary pl-6">
                        <div className="text-[10px] font-black uppercase opacity-60 mb-1">SALDO DO PONTO</div>
                        <div className="stencil-text text-6xl text-white drop-shadow-[2px_2px_0_rgba(255,193,7,1)]">
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
                        <Info className="text-primary" /> MICRO-TERRITÓRIO FECHADO
                    </h2>
                    <div className="prose max-w-none text-sm text-foreground/80 font-bold leading-relaxed space-y-4">
                        <p>Muitas pessoas usam este contêiner. O comportamento <strong>médio</strong> de todos impacta o saldo desta lixeira. Recebimentos 100% corretos geram {rules?.points_per_receipt_ok} pts, já lixo comum atirado recua {rules?.points_penalty_contaminated} pts. <b>Eles podem comprar melhorias diretas para este mesmo ponto.</b></p>
                    </div>
                </section>

                <section>
                    <h2 className="stencil-text text-3xl mb-6">CATÁLOGO DE TROCAS (GERAL + PONTO)</h2>
                    {(!catalog || catalog.length === 0) ? (
                        <div className="text-center py-12 border-4 border-dashed border-foreground/10 opacity-40 font-bold">
                            NENHUMA TROCA CADASTRADA.
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
                                        {c.drop_point_id === point.id && (
                                            <div className="absolute -top-3 -left-3 bg-black text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rotate-[-3deg]">
                                                EXCLUSIVO DESTE PONTO
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
            </main>
        </div>
    );
}
