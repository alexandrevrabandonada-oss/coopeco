"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { Loader2, Package, Clock, CheckCircle2, Truck, FileText, ChevronRight } from "lucide-react"
import Link from "next/link"
import { PickupRequest } from "@/types/eco"

export default function Pedidos() {
    const { user } = useAuth()
    const [requests, setRequests] = useState<PickupRequest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClient()

    const loadPedidos = useCallback(async () => {
        if (!user) return
        setIsLoading(true)
        const { data } = await supabase
            .from("pickup_requests")
            .select(`
        *,
        neighborhood:neighborhoods(name),
        receipt:receipts(id, receipt_code)
      `)
            .eq("created_by", user.id)
            .order("created_at", { ascending: false })

        if (data) setRequests(data)
        setIsLoading(false)
    }, [user, supabase])

    useEffect(() => {
        const timer = setTimeout(() => {
            loadPedidos()
        }, 0)
        return () => clearTimeout(timer)
    }, [loadPedidos])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        )
    }

    if (requests.length === 0) {
        return (
            <div className="card text-center py-12 animate-slide-up">
                <Package size={48} className="mx-auto mb-4 text-muted" />
                <h2 className="stencil-text mb-4">SEM PEDIDOS AINDA</h2>
                <p className="mb-6 font-bold uppercase">SUAS AÇÕES APARECERÃO AQUI ASSIM QUE VOCÊ PEDIR UMA COLETA.</p>
                <Link href="/pedir-coleta" className="cta-button mx-auto">PEDIR COLETA AGORA</Link>
            </div>
        )
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'open': return <Clock className="text-muted" size={20} />
            case 'accepted': return <CheckCircle2 className="text-secondary" size={20} />
            case 'en_route': return <Truck className="animate-pulse text-primary" size={20} />
            case 'collected': return <CheckCircle2 style={{ color: '#16a34a' }} size={20} />
            default: return <Package size={20} />
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'open': return 'AGUARDANDO COOPERADO'
            case 'accepted': return 'COLETA AGENDADA'
            case 'en_route': return 'A CAMINHO'
            case 'collected': return 'COLETA REALIZADA'
            default: return status.toUpperCase()
        }
    }

    return (
        <div className="animate-slide-up pb-12">
            <h1 className="stencil-text mb-8" style={{ fontSize: '2rem', background: 'var(--primary)', padding: '0 8px', border: '2px solid var(--foreground)', width: 'fit-content' }}>
                MEUS PEDIDOS
            </h1>

            <div className="flex flex-col gap-4">
                {requests.map((req) => (
                    <div key={req.id} className="card p-0 overflow-hidden">
                        <div className="p-4 border-b-2 border-foreground/10 flex justify-between items-center bg-muted/20">
                            <div className="flex items-center gap-2">
                                {getStatusIcon(req.status)}
                                <span className="font-black text-xs uppercase">{getStatusLabel(req.status)}</span>
                            </div>
                            <span className="text-[10px] font-bold text-muted">{new Date(req.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>

                        <div className="p-4">
                            <h3 className="font-extrabold text-sm mb-1">PEDIDO EM {req.neighborhood?.name}</h3>
                            {req.notes && <p className="text-xs text-muted mb-3 italic">&quot;{req.notes}&quot;</p>}

                            <div className="flex justify-between items-end mt-4">
                                {req.receipt ? (
                                    <Link href={`/recibos/${req.receipt.id}`} className="flex items-center gap-2 bg-primary p-2 border-2 border-foreground text-[10px] font-black uppercase">
                                        <FileText size={14} /> VER RECIBO: {req.receipt.receipt_code}
                                    </Link>
                                ) : (
                                    <div className="text-[10px] font-bold text-muted uppercase">AGUARDANDO FINALIZAÇÃO</div>
                                )}

                                <Link href={`/pedidos/${req.id}`} className="text-muted hover:text-foreground">
                                    <ChevronRight size={24} />
                                </Link>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <style jsx>{`
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .items-center { align-items: center; }
        .justify-center { justify-content: center; }
        .justify-between { justify-content: space-between; }
        .items-end { align-items: flex-end; }
        .gap-2 { gap: 0.5rem; }
        .gap-4 { gap: 1rem; }
        .mb-1 { margin-bottom: 0.25rem; }
        .mb-3 { margin-bottom: 0.75rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mb-8 { margin-bottom: 2rem; }
        .p-0 { padding: 0; }
        .p-2 { padding: 0.5rem; }
        .p-4 { padding: 1rem; }
        .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
        .text-center { text-align: center; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .text-xs { font-size: 0.75rem; }
        .text-muted { color: #737373; }
        .bg-muted\/20 { background-color: rgba(115, 115, 115, 0.1); }
        .border-b-2 { border-bottom-width: 2px; }
        .border-foreground\/10 { border-color: rgba(0, 0, 0, 0.1); }
        .overflow-hidden { overflow: hidden; }
        .italic { font-style: italic; }
      `}</style>
        </div>
    )
}
