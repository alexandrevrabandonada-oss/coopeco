"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "./loading-block";
import { Share2, Copy, Download, Eye, Terminal } from "lucide-react";

interface CommTemplate {
    slug: string;
    title: string;
    body_md: string;
    formats: string[];
}

interface CommSectionProps {
    neighborhoodId: string;
    neighborhoodSlug: string;
}

export function CommSection({ neighborhoodId, neighborhoodSlug }: CommSectionProps) {
    const [templates, setTemplates] = useState<CommTemplate[]>([]);
    const [selectedSlug, setSelectedSlug] = useState<string>("");
    const [selectedFormat, setSelectedFormat] = useState<string>("3x4");
    const [loading, setLoading] = useState(true);
    const [previewData, setPreviewData] = useState<any>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        async function loadTemplates() {
            const { data } = await supabase
                .from("comm_templates")
                .select("*")
                .eq("active", true);

            if (data) {
                setTemplates(data);
                if (data.length > 0) setSelectedSlug(data[0].slug);
            }
            setLoading(false);
        }
        loadTemplates();
    }, [supabase]);

    useEffect(() => {
        if (!selectedSlug) return;

        async function fetchPreview() {
            setLoadingPreview(true);
            try {
                const res = await fetch(`/api/share/text?kind=${selectedSlug}&neighborhood_slug=${neighborhoodSlug}`);
                const data = await res.json();
                setPreviewData(data);
            } catch (err) {
                console.error("Error fetching preview", err);
            } finally {
                setLoadingPreview(false);
            }
        }
        fetchPreview();
    }, [selectedSlug, neighborhoodSlug]);

    const logExport = async (format: string) => {
        if (!previewData) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            await fetch("/api/share/log", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    kind: selectedSlug,
                    format,
                    neighborhood_id: neighborhoodId,
                    payload_json: previewData.payload_json
                })
            });
        } catch (err) {
            console.error("Error logging export", err);
        }
    };

    const handleCopyText = () => {
        if (!previewData) return;
        navigator.clipboard.writeText(previewData.body);
        logExport("text");
        alert("Texto copiado para a área de transferência!");
    };

    const handleDownloadSVG = async () => {
        const url = `/api/share/card?kind=${selectedSlug}&format=${selectedFormat}&neighborhood_slug=${neighborhoodSlug}`;
        const res = await fetch(url);
        const svgText = await res.text();

        const blob = new Blob([svgText], { type: "image/svg+xml" });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `ECO_${selectedSlug}_${neighborhoodSlug}_${selectedFormat}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        logExport(selectedFormat);
    };

    if (loading) return <LoadingBlock text="Carregando modelos..." />;

    const template = templates.find(t => t.slug === selectedSlug);

    return (
        <section className="card animate-slide-up">
            <h2 className="stencil-text text-xl mb-6 flex items-center gap-2">
                <Share2 size={24} className="text-primary" /> COMUNICAR (30s)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Selection */}
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="font-black text-[10px] uppercase text-muted">Tipo de Mensagem</label>
                        <div className="flex flex-wrap gap-2">
                            {templates.map(t => (
                                <button
                                    key={t.slug}
                                    onClick={() => setSelectedSlug(t.slug)}
                                    className={`px-3 py-2 border-2 font-bold text-xs uppercase transition-all ${selectedSlug === t.slug ? "bg-primary border-foreground shadow-[2px_2px_0_0_#000]" : "bg-white border-muted opacity-60"
                                        }`}
                                >
                                    {t.title}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="font-black text-[10px] uppercase text-muted">Formato do Card</label>
                        <div className="flex gap-2">
                            {["3x4", "1x1"].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setSelectedFormat(f)}
                                    className={`px-4 py-2 border-2 font-bold text-xs uppercase transition-all ${selectedFormat === f ? "bg-foreground text-white border-foreground" : "bg-white border-muted"
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {previewData && (
                        <div className="flex flex-col gap-4 mt-4">
                            <div className="bg-muted/10 border-2 border-dashed border-foreground/20 p-4 relative">
                                <span className="absolute -top-3 left-3 bg-background px-2 font-black text-[8px] uppercase">Preview Texto</span>
                                <p className="text-sm italic text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                    {previewData.body}
                                </p>
                            </div>

                            <div className="flex gap-3 mt-2">
                                <button
                                    onClick={handleCopyText}
                                    className="cta-button small flex-1 justify-center gap-2"
                                >
                                    <Copy size={16} /> COPIAR TEXTO
                                </button>
                                <button
                                    onClick={handleDownloadSVG}
                                    className="cta-button small flex-1 justify-center gap-2"
                                    style={{ background: 'white' }}
                                >
                                    <Download size={16} /> BAIXAR SVG
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Preview Card */}
                <div className="flex flex-col gap-2 items-center justify-center bg-muted/5 border-2 border-foreground p-4 min-h-[400px]">
                    <span className="font-black text-[10px] uppercase text-muted mb-4 flex items-center gap-1">
                        <Eye size={12} /> Visualização do Card {selectedFormat}
                    </span>

                    {loadingPreview ? (
                        <div className="animate-pulse bg-muted w-full h-full min-h-[300px]" />
                    ) : previewData ? (
                        <div className="w-full max-w-[300px] border-4 border-foreground shadow-[8px_8px_0_0_#000] overflow-hidden">
                            <img
                                src={`/api/share/card?kind=${selectedSlug}&format=${selectedFormat}&neighborhood_slug=${neighborhoodSlug}&t=${Date.now()}`}
                                alt="Preview Card"
                                className="w-full h-auto"
                            />
                        </div>
                    ) : (
                        <p className="text-[10px] font-bold uppercase opacity-50">Selecione um modelo para ver o preview</p>
                    )}

                    <p className="text-[8px] font-bold uppercase mt-6 opacity-40 text-center max-w-[250px]">
                        Cards gerados dinamicamente com dados agregados (Zero PII). Estética Concreto/Stencil.
                    </p>
                </div>
            </div>
        </section>
    );
}
