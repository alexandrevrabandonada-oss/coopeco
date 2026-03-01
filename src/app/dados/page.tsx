import { createClient } from "@/lib/supabase";
import {
    Database,
    ShieldCheck,
    AlertTriangle,
    FileJson,
    FileSpreadsheet,
    Link as LinkIcon
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 3600;

export default async function PublicOpenDataRootPage() {
    const supabase = createClient();
    // Para simplificar a rota raiz, listar células ativas que tenham feeds ativados para navegação
    const { data: feeds } = await supabase
        .from("eco_open_data_feeds")
        .select("cell_id, eco_cells(name, slug)")
        .eq("is_enabled", true)
        .eq("scope", "cell");

    // Unique cells
    const cells = Array.from(new Set(feeds?.map(f => JSON.stringify(f.eco_cells)))).map(c => JSON.parse(c as string)).filter(Boolean);

    return (
        <div className="bg-[#f4f1ea] min-h-screen text-foreground pb-20">
            <header className="bg-foreground text-white pt-16 pb-12 px-6 shadow-[0_8px_0_0_rgba(255,193,7,1)]">
                <div className="max-w-4xl mx-auto flex items-center gap-6">
                    <div className="p-4 bg-secondary text-white rounded-sm shadow-[4px_4px_0_0_rgba(255,255,255,0.2)]">
                        <Database size={48} />
                    </div>
                    <div>
                        <h1 className="stencil-text text-5xl md:text-6xl uppercase tracking-tighter">DADOS ABERTOS</h1>
                        <p className="text-sm font-bold opacity-80 mt-2 max-w-xl">
                            Transparência do Comum. Acesse os resumos de impacto, qualidades e vitórias semanais, protegidos pelo Pacto Anti-Vigilância (A54).
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 mt-16 space-y-12">
                <section className="bg-white border-4 border-foreground shadow-[8px_8px_0_0_rgba(0,0,0,1)] p-8 md:p-12">
                    <h2 className="stencil-text text-2xl mb-6 flex items-center gap-3">
                        <ShieldCheck className="text-primary" /> O QUE É PUBLICADO AQUI?
                    </h2>
                    <div className="prose max-w-none text-foreground/80 font-bold leading-relaxed">
                        <p>Disponibilizamos planilhas JSON e CSV formatadas para que jornalistas, professores, estudantes e a própria comunidade analisem o pulso ecológico local.</p>
                        <p className="flex items-center gap-2 mt-4 text-secondary">
                            <AlertTriangle size={16} /> O QUE <strong>NÃO</strong> PUBLICAMOS (NUNCA):
                        </p>
                        <ul className="list-disc pl-5 opacity-80">
                            <li>Nomes de participantes individuais ou rankings de desempenho.</li>
                            <li>Endereços exatos, latitude/longitude ou trajetos de moradores.</li>
                            <li>Evidências fotográficas detalhadas ou rotas de coleta internas.</li>
                            <li>Apenas os totais <strong>agregados semanais</strong> são expostos.</li>
                        </ul>
                    </div>
                </section>

                <section>
                    <h2 className="stencil-text text-2xl mb-6">EXPLORAR POR COMUNIDADE</h2>
                    {cells.length === 0 ? (
                        <div className="text-center py-12 border-4 border-dashed border-foreground/10 opacity-40 font-bold">
                            NENHUMA API DE DADOS FOI ATIVADA AINDA.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {cells.map((c: any) => (
                                <Link key={c.slug} href={`/dados/celulas/${c.slug}`} className="group bg-white border-4 border-foreground p-6 hover:bg-primary/10 hover:border-primary transition-all flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase opacity-60 mb-1">CÉLULA BASE</p>
                                        <h3 className="stencil-text text-xl">{c.name}</h3>
                                    </div>
                                    <Database className="opacity-20 group-hover:opacity-100 group-hover:text-primary transition-all" />
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
