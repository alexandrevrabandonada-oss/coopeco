"use client";

import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import { Copy, ArrowLeft, Send, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProtectedRouteGate } from "@/components/protected-route-gate";

export default function HotfixSprintReport() {
    return (
        <ProtectedRouteGate>
            <Suspense fallback={<LoadingBlock text="Carregando matriz..." />}>
                <ReportClient />
            </Suspense>
        </ProtectedRouteGate>
    );
}

function ReportClient() {
    const searchParams = useSearchParams();
    const sprintId = searchParams.get("sprint_id");

    const [sprint, setSprint] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const supabase = createClient();

    useEffect(() => {
        if (!sprintId) return;
        async function load() {
            setLoading(true);
            const { data: sprintData } = await supabase
                .from("eco_hotfix_sprints")
                .select("*, coords:eco_cells(name), neighborhood:neighborhoods(name)")
                .eq("id", sprintId)
                .single();

            setSprint(sprintData);

            if (sprintData) {
                const { data: itemsData } = await supabase
                    .from("eco_hotfix_items")
                    .select("*")
                    .eq("sprint_id", sprintData.id)
                    .order("category");
                setItems(itemsData || []);
            }
            setLoading(false);
        }
        load();
    }, [sprintId, supabase]);

    if (!sprintId) {
        return <div className="p-8">Sprint não fornecida.</div>;
    }

    if (loading) return <LoadingBlock text="Compilando relatório pós-rua..." />;
    if (!sprint) return <div className="p-8">Sprint não encontrada.</div>;

    const doneItems = items.filter(i => i.status === 'done');
    const blockedItems = items.filter(i => i.status !== 'done' && i.status !== 'wontfix');

    const generateMarkdown = () => {
        let md = `*COMUNICADO DE ROTA — CÉLULA ${sprint.coords?.name}*\n`;
        md += `*Bairro:* ${sprint.neighborhood?.name}\n`;
        md += `*Ciclo Pós-Rua (Semana):* ${sprint.week_start}\n\n`;

        md += `*🛠 O QUE FOI CORRIGIDO (VITÓRIAS DA SEMANA):*\n`;
        if (doneItems.length === 0) {
            md += `Nenhum ajuste crítico finalizado neste recorte.\n`;
        } else {
            doneItems.forEach(i => {
                md += `- [${i.category.toUpperCase()}] ${i.title}\n`;
            });
        }
        md += `\n`;

        md += `*🚧 O QUE SEGUE EM ANÁLISE / BLOQUEADO:*\n`;
        if (blockedItems.length === 0) {
            md += `Operação fluindo nominalmente. Nenhum gargalo aberto.\n`;
        } else {
            blockedItems.forEach(i => {
                md += `- [${i.severity.toUpperCase()}] ${i.title}\n`;
            });
        }
        md += `\n*Nota Comum*: Seguimos refinando a operação para garantir cuidado em cada coleta. Sem caça-cliques, apenas trabalho digno.`;

        return md;
    };

    const textToCopy = generateMarkdown();

    const doCopy = () => {
        navigator.clipboard.writeText(textToCopy);
        alert("Copiado para a área de transferência!");
    };

    return (
        <div className="animate-slide-up pb-20 p-4 md:p-8 max-w-3xl mx-auto">
            <Link href="/admin/hotfix" className="flex items-center gap-2 text-[10px] font-black uppercase text-muted underline mb-8">
                <ArrowLeft size={16} /> VOLTAR PARA O SPRINT BOARD
            </Link>

            <header className="mb-8">
                <h1 className="stencil-text text-3xl mb-2 flex items-center gap-3">
                    <Send size={28} className="text-primary" /> DISPARO DE TRANSPARÊNCIA
                </h1>
                <p className="font-bold text-xs uppercase opacity-70">
                    Gere atualizações imutáveis do Pós-Rua para grupos comunitários. Zero PII garantido.
                </p>
            </header>

            <div className="bg-white border-4 border-foreground shadow-[6px_6px_0_0_rgba(0,0,0,1)] p-6 relative">
                <button
                    onClick={doCopy}
                    className="absolute top-4 right-4 bg-primary text-black p-2 border-2 border-foreground hover:bg-primary-dark transition-colors flex items-center gap-2 font-black text-[10px] uppercase"
                >
                    <Copy size={16} /> Copiar Markdown
                </button>
                <h2 className="text-[10px] font-black uppercase bg-foreground text-background px-2 py-1 w-fit mb-4">
                    PREVIEW DO COMUNICADO
                </h2>

                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed opacity-90 p-4 bg-muted/10 border border-foreground/20">
                    {textToCopy}
                </pre>
            </div>

            <div className="mt-6 flex flex-col gap-2 p-4 bg-orange-50 border-2 border-orange-500 text-orange-900">
                <h3 className="font-black text-[10px] uppercase flex items-center gap-2">
                    <AlertCircle size={14} /> Diretriz Editorial (A48)
                </h3>
                <p className="text-xs font-bold leading-tight">
                    Cole este texto nos canais oficiais da Célula. Não adicione nomes (PII) mesmo que o problema tenha origem no feedback de um cooperado específico. Celebre a correção estrutural coletivamente.
                </p>
            </div>
        </div>
    );
}
