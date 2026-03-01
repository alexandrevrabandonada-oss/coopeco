"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { ProtectedRouteGate } from "@/components/protected-route-gate";
import { LoadingBlock } from "@/components/loading-block";
import { ClipboardCheck, Printer, CheckCircle2, AlertTriangle, Info, MessageSquare, Zap, BookOpen } from "lucide-react";
import Link from "next/link";

export default function AdminOperacaoPage() {
    const [neighborhoods, setNeighborhoods] = useState<any[]>([]);
    const [selectedSlug, setSelectedSlug] = useState("");
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function loadNeighborhoods() {
            const { data } = await supabase.from("neighborhoods").select("*").order("name");
            if (data) {
                setNeighborhoods(data);
                if (data.length > 0) setSelectedSlug(data[0].slug);
            }
            setLoading(false);
        }
        loadNeighborhoods();
    }, [supabase]);

    if (loading) return <LoadingBlock text="Carregando rituais..." />;

    const selectedNeighborhood = neighborhoods.find(n => n.slug === selectedSlug);

    const generateFocus = async () => {
        if (!selectedNeighborhood) return;
        const confirmed = confirm("Gerar novo foco semanal e rituais para este bairro?");
        if (!confirmed) return;

        try {
            const { error } = await supabase.rpc("rpc_generate_learning_focus", {
                p_neighborhood_id: selectedNeighborhood.id,
                p_week_start: new Date().toISOString().split('T')[0]
            });
            if (error) throw error;
            alert("Rituais e foco atualizados com sucesso!");
        } catch (e: any) {
            alert("Erro ao gerar foco: " + e.message);
        }
    };

    return (
        <ProtectedRouteGate>
            <div className="animate-slide-up pb-12">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <ClipboardCheck className="text-accent" size={32} />
                        <h1 className="stencil-text text-3xl text-accent">RITUAIS OPERACIONAIS</h1>
                    </div>

                    <select
                        className="field max-w-xs"
                        value={selectedSlug}
                        onChange={(e) => setSelectedSlug(e.target.value)}
                    >
                        {neighborhoods.map(n => (
                            <option key={n.id} value={n.slug}>{n.name}</option>
                        ))}
                    </select>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        <section className="card border-accent border-2">
                            <div className="flex justify-between items-start mb-6">
                                <h2 className="stencil-text text-xl flex items-center gap-2">
                                    RITUAL DO DIA: PILOTO
                                </h2>
                                <a
                                    href={`/api/print/kit?kind=operator_checklist&format=a4&neighborhood_slug=${selectedSlug}`}
                                    target="_blank"
                                    className="cta-button small bg-accent text-white flex gap-2"
                                >
                                    <Printer size={16} /> IMPRIMIR RITUAL (A4)
                                </a>
                            </div>

                            <div className="flex flex-col gap-4">
                                {[
                                    { step: "1", title: "CONFERIR RUNBOOK", desc: "Verificar se há incidentes críticos abertos e seguir as ações imediatas." },
                                    { step: "2", title: "GERAR RECORRENTES", desc: "Verificar se as coletas semanais foram geradas no sistema." },
                                    { step: "3", title: "CONFERIR LOTAÇÃO", desc: "Monitorar se as janelas de hoje estão acima de 80% de capacidade." },
                                    { step: "4", title: "RECEBIMENTO NO PONTO", desc: "Garantir que o operador está logado e pronto para emitir recibos." },
                                    { step: "5", title: "REGISTRO DE LOTE", desc: "Ao final do turno, registrar a pesagem total coletada." },
                                    { step: "6", title: "BOLETIM DE TRANSPARÊNCIA", desc: "Publicar o card de resumo para a comunidade." },
                                ].map((item) => (
                                    <div key={item.step} className="flex gap-4 p-4 border-2 border-foreground bg-white">
                                        <div className="w-10 h-10 bg-accent text-white flex items-center justify-center font-black text-xl shrink-0">
                                            {item.step}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-sm uppercase">{item.title}</h3>
                                            <p className="text-xs text-muted-foreground uppercase font-bold">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="card bg-muted/5 border-dashed">
                            <h3 className="stencil-text text-sm mb-4 flex items-center gap-2">
                                <Info size={16} /> FILOSOFIA RECIBO
                            </h3>
                            <p className="font-bold text-xs uppercase leading-relaxed text-muted">
                                O recibo não é apenas um papel digital. É a prova do trabalho digno e
                                a base da transparência do COOP ECO. Se não há recibo, a coleta não existiu
                                para o impacto socioambiental do bairro.
                            </p>
                        </section>
                    </div>

                    <aside className="flex flex-col gap-6">
                        <section className="card bg-foreground text-white border-foreground">
                            <h3 className="stencil-text text-sm mb-4 uppercase text-accent">Ações Rápidas</h3>
                            <div className="flex flex-col gap-3">
                                <a
                                    href={`/api/print/kit?kind=pilot_day_script&format=a4&neighborhood_slug=${selectedSlug}`}
                                    target="_blank"
                                    className="cta-button small w-full justify-between bg-white text-black"
                                >
                                    ROTEIRO DE RUA
                                    <Printer size={16} />
                                </a>
                                <button
                                    onClick={generateFocus}
                                    className="cta-button small w-full justify-between bg-primary text-white"
                                >
                                    GERAR FOCO / RITUAIS
                                    <Zap size={16} />
                                </button>
                                <a
                                    href={`/api/print/kit?kind=learning_focus_week&format=card&neighborhood_id=${selectedNeighborhood?.id}&neighborhood_slug=${selectedSlug}`}
                                    target="_blank"
                                    className="cta-button small w-full justify-between bg-white text-black"
                                >
                                    CARD FOCO SEMANAL
                                    <BookOpen size={16} />
                                </a>
                                <a
                                    href={`/api/print/kit?kind=operator_badge&format=card&neighborhood_slug=${selectedSlug}`}
                                    target="_blank"
                                    className="cta-button small w-full justify-between bg-white text-black"
                                >
                                    CRACHÁ OPERADOR
                                    <Printer size={16} />
                                </a>
                            </div>
                        </section>

                        <section className="card border-accent border-2 bg-accent/5">
                            <h3 className="stencil-text text-sm mb-2 flex items-center gap-2">
                                <AlertTriangle size={16} /> RECIBO É LEI
                            </h3>
                            <p className="text-[10px] font-black uppercase opacity-60 mb-4">
                                Todo operador deve garantir que o resident/parceiro receba a confirmação
                                imediata no app ECO.
                            </p>
                            <Link href="/feedback?kind=page&id=admin_operacao" className="cta-button small w-full justify-center bg-accent text-white">
                                REPORTAR PROBLEMA AGORA
                            </Link>
                        </section>
                    </aside>
                </div>
            </div>
        </ProtectedRouteGate>
    );
}
