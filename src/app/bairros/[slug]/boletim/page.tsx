"use client";

import { useEffect, useState, useMemo, use } from "react";
import { createClient } from "@/lib/supabase";
import { Neighborhood, WeeklyBulletin, WeeklyBulletinBlock } from "@/types/eco";
import { LoadingBlock } from "@/components/loading-block";
import { FileText, Calendar, ArrowRight, TrendingUp, AlertCircle, MessageSquare } from "lucide-react";
import Link from "next/link";

export default function BoletimNeighborhood({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const [neighborhood, setNeighborhood] = useState<Neighborhood | null>(null);
    const [bulletins, setBulletins] = useState<WeeklyBulletin[]>([]);
    const [selectedBulletin, setSelectedBulletin] = useState<WeeklyBulletin | null>(null);
    const [blocks, setBlocks] = useState<WeeklyBulletinBlock[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            const { data: nData } = await supabase.from("neighborhoods").select("*").eq("slug", slug).maybeSingle();
            if (!nData) {
                setLoading(false);
                return;
            }
            setNeighborhood(nData);

            const { data: bData } = await supabase
                .from("weekly_bulletins")
                .select("*")
                .eq("neighborhood_id", nData.id)
                .eq("status", "published")
                .order("year", { ascending: false })
                .order("week_number", { ascending: false });

            const available = bData || [];
            setBulletins(available);

            if (available.length > 0) {
                await loadBulletinDetails(available[0]);
            } else {
                setLoading(false);
            }
        }
        loadData();
    }, [slug, supabase]);

    const loadBulletinDetails = async (bulletin: WeeklyBulletin) => {
        setSelectedBulletin(bulletin);
        const { data: bBlocks } = await supabase
            .from("weekly_bulletin_blocks")
            .select("*")
            .eq("bulletin_id", bulletin.id)
            .order("rank_order");
        setBlocks(bBlocks || []);
        setLoading(false);
    };

    if (loading) return <LoadingBlock text="Carregando boletins..." />;
    if (!neighborhood) return <div className="p-8 text-center font-black">BAIRRO NÃO ENCONTRADO</div>;

    return (
        <div className="animate-slide-up pb-12">
            <div className="mb-8">
                <h1 className="stencil-text text-4xl mb-2">BOLETIM ECO</h1>
                <p className="font-extrabold uppercase text-muted-foreground">Transparência sanitizada: Bairro {neighborhood.name}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Lista de Boletins Passados */}
                <div className="lg:col-span-1">
                    <h2 className="stencil-text text-lg mb-4 flex items-center gap-2">
                        <Calendar size={20} /> ARQUIVO
                    </h2>
                    <div className="flex flex-col gap-2">
                        {bulletins.map(b => (
                            <button
                                key={b.id}
                                onClick={() => loadBulletinDetails(b)}
                                className={`card text-left p-3 hover:border-primary transition-colors ${selectedBulletin?.id === b.id ? 'border-primary bg-primary/5' : ''}`}
                            >
                                <span className="font-black text-xs uppercase">Semana {b.week_number} / {b.year}</span>
                            </button>
                        ))}
                        {bulletins.length === 0 && (
                            <p className="text-muted font-bold text-xs uppercase italic">Nenhum boletim publicado ainda.</p>
                        )}
                    </div>
                </div>

                {/* Detalhe do Boletim Selecionado */}
                <div className="lg:col-span-3">
                    {selectedBulletin ? (
                        <div className="flex flex-col gap-6">
                            <div className="card border-primary bg-primary/5 p-6 shadow-[8px_8px_0_0_rgba(var(--primary-rgb),0.1)]">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="stencil-text text-2xl uppercase">Relatório da Semana {selectedBulletin.week_number}</h3>
                                    <span className="font-black text-xs bg-white border-2 border-primary px-2 py-1">PUBLICAÇÃO: {new Date(selectedBulletin.published_at || '').toLocaleDateString()}</span>
                                </div>
                                <p className="font-bold text-sm text-balance">
                                    Resultados agregados e sanitizados da operação urbana de reciclagem em seu território.
                                    Sem PII, foco total no impacto coletivo.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {blocks.map(block => (
                                    <div key={block.id} className="card">
                                        <h4 className="stencil-text text-sm mb-4 flex items-center gap-2 text-primary">
                                            {block.kind === 'stats' && <TrendingUp size={16} />}
                                            {block.kind === 'contamination' && <AlertCircle size={16} />}
                                            {block.kind === 'decisions' && <MessageSquare size={16} />}
                                            {block.kind.toUpperCase()}
                                        </h4>

                                        {block.kind === 'stats' && (
                                            <div className="flex flex-col gap-2">
                                                {Object.entries(block.content || {}).map(([key, val]: [string, any]) => (
                                                    <div key={key} className="flex justify-between border-b border-foreground/5 pb-1">
                                                        <span className="font-bold text-[10px] uppercase text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                                                        <span className="font-black text-sm">{val}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {block.kind === 'contamination' && (
                                            <div className="flex flex-col gap-2">
                                                <span className="font-bold text-[10px] uppercase text-muted-foreground mb-1">Alertas de Qualidade</span>
                                                {Array.isArray(block.content) ? block.content.map((item: any, idx: number) => (
                                                    <div key={idx} className="bg-red-50 border-l-4 border-red-500 p-2 font-bold text-xs uppercase">
                                                        {item}
                                                    </div>
                                                )) : <p className="text-xs italic">Nenhum alerta crítico registrado.</p>}
                                            </div>
                                        )}

                                        {block.kind === 'decisions' && (
                                            <div className="flex flex-col gap-3">
                                                {Array.isArray(block.content) ? block.content.map((item: any, idx: number) => (
                                                    <div key={idx} className="border-2 border-foreground/10 p-3 bg-muted/5">
                                                        <p className="font-black text-xs uppercase mb-1">{item.title}</p>
                                                        <p className="text-[10px] font-bold text-muted-foreground leading-tight">{item.summary}</p>
                                                    </div>
                                                )) : <p className="text-xs italic">Nenhuma decisão publicada no período.</p>}
                                            </div>
                                        )}

                                        {block.kind === 'highlights' && (
                                            <p className="font-bold text-xs italic text-muted-foreground line-clamp-3">
                                                {block.content?.text || block.content}
                                            </p>
                                        )}
                                    </div>
                                ))}
                                {blocks.length === 0 && (
                                    <p className="md:col-span-2 text-center py-12 font-black text-xs text-muted uppercase">Nenhum bloco de conteúdo neste boletim.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="card md:col-span-3 py-20 flex flex-col items-center justify-center text-muted">
                            <FileText size={48} className="mb-4 opacity-20" />
                            <p className="font-black text-sm uppercase">Selecione um boletim para visualizar</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
