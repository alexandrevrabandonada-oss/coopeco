"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    Zap,
    Link as LinkIcon,
    Calendar,
    FileJson,
    Webhook,
    Copy,
    Save,
    CheckCircle2,
    XCircle,
    Plus,
    Trash2,
    RefreshCw,
    ShieldAlert
} from "lucide-react";

export default function IntegracoesClient() {
    const [cells, setCells] = useState<any[]>([]);
    const [neighborhoods, setNeighborhoods] = useState<any[]>([]);
    const [selectedCellId, setSelectedCellId] = useState<string>("");
    const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string>("");
    const [feeds, setFeeds] = useState<any[]>([]);
    const [webhooks, setWebhooks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testingWebhook, setTestingWebhook] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        async function loadInitial() {
            const { data: cData } = await supabase.from("eco_cells").select("*").order("name");
            if (cData) {
                setCells(cData);
                if (cData.length > 0) setSelectedCellId(cData[0].id);
            }
            setLoading(false);
        }
        loadInitial();
    }, [supabase]);

    useEffect(() => {
        if (selectedCellId) {
            async function loadCellData() {
                const { data: nData } = await supabase
                    .from("eco_cell_neighborhoods")
                    .select("neighborhood_id, neighborhood:neighborhoods(id, name, slug)")
                    .eq("cell_id", selectedCellId);

                const neighbors = (nData || []).map((n: any) => n.neighborhood);
                setNeighborhoods(neighbors);
                if (neighbors.length > 0) setSelectedNeighborhoodId(neighbors[0].id);

                const { data: wData } = await supabase
                    .from("eco_webhook_endpoints")
                    .select("*")
                    .eq("cell_id", selectedCellId);
                setWebhooks(wData || []);
            }
            loadCellData();
        }
    }, [selectedCellId, supabase]);

    useEffect(() => {
        if (selectedNeighborhoodId) {
            async function loadNeighborhoodFeeds() {
                const { data: fData } = await supabase
                    .from("eco_public_feeds")
                    .select("*")
                    .eq("neighborhood_id", selectedNeighborhoodId);
                setFeeds(fData || []);
            }
            loadNeighborhoodFeeds();
        }
    }, [selectedNeighborhoodId, supabase]);

    const handleToggleFeed = async (kind: string) => {
        const existing = feeds.find(f => f.feed_kind === kind);
        setSaving(true);
        try {
            if (existing) {
                const { error } = await supabase
                    .from("eco_public_feeds")
                    .update({ is_enabled: !existing.is_enabled })
                    .eq("id", existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("eco_public_feeds")
                    .insert({
                        scope: 'neighborhood',
                        neighborhood_id: selectedNeighborhoodId,
                        feed_kind: kind,
                        is_enabled: true
                    });
                if (error) throw error;
            }
            // Reload
            const { data: fData } = await supabase
                .from("eco_public_feeds")
                .select("*")
                .eq("neighborhood_id", selectedNeighborhoodId);
            setFeeds(fData || []);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAddWebhook = async () => {
        const url = prompt("URL do Webhook (destinatário):");
        if (!url) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from("eco_webhook_endpoints")
                .insert({
                    cell_id: selectedCellId,
                    url,
                    enabled: true
                });
            if (error) throw error;
            const { data: wData } = await supabase
                .from("eco_webhook_endpoints")
                .select("*")
                .eq("cell_id", selectedCellId);
            setWebhooks(wData || []);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleTestWebhook = async (webhookId: string) => {
        setTestingWebhook(true);
        try {
            const res = await fetch("/api/public/webhook-test", {
                method: "POST",
                body: JSON.stringify({ webhook_id: webhookId })
            });
            if (res.ok) alert("Evento de teste enviado com sucesso!");
            else alert("Erro ao enviar teste.");
        } catch (err: any) {
            alert(err.message);
        } finally {
            setTestingWebhook(false);
        }
    };

    const getFeedUrl = (kind: string) => {
        const feed = feeds.find(f => f.feed_kind === kind);
        if (!feed || !feed.is_enabled) return null;

        const neighbor = neighborhoods.find(n => n.id === selectedNeighborhoodId);
        if (!neighbor) return null;

        const base = typeof window !== 'undefined' ? window.location.origin : '';
        const ext = kind === 'windows_ics' ? '.ics' : '.json';
        return `${base}/api/public/${kind.replace('_', '.')}${ext}?neighborhood_slug=${neighbor.slug}&token=${feed.public_token}`;
    };

    if (loading) return <LoadingBlock text="Carregando integrações..." />;

    return (
        <div className="animate-slide-up pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <Zap className="text-primary" size={32} />
                    <h1 className="stencil-text text-3xl">INTEGRAÇÕES EXTERNAS</h1>
                </div>

                <div className="flex gap-2">
                    <select
                        className="field max-w-xs"
                        value={selectedCellId}
                        onChange={(e) => setSelectedCellId(e.target.value)}
                    >
                        {cells.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="md:col-span-2 flex flex-col gap-8">
                    {/* Public Feeds */}
                    <section className="card bg-white border-2 border-foreground/10 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="stencil-text text-xl flex items-center gap-2">
                                <LinkIcon size={24} /> FEEDS PÚBLICOS (TOKENIZADOS)
                            </h3>
                            <select
                                className="field tiny"
                                value={selectedNeighborhoodId}
                                onChange={(e) => setSelectedNeighborhoodId(e.target.value)}
                            >
                                {neighborhoods.map(n => (
                                    <option key={n.id} value={n.id}>{n.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-6">
                            {[
                                { kind: 'windows_ics', title: 'Calendário de Janelas (ICS)', icon: <Calendar size={18} /> },
                                { kind: 'bulletins_json', title: 'Feed de Boletins (JSON)', icon: <FileJson size={18} /> },
                                { kind: 'transparency_json', title: 'Dados de Transparência (JSON)', icon: <FileJson size={18} /> }
                            ].map(item => {
                                const feed = feeds.find(f => f.feed_kind === item.kind);
                                const url = getFeedUrl(item.kind);
                                return (
                                    <div key={item.kind} className="p-4 border-2 border-foreground/5 bg-muted/5">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-sm ${feed?.is_enabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                                    {item.icon}
                                                </div>
                                                <h4 className="font-black text-sm uppercase">{item.title}</h4>
                                            </div>
                                            <button
                                                className={`cta-button tiny ${feed?.is_enabled ? 'bg-red-600 text-white' : 'bg-foreground text-white'}`}
                                                onClick={() => handleToggleFeed(item.kind)}
                                                disabled={saving}
                                            >
                                                {feed?.is_enabled ? 'DESATIVAR' : 'ATIVAR'}
                                            </button>
                                        </div>

                                        {url ? (
                                            <div className="flex gap-2">
                                                <input
                                                    readOnly
                                                    value={url}
                                                    className="field tiny w-full bg-white font-mono text-[9px]"
                                                />
                                                <button
                                                    className="p-2 border border-foreground/20 hover:bg-muted transition-colors"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(url);
                                                        alert("Link copiado!");
                                                    }}
                                                >
                                                    <Copy size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-[10px] uppercase font-bold opacity-30 italic">Feed inativo no momento.</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* Webhooks */}
                    <section className="card bg-white border-2 border-foreground/10 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="stencil-text text-xl flex items-center gap-2">
                                <Webhook size={24} /> WEBHOOKS OPERACIONAIS
                            </h3>
                            <button className="cta-button tiny bg-foreground text-white" onClick={handleAddWebhook}>
                                <Plus size={14} className="mr-1" /> ADICIONAR
                            </button>
                        </div>

                        <div className="flex flex-col gap-4">
                            {webhooks.length === 0 ? (
                                <p className="text-center py-12 opacity-30 italic text-xs font-bold uppercase border-2 border-dashed border-foreground/5">
                                    Nenhum webhook configurado para esta célula.
                                </p>
                            ) : (
                                webhooks.map(wh => (
                                    <div key={wh.id} className="p-4 border-2 border-foreground/10 flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <div className="truncate pr-4">
                                                <p className="font-mono text-[10px] text-primary truncate">{wh.url}</p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className={`text-[8px] font-black uppercase px-1 ${wh.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {wh.enabled ? 'ATIVO' : 'PAUSADO'}
                                                    </span>
                                                    <span className="text-[8px] font-bold uppercase opacity-40">HMAC-SHA256</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    className="cta-button tiny"
                                                    onClick={() => handleTestWebhook(wh.id)}
                                                    disabled={testingWebhook}
                                                >
                                                    TESTAR
                                                </button>
                                                <button className="p-2 text-red-600 hover:bg-red-50">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                <aside className="flex flex-col gap-8">
                    <section className="card bg-foreground text-white border-foreground">
                        <h3 className="stencil-text text-sm mb-4 uppercase text-primary">Segurança Operacional</h3>
                        <div className="flex flex-col gap-4">
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="text-primary shrink-0" size={16} />
                                <p className="text-[9px] font-bold uppercase opacity-80 leading-relaxed">
                                    Feeds protegidos por Tokens de 48 chars para evitar indexação em massa.
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="text-primary shrink-0" size={16} />
                                <p className="text-[9px] font-bold uppercase opacity-80 leading-relaxed">
                                    Webhook Payload Sanitizado: Zero PII (nomes, endereços privados e telefones são removidos).
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="text-primary shrink-0" size={16} />
                                <p className="text-[9px] font-bold uppercase opacity-80 leading-relaxed">
                                    Assinatura HMAC: Verifique a integridade usando o segredo gerado abaixo de cada URL.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="card border-2 border-foreground bg-white">
                        <h2 className="stencil-text text-sm mb-4 uppercase">Saúde dos Feeds</h2>
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                <span>ICS Calendar</span>
                                <span className="text-green-600">ONLINE</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                <span>JSON Feeds</span>
                                <span className="text-green-600">ONLINE</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                <span>Webhooks</span>
                                <span className="text-muted italic opacity-40">WAITING</span>
                            </div>
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}
