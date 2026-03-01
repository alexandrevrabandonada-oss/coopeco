"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import { Share2, Clock, MapPin, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function CardsClient({ slug }: { slug: string }) {
    const [exports, setExports] = useState<any[]>([]);
    const [neighborhood, setNeighborhood] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function loadData() {
            const { data: nData } = await supabase
                .from("neighborhoods")
                .select("*")
                .eq("slug", slug)
                .single();

            if (nData) {
                setNeighborhood(nData);
                const { data: eData } = await supabase
                    .from("comm_exports")
                    .select("*, profile:profiles(display_name)")
                    .eq("neighborhood_id", nData.id)
                    .order("created_at", { ascending: false })
                    .limit(20);
                setExports(eData || []);
            }
            setLoading(false);
        }
        loadData();
    }, [slug, supabase]);

    if (loading) return <LoadingBlock text="Carregando cartões..." />;
    if (!neighborhood) return <div className="p-8 text-center uppercase font-black">Bairro não encontrado</div>;

    return (
        <div className="animate-slide-up pb-12">
            <div className="flex items-center gap-3 mb-8">
                <Share2 className="text-primary" size={32} />
                <div>
                    <h1 className="stencil-text text-3xl">CENTRAL DE CARDS</h1>
                    <p className="font-bold text-xs uppercase text-muted flex items-center gap-1">
                        <MapPin size={12} /> {neighborhood.name}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exports.map((exp) => (
                    <div key={exp.id} className="card p-0 overflow-hidden flex flex-col bg-white hover:border-primary transition-colors">
                        <div className="aspect-[3/4] bg-muted/5 border-b-2 border-foreground relative overflow-hidden group">
                            <img
                                src={`/api/share/card?kind=${exp.kind}&format=${exp.format === 'text' ? '3x4' : exp.format}&neighborhood_slug=${slug}`}
                                alt="Card"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <a
                                    href={`/api/share/card?kind=${exp.kind}&format=${exp.format === 'text' ? '3x4' : exp.format}&neighborhood_slug=${slug}`}
                                    target="_blank"
                                    className="cta-button small bg-primary text-foreground"
                                >
                                    VER EM TELA CHEIA
                                </a>
                            </div>
                        </div>

                        <div className="p-4 flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                                <span className="bg-primary px-2 py-0.5 font-black text-[10px] uppercase border border-foreground">
                                    {exp.kind.replace('_', ' ')}
                                </span>
                                <span className="font-bold text-[10px] uppercase text-muted flex items-center gap-1">
                                    <Clock size={10} /> {new Date(exp.created_at).toLocaleDateString()}
                                </span>
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                                <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center font-black text-[8px] uppercase border border-foreground/20">
                                    {exp.profile?.display_name?.charAt(0) || "OP"}
                                </div>
                                <p className="text-[10px] font-bold uppercase opacity-60">
                                    Gerado por {exp.profile?.display_name || "Operador"}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}

                {exports.length === 0 && (
                    <div className="col-span-full card border-dashed py-12 text-center">
                        <p className="font-black text-xs uppercase opacity-40">Nenhum card gerado para este bairro ainda.</p>
                    </div>
                )}
            </div>

            <div className="mt-12 p-6 bg-muted/10 border-2 border-dashed border-foreground/20 text-center">
                <p className="font-bold text-xs uppercase text-muted mb-4">
                    Acesso restrito a operadores para auditoria de saída de dados sanitizados.
                </p>
                <Link href="/admin/piloto" className="text-xs font-black uppercase underline hover:text-primary">
                    VOLTAR AO PAINEL PILOTO
                </Link>
            </div>
        </div>
    );
}
