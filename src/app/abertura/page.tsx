import { createClient } from "@/lib/supabase";
import { Waves, ShieldCheck, MapPin, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 600; // 10 minutes

export default async function PublicExpansionCorridorPage() {
    const supabase = createClient();

    // Fetch active corridors and their active/queued neighborhoods
    const { data: corridors } = await supabase
        .from("eco_launch_corridors")
        .select("id, title, eco_cells(name), eco_corridor_neighborhoods(status, opened_at, neighborhood:neighborhoods(name))")
        .eq("status", "active")
        .order("created_at", { ascending: false });

    return (
        <div className="bg-[#f4f1ea] min-h-screen text-foreground pb-20">
            <header className="bg-foreground text-white pt-16 pb-12 px-6 shadow-[0_8px_0_0_rgba(255,193,7,1)]">
                <div className="max-w-4xl mx-auto flex items-center gap-6">
                    <div className="p-4 bg-primary text-black rounded-sm shadow-[4px_4px_0_0_rgba(255,255,255,0.2)]">
                        <Waves size={48} />
                    </div>
                    <div>
                        <h1 className="stencil-text text-4xl md:text-5xl uppercase tracking-tighter">ABERTURA POR ETAPAS</h1>
                        <p className="text-sm font-bold opacity-80 mt-2 max-w-xl">
                            Crescemos em segurança. Nosso serviço expande bairro a bairro formando um "corredor", garantindo que a qualidade do trabalho da base seja 100% protegida. (A59)
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 mt-16 space-y-12">
                <section className="bg-white border-4 border-foreground shadow-[8px_8px_0_0_rgba(0,0,0,1)] p-8 md:p-12">
                    <h2 className="stencil-text text-2xl mb-6 flex items-center gap-3">
                        <ShieldCheck className="text-primary" /> COMO DECIDIMOS CRESCER
                    </h2>
                    <div className="prose max-w-none text-foreground/80 font-bold leading-relaxed text-sm">
                        <p>Diferente de grandes empresas que abrem as portas para o mundo inteiro num dia e colapsam o trabalhador na ponta da linha (entregadores, motoristas, coletores), nós escolhemos o caminho do <b>Comum</b>.</p>
                        <p>O aplicativo ECO trava sua própria expansão se os nossos indicadores de <strong>Saúde Operacional</strong> não estiverem acima de 80% nos últimos 14 dias.</p>
                        <p className="text-secondary uppercase select-none mt-4 text-[10px] tracking-widest font-black">Só abrimos seu bairro quando os anteriores dão conta de respirar.</p>
                    </div>
                </section>

                <section>
                    <h2 className="stencil-text text-3xl mb-6">FRENTES DE EXPANSÃO</h2>
                    {(!corridors || corridors.length === 0) ? (
                        <div className="text-center py-12 border-4 border-dashed border-foreground/10 opacity-40 font-bold uppercase">
                            NENHUMA FRENTE DE EXPANSÃO ABERTA NO MOMENTO. O PILOTO ESTÁ FECHADO.
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {corridors.map(corridor => {
                                const neighborhoodsList = corridor.eco_corridor_neighborhoods || [];
                                const activeList = neighborhoodsList.filter((n: any) => n.status !== 'queued' && n.status !== 'paused');
                                const queuedList = neighborhoodsList.filter((n: any) => n.status === 'queued');

                                return (
                                    <div key={corridor.id} className="bg-white border-4 border-foreground shadow-[6px_6px_0_0_rgba(0,0,0,1)] flex flex-col">
                                        <div className="bg-foreground text-white p-6 border-b-4 border-primary">
                                            <span className="text-[10px] font-black uppercase opacity-60 bg-white/20 px-2 py-1 mb-2 inline-block">CÉLULA: {(corridor.eco_cells as any)?.name}</span>
                                            <h3 className="stencil-text text-2xl leading-none">{corridor.title}</h3>
                                        </div>
                                        <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">

                                            {/* ACTIVE */}
                                            <div className="flex-1">
                                                <h4 className="font-black text-xs uppercase text-primary mb-4 flex items-center gap-2">
                                                    <span className="relative flex h-3 w-3">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                                    </span>
                                                    TERRITÓRIOS ABERTOS
                                                </h4>
                                                <ul className="space-y-3">
                                                    {activeList.map((n: any, idx: number) => (
                                                        <li key={idx} className="flex items-center justify-between p-3 bg-primary/10 border-l-4 border-primary">
                                                            <span className="font-bold uppercase text-sm">{n.neighborhood?.name}</span>
                                                            <span className="text-[9px] font-black uppercase opacity-50 bg-black/5 px-2 py-1">{n.status.replace("_", " ")}</span>
                                                        </li>
                                                    ))}
                                                    {activeList.length === 0 && <li className="text-xs font-bold opacity-50 italic">Nenhum bairro liberado nesta frente ainda.</li>}
                                                </ul>
                                            </div>

                                            {/* QUEUED */}
                                            <div className="flex-1 border-t-2 md:border-t-0 md:border-l-2 border-foreground/10 pt-6 md:pt-0 md:pl-8">
                                                <h4 className="font-black text-xs uppercase opacity-50 mb-4 flex items-center gap-2">
                                                    PRÓXIMOS DA FILA
                                                </h4>
                                                <div className="space-y-3 relative">
                                                    <div className="absolute left-[15px] top-6 bottom-4 w-px bg-foreground/20 z-0"></div>
                                                    {queuedList.map((n: any, idx: number) => (
                                                        <div key={idx} className="relative z-10 flex items-center gap-4 group">
                                                            <div className="w-[30px] h-[30px] rounded-full bg-muted border-2 border-foreground text-xs font-black flex items-center justify-center">
                                                                {idx + 1}
                                                            </div>
                                                            <span className="font-bold text-sm uppercase opacity-40 group-hover:opacity-100 transition-opacity">{n.neighborhood?.name}</span>
                                                        </div>
                                                    ))}
                                                    {queuedList.length === 0 && <span className="text-xs font-bold opacity-50 italic">Fila esgotada ou não definida.</span>}
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <div className="pt-12 text-center">
                    <Link href="/comecar" className="cta-button inline-flex">
                        <MapPin size={20} /> QUERO CUIDAR DO MEU BAIRRO
                    </Link>
                </div>
            </main>
        </div>
    );
}
