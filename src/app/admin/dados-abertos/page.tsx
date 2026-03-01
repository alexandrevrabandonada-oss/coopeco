"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    Database,
    RefreshCw,
    Link as LinkIcon,
    ShieldAlert,
    ShieldCheck,
    CheckCircle2,
    ToggleLeft,
    ToggleRight
} from "lucide-react";
import Link from "next/link";

interface FeedConfig {
    id: string;
    dataset: string;
    is_enabled: boolean;
    public_token: string;
    scope: string;
    cell_id: string;
}

const DATASETS = [
    { id: 'impact_weekly', label: 'Eficácia do Bairro', desc: 'Série temporal de triagens, tarefas e saúde logística.' },
    { id: 'wins_weekly', label: 'Vitórias Semanais', desc: 'Comprovantes de resiliência e narrativas agregadas.' },
    { id: 'bulletins', label: 'Boletins Locais', desc: 'Resumo oficial e publicações da célula.' },
];

export default function AdminOpenDataPage() {
    const [loading, setLoading] = useState(true);
    const [cells, setCells] = useState<any[]>([]);
    const [selectedCell, setSelectedCell] = useState<string>("");
    const [feeds, setFeeds] = useState<FeedConfig[]>([]);
    const [baseUrl, setBaseUrl] = useState("");

    const supabase = createClient();

    useEffect(() => {
        setBaseUrl(window.location.origin);
        loadCells();
    }, []);

    useEffect(() => {
        if (selectedCell) {
            loadFeeds(selectedCell);
        }
    }, [selectedCell]);

    const loadCells = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: mandates } = await supabase.from("eco_mandates").select("cell_id").eq("user_id", user.id).eq("status", "active");
        const cellIds = mandates?.map(m => m.cell_id) || [];

        const { data: cData } = await supabase.from("eco_cells").select("*").in("id", cellIds).order("name");
        setCells(cData || []);

        if (cData && cData.length > 0) {
            setSelectedCell(cData[0].id);
        }
        setLoading(false);
    };

    const loadFeeds = async (cellId: string) => {
        setLoading(true);
        const { data } = await supabase
            .from("eco_open_data_feeds")
            .select("*")
            .eq("cell_id", cellId)
            .is("neighborhood_id", null); // Simplificando configs ao nível de célula neste primeiro passo

        setFeeds(data || []);
        setLoading(false);
    };

    const toggleFeed = async (dataset: string, currentId?: string, currentState?: boolean) => {
        if (currentId) {
            // Update existing
            const { error } = await supabase
                .from("eco_open_data_feeds")
                .update({ is_enabled: !currentState })
                .eq("id", currentId);
            if (!error) loadFeeds(selectedCell);
        } else {
            // Create new
            const { error } = await supabase
                .from("eco_open_data_feeds")
                .insert({
                    scope: 'cell',
                    cell_id: selectedCell,
                    dataset: dataset,
                    is_enabled: true
                });
            if (!error) loadFeeds(selectedCell);
        }
    };

    const rotateToken = async (id: string) => {
        if (!confirm("Isso quebrará links antigos que a mídia ou pesquisadores já estejam usando. Tem certeza?")) return;

        // Supabase function to generate a new token (gen_random_bytes(16)) handled on DB layer via RPC or trigger if preferred.
        // For simplification on client side, generating a secure random hex.
        const array = new Uint8Array(16);
        window.crypto.getRandomValues(array);
        const newToken = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

        const { error } = await supabase
            .from("eco_open_data_feeds")
            .update({ public_token: newToken })
            .eq("id", id);

        if (!error) {
            loadFeeds(selectedCell);
            alert("Token rotacionado com sucesso.");
        }
    };

    const copyUrl = (dataset: string, token: string, format: 'json' | 'csv') => {
        navigator.clipboard.writeText(`${baseUrl}/api/public/data/${dataset}.${format}?token=${token}`);
        alert(`Link ${format.toUpperCase()} copiado!`);
    };

    if (loading && cells.length === 0) return <LoadingBlock text="Carregando chaves públicas..." />;

    return (
        <div className="animate-slide-up pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b-4 border-foreground pb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-secondary text-white rounded-sm shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                        <Database size={32} />
                    </div>
                    <div>
                        <h1 className="stencil-text text-4xl uppercase tracking-tighter">API DATA & TRANSPARÊNCIA</h1>
                        <p className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                            <ShieldAlert size={12} /> DADOS AGREGADOS. ZERO PII. CONTROLE DA CÉLULA (A54)
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <select
                        className="field py-2 text-[10px] font-black uppercase bg-white border-2"
                        value={selectedCell}
                        onChange={e => setSelectedCell(e.target.value)}
                    >
                        {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-6">
                    {DATASETS.map((ds) => {
                        const feed = feeds.find(f => f.dataset === ds.id);
                        const isEnabled = feed?.is_enabled;

                        return (
                            <div key={ds.id} className={`card border-4 p-6 transition-colors ${isEnabled ? 'border-primary shadow-[6px_6px_0_0_rgba(255,193,7,1)] bg-white' : 'border-dashed border-foreground/30 bg-muted/10 opacity-70'}`}>
                                <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-6">
                                    <div>
                                        <h3 className="stencil-text text-xl mb-1">{ds.label}</h3>
                                        <p className="text-xs font-bold opacity-60">{ds.desc}</p>
                                    </div>
                                    <button
                                        onClick={() => toggleFeed(ds.id, feed?.id, feed?.is_enabled)}
                                        className={`flex items-center gap-2 text-[10px] font-black uppercase border-2 px-3 py-1 ${isEnabled ? 'border-green-600 text-green-700 bg-green-50' : 'border-foreground/40 text-foreground/60'}`}
                                    >
                                        {isEnabled ? <><ToggleRight size={16} /> API ATIVA</> : <><ToggleLeft size={16} /> API INATIVA</>}
                                    </button>
                                </div>

                                {isEnabled && feed && (
                                    <div className="space-y-4 pt-4 border-t-2 border-dashed border-foreground/10">
                                        <div className="flex flex-col md:flex-row gap-3">
                                            <div className="flex-1 bg-muted/10 p-3 border border-foreground/20 font-mono text-[9px] truncate flex items-center justify-between">
                                                <span><span className="opacity-50 font-bold uppercase mr-2 mr-2">Token:</span> {feed.public_token}</span>
                                            </div>
                                            <button
                                                onClick={() => rotateToken(feed.id)}
                                                className="cta-button tiny bg-white border-2 border-foreground"
                                                title="Gerar novo token (quebra links antigos)"
                                            >
                                                <RefreshCw size={12} /> ROTACIONAR
                                            </button>
                                        </div>

                                        <div className="flex gap-3 mt-4">
                                            <button onClick={() => copyUrl(ds.id, feed.public_token, 'json')} className="cta-button tiny bg-primary">
                                                <LinkIcon size={12} /> COPIAR LINK JSON
                                            </button>
                                            {ds.id === 'impact_weekly' && (
                                                <button onClick={() => copyUrl(ds.id, feed.public_token, 'csv')} className="cta-button tiny bg-secondary text-white">
                                                    <LinkIcon size={12} /> COPIAR PLANILHA CSV
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                <div className="space-y-6">
                    <div className="card text-xs font-bold leading-relaxed border-2 border-foreground bg-primary/10 p-6 space-y-4">
                        <h3 className="stencil-text text-sm border-b border-foreground/20 pb-2 flex items-center gap-2">
                            <ShieldCheck size={16} /> COMPROMISSO DE PRIVACIDADE
                        </h3>
                        <p>O <b>Pacto Anti-Vigilância (A34)</b> está fixado no código de exportação.</p>
                        <p>Independentemente dos botões acima, o robô estrutural da Coop Eco bloqueia o vazamento de endereços das residências, nomes individuais e logs operacionais brutos.</p>
                        <ul className="list-disc pl-4 space-y-1 opacity-80 mt-2">
                            <li>Apenas agregados (Volume, Qualidade %).</li>
                            <li>Tamanho e Mapeamentos finos não são expostos nesta rota externa.</li>
                        </ul>

                        <div className="pt-4 mt-6 border-t border-foreground/20 text-center">
                            <Link href="/admin/privacidade" className="cta-button tiny w-full justify-center border-2 border-foreground bg-white hover:bg-black hover:text-white">
                                AUDITAR REGRAS NO A34
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .card { border-radius: 0; }
                .field { border-radius: 0; }
            `}</style>
        </div>
    );
}
