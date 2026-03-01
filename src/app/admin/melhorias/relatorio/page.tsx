"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import { Copy, ArrowLeft, Printer, CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function InternalReportPage() {
    const searchParams = useSearchParams();
    const cycleId = searchParams.get("cycle_id");
    const [cycle, setCycle] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [rollup, setRollup] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        async function loadData() {
            if (!cycleId) return;

            const [
                { data: cData },
                { data: iData },
                { data: rData }
            ] = await Promise.all([
                supabase.from("eco_improvement_cycles").select("*, cell:eco_cells(*)").eq("id", cycleId).single(),
                supabase.from("eco_improvement_items").select("*").eq("cycle_id", cycleId).order("severity", { ascending: false }),
                supabase.from("eco_improvement_rollups").select("*").eq("cycle_id", cycleId).single()
            ]);

            setCycle(cData);
            setItems(iData || []);
            setRollup(rData);
            setLoading(false);
        }
        loadData();
    }, [supabase, cycleId]);

    const copyToClipboard = () => {
        const text = document.getElementById("report-content")?.innerText;
        if (text) {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (loading) return <LoadingBlock text="Gerando rascunho do boletim interno..." />;
    if (!cycle) return <div className="p-10 text-center">Ciclo não encontrado.</div>;

    const stats = rollup?.stats || {
        total: items.length,
        done: items.filter(i => i.status === 'done').length,
        todo: items.filter(i => i.status === 'todo').length
    };

    return (
        <div className="max-w-3xl mx-auto py-12 px-6 animate-slide-up">
            <div className="flex items-center justify-between mb-8 no-print">
                <Link href="/admin/melhorias" className="flex items-center gap-2 font-black text-xs uppercase opacity-60 hover:opacity-100">
                    <ArrowLeft size={16} /> VOLTAR
                </Link>
                <div className="flex gap-2">
                    <button
                        className="cta-button small bg-white border-2 border-foreground"
                        onClick={() => window.print()}
                    >
                        <Printer size={16} className="mr-2" /> IMPRIMIR
                    </button>
                    <button
                        className="cta-button small bg-secondary text-white"
                        onClick={copyToClipboard}
                    >
                        {copied ? <CheckCircle2 size={16} className="mr-2" /> : <Copy size={16} className="mr-2" />}
                        {copied ? 'COPIADO!' : 'COPIAR TEXTO'}
                    </button>
                </div>
            </div>

            <div id="report-content" className="bg-white border-4 border-foreground p-8 md:p-12 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                <header className="border-b-4 border-foreground pb-6 mb-8">
                    <div className="flex items-center gap-2 bg-foreground text-white px-3 py-1 mb-4 w-fit stencil-text text-xs tracking-widest">
                        ESTADO DA NAÇÃO — INTERNO
                    </div>
                    <h1 className="stencil-text text-4xl leading-none">
                        BOLETIM DE MELHORIA: {cycle.cell?.name}
                    </h1>
                    <p className="font-black text-sm uppercase mt-4">
                        Período: {new Date(cycle.period_start).toLocaleDateString()} a {new Date(cycle.period_end).toLocaleDateString()} ({cycle.cycle_kind})
                    </p>
                </header>

                <section className="mb-10">
                    <h2 className="stencil-text text-xl mb-4 text-secondary">1. PULSO OPERACIONAL</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-muted/30 p-4 border-2 border-foreground/10">
                            <span className="font-black text-[10px] uppercase opacity-60 mb-1 block">Volume Total</span>
                            <span className="text-3xl font-black">{stats.total}</span>
                        </div>
                        <div className="bg-secondary/10 p-4 border-2 border-secondary/20">
                            <span className="font-black text-[10px] uppercase text-secondary mb-1 block">Resolvidos</span>
                            <span className="text-3xl font-black text-secondary">{stats.done}</span>
                        </div>
                        <div className="bg-red-50 p-4 border-2 border-red-100">
                            <span className="font-black text-[10px] uppercase text-red-600 mb-1 block">Pendente</span>
                            <span className="text-3xl font-black text-red-600">{stats.todo}</span>
                        </div>
                    </div>
                </section>

                <section className="mb-10">
                    <h2 className="stencil-text text-xl mb-4 text-red-600">2. PRIORIDADES CRÍTICAS (BLOCKERS)</h2>
                    <div className="flex flex-col gap-4">
                        {items.filter(i => i.severity === 'blocker' && i.status !== 'done').length === 0 ? (
                            <p className="italic font-bold text-sm opacity-40 uppercase">Nenhum blocker ativo no momento.</p>
                        ) : (
                            items.filter(i => i.severity === 'blocker' && i.status !== 'done').map((item, idx) => (
                                <div key={idx} className="border-l-8 border-red-600 pl-4 py-2">
                                    <h3 className="font-black text-lg uppercase leading-tight">{item.title}</h3>
                                    <p className="text-sm font-bold opacity-60 mt-1 uppercase leading-snug">{item.summary}</p>
                                    <div className="mt-2 flex gap-2">
                                        <span className="text-[10px] font-black uppercase bg-muted px-1.5">{item.category}</span>
                                        <span className="text-[10px] font-black uppercase bg-muted px-1.5">{item.source_kind}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <section className="mb-10">
                    <h2 className="stencil-text text-xl mb-4">3. VITÓRIAS DA SEMANA</h2>
                    <div className="flex flex-col gap-3">
                        {items.filter(i => i.status === 'done').length === 0 ? (
                            <p className="italic font-bold text-sm opacity-40 uppercase">Aguardando conclusões para celebrar.</p>
                        ) : (
                            items.filter(i => i.status === 'done').map((item, idx) => (
                                <div key={idx} className="flex items-start gap-3">
                                    <CheckCircle2 size={18} className="text-secondary shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-extrabold text-sm uppercase leading-tight">{item.title}</h4>
                                        <p className="text-[10px] font-bold opacity-60 uppercase">{item.category}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <footer className="mt-16 pt-8 border-t-2 border-dashed border-foreground/20 text-center">
                    <p className="text-[10px] font-bold uppercase opacity-40 italic">
                        Documento Gerado Automaticamente (ECO v2.8) — Sem PII / Sem Ranking Individual.
                        <br />
                        Proteja a dignidade do trabalho. Melhore o sistema, não culpe as pessoas.
                    </p>
                </footer>
            </div>
        </div>
    );
}
