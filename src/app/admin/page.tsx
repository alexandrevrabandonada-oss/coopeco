"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { NeighborhoodRank, PartnerRank } from "@/types/eco"
import { Loader2, Map, Shield, AlertTriangle, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function AdminDashboard() {
    const isPilotEnabled = (process.env.NEXT_PUBLIC_ECO_FEATURES_PILOT ?? process.env.ECO_FEATURES_PILOT ?? "false").toLowerCase() === "true"
    const isAnchorsEnabled = (process.env.NEXT_PUBLIC_ECO_FEATURES_ANCHORS ?? process.env.ECO_FEATURES_ANCHORS ?? "false").toLowerCase() === "true"
    const isGalpaoEnabled = (process.env.NEXT_PUBLIC_ECO_FEATURES_GALPAO ?? process.env.ECO_FEATURES_GALPAO ?? "false").toLowerCase() === "true"
    const isGovEnabled = (process.env.NEXT_PUBLIC_ECO_FEATURES_GOV ?? process.env.ECO_FEATURES_GOV ?? "false").toLowerCase() === "true"
    const [neighborhoods, setNeighborhoods] = useState<NeighborhoodRank[]>([])
    const [partners, setPartners] = useState<PartnerRank[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function loadData() {
            setIsLoading(true)
            const { data: nData } = await supabase.from("v_rank_neighborhood_30d").select("*").limit(5)
            const { data: pData } = await supabase.from("v_rank_partner_30d").select("*").limit(5)

            if (nData) setNeighborhoods(nData)
            if (pData) setPartners(pData)
            setIsLoading(false)
        }
        loadData()
    }, [supabase])

    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={48} /></div>

    return (
        <div className="animate-slide-up pb-12">
            <h1 className="stencil-text mb-8" style={{ fontSize: '3rem', background: 'var(--primary)', padding: '0 12px', border: '4px solid var(--foreground)', width: 'fit-content' }}>
                ADMIN
            </h1>
            <div className="mb-8">
                <div className="flex gap-2 flex-wrap">
                    <Link href="/admin/rotas" className="cta-button" style={{ width: "fit-content" }}>
                        ABRIR ADMIN / ROTAS <ArrowRight size={18} />
                    </Link>
                    <Link href="/admin/pontos" className="cta-button" style={{ width: "fit-content", background: "white" }}>
                        ABRIR ADMIN / PONTOS <ArrowRight size={18} />
                    </Link>
                    {isAnchorsEnabled && (
                        <Link href="/admin/ancoras" className="cta-button" style={{ width: "fit-content", background: "var(--secondary)", color: "white" }}>
                            ABRIR ADMIN / ÂNCORAS <ArrowRight size={18} />
                        </Link>
                    )}
                    {isGalpaoEnabled && (
                        <Link href="/admin/galpao" className="cta-button" style={{ width: "fit-content", background: "var(--accent)", color: "white" }}>
                            ABRIR ADMIN / GALPÃO <ArrowRight size={18} />
                        </Link>
                    )}
                    {isGovEnabled && (
                        <Link href="/admin/governanca" className="cta-button" style={{ width: "fit-content", background: "#0f766e", color: "white" }}>
                            ABRIR ADMIN / GOVERNANÇA <ArrowRight size={18} />
                        </Link>
                    )}
                    {isPilotEnabled && (
                        <>
                            <Link href="/admin/piloto" className="cta-button" style={{ width: "fit-content", background: "var(--secondary)", color: "white" }}>
                                ABRIR ADMIN / PILOTO <ArrowRight size={18} />
                            </Link>
                            <Link href="/admin/operacao" className="cta-button" style={{ width: "fit-content", background: "var(--accent)", color: "white" }}>
                                ABRIR ADMIN / OPERAÇÃO <ArrowRight size={18} />
                            </Link>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <section>
                    <h2 className="stencil-text text-xl mb-6 flex items-center gap-2">
                        <Map size={24} /> TOP BAIRROS (30D)
                    </h2>
                    <div className="flex flex-col gap-2">
                        {neighborhoods.map((n, i) => (
                            <div key={n.id} className="flex items-center justify-between p-3 border-2 border-foreground bg-white">
                                <div className="flex items-center gap-3">
                                    <span className="font-black text-xl text-primary">{i + 1}</span>
                                    <span className="font-bold uppercase text-sm">{n.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-black text-lg">{n.impact_score}</span>
                                    <Link href={`/bairros/${n.slug}`} className="p-1 border border-foreground/20 hover:bg-primary transition-colors">
                                        <ArrowRight size={16} />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <h2 className="stencil-text text-xl mb-6 flex items-center gap-2">
                        <Shield size={24} /> TOP PARCEIROS (30D)
                    </h2>
                    <div className="flex flex-col gap-2">
                        {partners.map((p, i) => (
                            <div key={p.id} className="flex items-center justify-between p-3 border-2 border-foreground bg-white">
                                <div className="flex items-center gap-3">
                                    <span className="font-black text-xl text-secondary">{i + 1}</span>
                                    <span className="font-bold uppercase text-sm">{p.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-black text-lg">{p.impact_score}</span>
                                    <Link href={`/parceiros/${p.id}`} className="p-1 border border-foreground/20 hover:bg-primary transition-colors">
                                        <ArrowRight size={16} />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <section>
                <h2 className="stencil-text text-xl mb-6 flex items-center gap-2 text-accent">
                    <AlertTriangle size={24} /> ALERTAS OPERACIONAIS
                </h2>
                <div className="card bg-accent/5 border-accent border-dashed">
                    <ul className="flex flex-col gap-4 list-none p-0">
                        <li className="flex items-start gap-3 border-b border-accent/20 pb-3 last:border-0 last:pb-0">
                            <div className="bg-accent text-white p-1 font-black text-[10px]">ALERTA</div>
                            <div>
                                <p className="font-bold text-xs uppercase">CENTRO: ALTA DEMANDA DE CHAMADOS</p>
                                <p className="text-[10px] text-muted">A relação Chamados / Recibos está acima de 3:1. Considerar reforço de cooperados.</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3 border-b border-accent/20 pb-3 last:border-0 last:pb-0">
                            <div className="bg-muted text-white p-1 font-black text-[10px] uppercase">STATUS</div>
                            <div>
                                <p className="font-bold text-xs uppercase">RECICLA JÁ: INATIVO HÁ 7 DIAS</p>
                                <p className="text-[10px] text-muted">Parceiro não registrou apoio a novas coletas. Verificar conexão operacional.</p>
                            </div>
                        </li>
                    </ul>
                </div>
            </section>

            <style jsx>{`
                .grid { display: grid; }
                .grid-cols-1 { grid-template-columns: 1fr; }
                @media (min-width: 768px) {
                    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                }
                .gap-2 { gap: 0.5rem; }
                .gap-8 { gap: 2rem; }
            `}</style>
        </div>
    )
}
