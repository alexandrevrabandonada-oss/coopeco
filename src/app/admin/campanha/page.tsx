"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    Flag,
    Calendar,
    Zap,
    Copy,
    Download,
    Eye,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Sparkles,
    MapPin,
    Smartphone,
    Megaphone,
    Printer,
    FileText
} from "lucide-react";

export default function AdminCampanhaPage() {
    const [loading, setLoading] = useState(true);
    const [neighborhoods, setNeighborhoods] = useState<any[]>([]);
    const [packs, setPacks] = useState<any[]>([]);

    // New Pack State
    const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState("");
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [isCreating, setIsCreating] = useState(false);

    // active pack details
    const [activePack, setActivePack] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        const { data: nData } = await supabase.from("neighborhoods").select("id, name, slug").order("name");
        const { data: pData } = await supabase.from("eco_campaign_packs").select("*, neighborhood:neighborhoods(name)").order("created_at", { ascending: false });
        setNeighborhoods(nData || []);
        setPacks(pData || []);
        setLoading(false);
    };

    const handleCreatePack = async () => {
        if (!selectedNeighborhoodId) return;
        setIsCreating(true);

        const neighborhood = neighborhoods.find(n => n.id === selectedNeighborhoodId);

        const { data: pack, error } = await supabase.from("eco_campaign_packs").insert({
            scope: 'neighborhood',
            neighborhood_id: selectedNeighborhoodId,
            title: `Campanha de Lançamento: ${neighborhood?.name}`,
            start_date: startDate,
            status: 'draft'
        }).select().single();

        if (error) {
            alert(error.message);
            setIsCreating(false);
            return;
        }

        // Initialize 7 days via RPC
        await supabase.rpc('rpc_generate_campaign_pack', { p_pack_id: pack.id });

        await loadInitialData();
        await loadPackDetails(pack.id);
        setIsCreating(false);
    };

    const loadPackDetails = async (packId: string) => {
        const { data: pack } = await supabase.from("eco_campaign_packs").select("*, neighborhood:neighborhoods(*)").eq("id", packId).single();
        const { data: items } = await supabase.from("eco_campaign_items").select("*").eq("pack_id", packId).order("day_index");
        setActivePack(pack);
        setItems(items || []);
    };

    const handleGenerateItems = async () => {
        if (!activePack) return;
        setIsGenerating(true);

        for (const item of items) {
            // Call the share/text API for each kind to get localized & linted text
            const resp = await fetch(`/api/share/text?kind=${item.text_template_kind}&neighborhood_slug=${activePack.neighborhood?.slug}`);
            const data = await resp.json();

            if (data.body) {
                const cardUrl = `/api/share/card?kind=${item.card_kind}&neighborhood_slug=${activePack.neighborhood?.slug}`;

                await supabase.from("eco_campaign_items").update({
                    generated_text: data.body,
                    generated_card_url: cardUrl,
                    status: 'generated'
                }).eq("id", item.id);
            }
        }

        await loadPackDetails(activePack.id);
        setIsGenerating(false);
    };

    const handleSetStatus = async (itemId: string, status: string) => {
        if (status === 'published') {
            // A48: Editorial Review Integration
            const { data: nData } = await supabase
                .from("neighborhoods")
                .select("cell_id")
                .eq("id", activePack.neighborhood_id)
                .single();

            if (nData?.cell_id) {
                const { data: cellData } = await supabase
                    .from("eco_cells")
                    .select("editorial_mode")
                    .eq("id", nData.cell_id)
                    .single();

                const mode = cellData?.editorial_mode || 'lint_only';
                const item = items.find(i => i.id === itemId);

                if (mode === 'review_required' || mode === 'lint_only') {
                    // Even if we don't have the full lint result here, review_required always triggers it.
                    // For lint_only, we assume campaign generation already normalized it, 
                    // but we can still push to review if cellular policy requires human eyes.
                    if (mode === 'review_required') {
                        const { data: qId, error: qError } = await supabase.rpc('rpc_request_editorial_review', {
                            p_cell_id: nData.cell_id,
                            p_source_kind: 'campaign_item',
                            p_source_id: itemId,
                            p_lint_summary: { blockers: 0, warns: 0 } // Generation is soft-linted
                        });

                        if (!qError) {
                            await supabase.rpc('rpc_save_editorial_version', {
                                p_queue_id: qId,
                                p_new_text: item.generated_text,
                                p_reason: 'Publicação de campanha'
                            });
                            alert("ENVIADO PARA REVISÃO: Este item de campanha requer aprovação editorial da célula.");
                            await loadPackDetails(activePack.id);
                            return;
                        }
                    }
                }
            }
        }

        await supabase.from("eco_campaign_items").update({ status }).eq("id", itemId);
        await loadPackDetails(activePack.id);
    };

    return (
        <div className="animate-slide-up pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <Megaphone className="text-secondary" size={32} />
                    <h1 className="stencil-text text-3xl">CAMPANHAS DE CULTURA</h1>
                </div>
                {!activePack && (
                    <div className="flex gap-2">
                        <select
                            className="field font-bold uppercase text-xs"
                            value={selectedNeighborhoodId}
                            onChange={e => setSelectedNeighborhoodId(e.target.value)}
                        >
                            <option value="">Selecionar Bairro...</option>
                            {neighborhoods.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                        </select>
                        <button
                            onClick={handleCreatePack}
                            disabled={isCreating}
                            className="cta-button small"
                        >NOVA CAMPANHA</button>
                    </div>
                )}
            </header>

            {loading ? <LoadingBlock text="Sincronizando rituais de cuidado..." /> : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {!activePack ? (
                        <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {packs.map(pack => (
                                <button
                                    key={pack.id}
                                    onClick={() => loadPackDetails(pack.id)}
                                    className="card bg-white border-2 border-foreground p-5 text-left hover:border-primary transition-all group shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:shadow-none translate-y-0 hover:translate-x-1 hover:translate-y-1"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`px-2 py-0.5 font-black text-[8px] uppercase text-white ${pack.status === 'done' ? 'bg-green-600' : 'bg-secondary'
                                            }`}>
                                            {pack.status}
                                        </div>
                                        <Clock size={16} className="opacity-20" />
                                    </div>
                                    <h3 className="stencil-text text-lg leading-tight mb-2 group-hover:text-primary">{pack.title}</h3>
                                    <p className="text-[10px] font-bold opacity-50 uppercase flex items-center gap-1">
                                        <Calendar size={10} /> Início: {new Date(pack.start_date).toLocaleDateString()}
                                    </p>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="lg:col-span-1 flex flex-col gap-4">
                                <button
                                    onClick={() => setActivePack(null)}
                                    className="cta-button tiny bg-white flex items-center gap-2 mb-4"
                                > <ChevronLeft size={14} /> VOLTAR</button>

                                <div className="card bg-foreground text-white p-6 sticky top-8">
                                    <h2 className="stencil-text text-xl mb-2 text-secondary">{activePack.neighborhood?.name}</h2>
                                    <p className="text-[10px] font-bold opacity-50 uppercase mb-6 italic">Pack de 7 Dias Operacionais</p>

                                    <div className="flex flex-col gap-4 mb-8">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[8px] font-black uppercase opacity-40">Status</span>
                                            <span className="font-black text-xs uppercase">{activePack.status}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[8px] font-black uppercase opacity-40">Início</span>
                                            <span className="font-black text-xs uppercase">{new Date(activePack.start_date).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleGenerateItems}
                                        disabled={isGenerating}
                                        className="w-full bg-primary py-3 stencil-text text-lg text-foreground hover:bg-primary/90 flex items-center justify-center gap-2"
                                    >
                                        {isGenerating ? "GERANDO..." : "GERAR CONTEÚDO"}
                                    </button>
                                    <p className="text-[8px] font-bold opacity-40 mt-2 text-center uppercase">Consome templates efetivos (A44) e linter (A43)</p>
                                </div>
                            </div>

                            <div className="lg:col-span-3 flex flex-col gap-8">
                                {items.map((item) => (
                                    <div key={item.id} className="card bg-white border-2 border-foreground/10 p-6 hover:border-foreground transition-all">
                                        <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-muted flex items-center justify-center stencil-text text-2xl border-2 border-foreground">
                                                    {item.day_index}
                                                </div>
                                                <div>
                                                    <h4 className="stencil-text text-xl uppercase">{item.kind.replace('_', ' ')}</h4>
                                                    <div className="flex gap-2 items-center text-[10px] font-black uppercase opacity-40">
                                                        <span>{item.text_template_kind}</span>
                                                        <span>•</span>
                                                        <span>{item.card_kind}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                {item.status === 'todo' && <span className="px-3 py-1 bg-muted font-black text-[10px] uppercase">Aguardando Geração</span>}
                                                {item.status === 'generated' && (
                                                    <button
                                                        onClick={() => handleSetStatus(item.id, 'published')}
                                                        className="px-3 py-1 bg-green-600 text-white font-black text-[10px] uppercase hover:bg-green-700"
                                                    >Marcar como Publicado</button>
                                                )}
                                                {item.status === 'published' && <span className="px-3 py-1 bg-foreground text-white font-black text-[10px] uppercase flex items-center gap-1"><CheckCircle2 size={10} /> PUBLICADO</span>}
                                            </div>
                                        </div>

                                        {item.generated_text && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-slide-up">
                                                <div className="flex flex-col gap-4">
                                                    <div className="card p-4 bg-muted/5 border-2 border-dashed border-foreground/20 italic font-bold text-sm leading-relaxed relative group">
                                                        <button
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(item.generated_text);
                                                                alert("Texto copiado para o clipboard!");
                                                            }}
                                                            className="absolute top-2 right-2 p-1.5 bg-white border border-foreground opacity-0 group-hover:opacity-100 transition-all hover:bg-primary"
                                                        >
                                                            <Copy size={12} />
                                                        </button>
                                                        {item.generated_text}
                                                    </div>

                                                    {item.print_kind && (
                                                        <div className="p-3 bg-yellow-50 border border-yellow-200 flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <Printer className="text-yellow-600" size={16} />
                                                                <span className="text-[10px] font-black uppercase">Print Sugerido: {item.print_kind}</span>
                                                            </div>
                                                            <a
                                                                href={`/api/print/${item.print_kind}?kind=neighborhood&id=${activePack.neighborhood?.slug}`}
                                                                target="_blank"
                                                                className="px-2 py-1 bg-white border border-yellow-200 text-[8px] font-black uppercase hover:bg-yellow-100"
                                                            >Abrir SVG</a>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    <div className="aspect-[4/3] bg-muted/10 border border-foreground/5 flex items-center justify-center overflow-hidden group relative">
                                                        <iframe
                                                            src={item.generated_card_url}
                                                            className="w-[1011px] h-[638px] border-0 pointer-events-none origin-center scale-[0.3]"
                                                            style={{ transform: 'scale(0.3)' }}
                                                        />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 flex items-center justify-center transition-all">
                                                            <a
                                                                href={item.generated_card_url}
                                                                target="_blank"
                                                                className="opacity-0 group-hover:opacity-100 cta-button tiny bg-white flex items-center gap-2"
                                                            ><Download size={12} /> ABRIR CARD 3:4</a>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            <style jsx>{`
                .card { border-radius: 0; }
                .field { border-radius: 0; }
            `}</style>
        </div>
    );
}

const ChevronLeft = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m15 18-6-6 6-6" /></svg>
);
