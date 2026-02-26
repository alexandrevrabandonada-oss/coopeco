"use client"

import { useEffect, useState, use } from "react"
import { createClient } from "@/lib/supabase"
import { NeighborhoodRank, TransparencyMonth } from "@/types/eco"
import { Loader2, TrendingUp, Trophy, Package, Users, MessageSquare, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function NeighborhoodImpact({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params)
    const [rank, setRank] = useState<NeighborhoodRank | null>(null)
    const [history, setHistory] = useState<TransparencyMonth[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function loadData() {
            setIsLoading(true)
            // 1. Get current rank/stats
            const { data: rankData } = await supabase
                .from("v_rank_neighborhood_30d")
                .select("*")
                .eq("slug", slug)
                .single()

            if (rankData) {
                setRank(rankData)

                // 2. Get history
                const { data: histData } = await supabase
                    .from("v_transparency_neighborhood_month")
                    .select("*")
                    .eq("neighborhood_id", rankData.id)
                    .limit(6)

                if (histData) setHistory(histData)
            }
            setIsLoading(false)
        }
        loadData()
    }, [slug, supabase])

    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={48} /></div>

    if (!rank) return (
        <div className="card text-center py-12">
            <h2 className="stencil-text">BAIRRO NÃO ENCONTRADO</h2>
            <Link href="/" className="cta-button mx-auto mt-6">VOLTAR</Link>
        </div>
    )

    return (
        <div className="animate-slide-up pb-12">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/" className="p-2 border-2 border-foreground hover:bg-primary transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="stencil-text" style={{ fontSize: '2.5rem', background: 'var(--primary)', padding: '0 8px', border: '2px solid var(--foreground)' }}>
                    {rank.name}
                </h1>
            </div>

            <section className="mb-10">
                <h2 className="stencil-text text-xl mb-6 flex items-center gap-2">
                    <TrendingUp size={24} /> IMPACTO (30 DIAS)
                </h2>

                <div className="grid grid-cols-2 gap-4">
                    <div className="card bg-primary/10 border-primary flex flex-col items-center py-6">
                        <Trophy size={32} className="mb-2 text-primary" />
                        <span className="font-black text-3xl">{rank.impact_score || 0}</span>
                        <span className="font-bold text-[10px] uppercase">SCORE TOTAL</span>
                    </div>
                    <div className="card flex flex-col items-center py-6">
                        <Package size={32} className="mb-2 text-secondary" />
                        <span className="font-black text-3xl">{rank.receipts_count || 0}</span>
                        <span className="font-bold text-[10px] uppercase">RECIBOS FORTES</span>
                    </div>
                    <div className="card flex flex-col items-center py-6">
                        <Users size={32} className="mb-2 text-accent" />
                        <span className="font-black text-3xl">{rank.mutiroes_count || 0}</span>
                        <span className="font-bold text-[10px] uppercase">MUTIRÕES</span>
                    </div>
                    <div className="card flex flex-col items-center py-6">
                        <MessageSquare size={32} className="mb-2 text-muted" />
                        <span className="font-black text-3xl">{rank.chamados_count || 0}</span>
                        <span className="font-bold text-[10px] uppercase">CHAMADOS</span>
                    </div>
                </div>
            </section>

            <section className="mb-10">
                <h2 className="stencil-text text-xl mb-6 flex items-center gap-2">
                    TRANSPARÊNCIA MENSAL
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse border-2 border-foreground">
                        <thead>
                            <tr className="bg-foreground text-white">
                                <th className="p-2 text-left font-black uppercase text-xs">MÊS</th>
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
                                    <td colSpan={3} className="p-8 text-center font-bold text-muted uppercase">SEM DADOS HISTÓRICOS</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="flex flex-col gap-4">
                <Link href="/pedir-coleta" className="cta-button w-full justify-center py-6">QUERO CONTRIBUIR AQUI</Link>
                <Link href="/mural" className="cta-button w-full justify-center py-6 bg-secondary text-white">VER MURAL DO BAIRRO</Link>
            </div>

            <style jsx>{`
                .grid { display: grid; }
                .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                .gap-4 { gap: 1rem; }
                .w-full { width: 100%; }
                .border-collapse { border-collapse: collapse; }
                .border-2 { border-width: 2px; }
            `}</style>
        </div>
    )
}
