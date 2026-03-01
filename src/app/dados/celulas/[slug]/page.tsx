import { createClient } from "@supabase/supabase-js";
import {
    Database,
    ShieldCheck,
    FileJson,
    FileSpreadsheet,
    Link as LinkIcon
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 3600;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

const MAPPING: Record<string, string> = {
    'impact_weekly': 'Agregados de Impacto (Tabela)',
    'wins_weekly': 'Vitórias do Comum (Narrativas)',
    'bulletins': 'Boletins de Comunicação',
    'windows_ics': 'Calendário ICS (Janelas)'
};

export default async function CellOpenDataPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    // Get Cell
    const { data: cell } = await supabase
        .from("eco_cells")
        .select("id, name")
        .eq("slug", slug)
        .single();

    if (!cell) notFound();

    // Get active feeds for this cell
    const { data: feeds } = await supabase
        .from("eco_open_data_feeds")
        .select("*")
        .eq("cell_id", cell.id)
        .is("neighborhood_id", null)
        .eq("is_enabled", true);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://app.coopeco.org";

    return (
        <div className="bg-[#f4f1ea] min-h-screen text-foreground pb-20">
            <header className="bg-foreground text-white pt-16 pb-12 px-6 shadow-[0_8px_0_0_rgba(255,193,7,1)]">
                <div className="max-w-4xl mx-auto flex items-center gap-6">
                    <div className="p-4 bg-secondary text-white rounded-sm shadow-[4px_4px_0_0_rgba(255,255,255,0.2)]">
                        <Database size={48} />
                    </div>
                    <div>
                        <Link href={`/dados`} className="text-[10px] font-black uppercase text-secondary hover:text-white transition-colors flex items-center gap-1 mb-2">
                            ← HUB DE DADOS
                        </Link>
                        <h1 className="stencil-text text-4xl md:text-5xl uppercase tracking-tighter">API DA CÉLULA {cell.name}</h1>
                        <p className="text-sm font-bold opacity-80 mt-2 max-w-xl">
                            Consuma JSON ou CSV estruturados. Limite de requisições regido pelo cache (A54).
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 mt-16 space-y-12">
                {(!feeds || feeds.length === 0) ? (
                    <div className="text-center py-20 border-4 border-dashed border-foreground/10 opacity-40">
                        <ShieldCheck size={64} className="mx-auto mb-4" />
                        <h2 className="stencil-text text-2xl uppercase">API EM MANUTENÇÃO / INATIVA</h2>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {feeds.map((f: any) => (
                            <div key={f.id} className="bg-white border-4 border-foreground p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
                                <div>
                                    <h3 className="stencil-text text-2xl">{MAPPING[f.dataset] || f.dataset}</h3>
                                    <p className="text-[10px] font-black uppercase opacity-50 mt-1 flex items-center gap-1">
                                        <LinkIcon size={12} /> REQUER TOKEN PÚBLICO (ANEXADO NAS URLS ABAIXO)
                                    </p>
                                </div>
                                <div className="flex flex-col gap-3 min-w-[200px]">
                                    <a target="_blank" href={`${baseUrl}/api/public/data/${f.dataset}.json?token=${f.public_token}`} className="cta-button tiny bg-black text-white w-full justify-center">
                                        <FileJson size={14} /> ACESSAR RAW JSON
                                    </a>
                                    {(f.dataset === 'impact_weekly') && (
                                        <a target="_blank" href={`${baseUrl}/api/public/data/${f.dataset}.csv?token=${f.public_token}`} className="cta-button tiny bg-secondary text-white w-full justify-center">
                                            <FileSpreadsheet size={14} /> BAIXAR CSV
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
