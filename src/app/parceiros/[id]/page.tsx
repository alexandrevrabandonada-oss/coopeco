"use client"

import { useEffect, useState, use } from "react"
import { createClient } from "@/lib/supabase"
import { PartnerRank, TransparencyMonth } from "@/types/eco"
import { Loader2, ShieldCheck, Trophy, Package, Calendar, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function PartnerImpact({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [rank, setRank] = useState<PartnerRank | null>(null)
    const [history, setHistory] = useState<TransparencyMonth[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function loadData() {
            setIsLoading(true)
            // 1. Get current stats
            const { data: rankData } = await supabase
                .from("v_rank_partner_30d")
                .select("*")
                .eq("id", id)
                .single()

            if (rankData) {
                setRank(rankData)

                // 2. Get history (simulated by filtering metrics_daily)
                const { data: histData } = await supabase
                    .from("metrics_daily")
                    .select("day, impact_score, receipts_count")
                    .eq("partner_id", id)
                    .order("day", { ascending: false })
                    .limit(30)

                if (histData) {
                    // Aggregate by month for transparency table
                    // Simple mock for now
                    const months: Record<string, TransparencyMonth> = {}
                    histData.forEach(d => {
                        const m = d.day.substring(0, 7)
                        if (!months[m]) months[m] = { neighborhood_id: '', month: m, impact_score: 0, receipts_count: 0, mutiroes_count: 0, chamados_count: 0 }
                        months[m].impact_score += d.impact_score as number
                        months[m].receipts_count += d.receipts_count as number
                    })
                    setHistory(Object.values(months))
                }
            }
            setIsLoading(false)
        }
        loadData()
    }, [id, supabase])

    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={48} /></div>

    if (!rank) return (
        <div className="card text-center py-12">
            <h2 className="stencil-text">PARCEIRO NÃO ENCONTRADO</h2>
            <Link href="/" className="cta-button mx-auto mt-6">VOLTAR</Link>
        </div>
    )

    return (
        <div className="animate-slide-up pb-12">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/" className="p-2 border-2 border-foreground hover:bg-primary transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="text-primary" size={24} />
                        <span className="font-black text-xs uppercase bg-primary px-1 border border-foreground">SELAR ATIVO</span>
                    </div>
                    <h1 className="stencil-text text-3xl" style={{ padding: '0 8px', border: '2px solid var(--foreground)', width: 'fit-content' }}>
                        {rank.name}
                    </h1>
                </div>
            </div>

            <section className="mb-10">
                <h2 className="stencil-text text-xl mb-6 flex items-center gap-2">
                    <Calendar size={24} /> PERFORMANCE (30 DIAS)
                </h2>

                <div className="grid grid-cols-2 gap-4">
                    <div className="card bg-primary/10 border-primary flex flex-col items-center py-6">
                        <Trophy size={40} className="mb-2 text-primary" />
                        <span className="font-black text-3xl">{rank.impact_score || 0}</span>
                        <span className="font-bold text-[10px] uppercase">SCORE DE IMPACTO</span>
                    </div>
                    <div className="card flex flex-col items-center py-6">
                        <Package size={40} className="mb-2 text-secondary" />
                        <span className="font-black text-3xl">{rank.receipts_count || 0}</span>
                        <span className="font-bold text-[10px] uppercase">COLETAS APOIADAS</span>
                    </div>
                </div>
            </section>

            <section className="mb-10">
                <h2 className="stencil-text text-xl mb-6 flex items-center gap-2">
                    HISTÓRICO DE TRANSPARÊNCIA
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse border-2 border-foreground">
                        <thead>
                            <tr className="bg-foreground text-white">
                                <th className="p-2 text-left font-black uppercase text-xs">PERÍODO</th>
                                <th className="p-2 text-center font-black uppercase text-xs">SCORE</th>
                                <th className="p-2 text-center font-black uppercase text-xs">RECIBOS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((m, i) => (
                                <tr key={i} className="border-b-2 border-foreground/10 hover:bg-muted/5">
                                    <td className="p-3 font-extrabold uppercase text-xs">{m.month}</td>
                                    <td className="p-3 text-center font-black">{m.impact_score}</td>
                                    <td className="p-3 text-center font-bold">{m.receipts_count}</td>
                                </tr>
                            ))}
                            {history.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="p-8 text-center font-bold text-muted uppercase">NENHUMA COLETA REGISTRADA NO PERÍODO</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="card bg-muted/5 border-dashed text-center py-8">
                <p className="font-black text-xs uppercase mb-4">QUER APOIAR A COLETA EM {rank.name}?</p>
                <button className="cta-button mx-auto bg-black text-white">VIRAR PARCEIRO RECORRENTE</button>
            </div>

            <style jsx>{`
                .grid { display: grid; }
                .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                .gap-4 { gap: 1rem; }
                .w-full { width: 100%; }
            `}</style>
        </div>
    )
}
