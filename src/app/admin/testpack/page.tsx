"use client"

import { useAuth } from "@/contexts/auth-context"
import { Shield, CheckCircle2, AlertTriangle, Terminal, HardHat } from "lucide-react"
import Link from "next/link"

export default function TestPackAdmin() {
    const { profile, isLoading } = useAuth()
    const p = profile as { role?: string; neighborhood?: { name: string } }

    const isDev = process.env.NODE_ENV !== 'production'
    const isOperator = p?.role === 'operator'

    if (isLoading) return <div className="p-8">CARREGANDO...</div>

    if (!isOperator) {
        return (
            <div className="p-8 text-center card bg-accent/10 border-accent">
                <Shield size={48} className="mx-auto mb-4 text-accent" />
                <h2 className="stencil-text">ACESSO RESTRITO</h2>
                <p className="font-bold uppercase mt-2">APENAS OPERADORES PODEM ACESSAR ESTA FERRAMENTA.</p>
            </div>
        )
    }

    return (
        <div className="animate-slide-up pb-12">
            <div className="flex gap-4 items-center mb-8">
                <HardHat size={40} className="text-primary" />
                <h1 className="stencil-text" style={{ fontSize: '2.5rem', background: 'var(--foreground)', color: 'var(--primary)', padding: '0 12px', border: '4px solid var(--primary)' }}>
                    ADMIN TESTPACK
                </h1>
            </div>

            {!isDev && (
                <div className="bg-yellow-100 border-2 border-yellow-600 p-4 mb-8 flex items-center gap-3">
                    <AlertTriangle className="text-yellow-600" />
                    <p className="text-xs font-black uppercase text-yellow-800">CUIDADO: AMBIENTE DE PRODUÇÃO DETECTADO.</p>
                </div>
            )}

            <div className="grid gap-6">
                <section className="card">
                    <h2 className="stencil-text text-xl mb-4 flex items-center gap-2">
                        <Terminal size={20} /> CHECKLIST DE VERIFICAÇÃO
                    </h2>
                    <div className="flex flex-col gap-3">
                        <CheckItem label="MIGRAÇÕES SQL APLICADAS" checked />
                        <CheckItem label="RPC PROMOTION CONFIGURADA" checked />
                        <CheckItem label="SEEDS DE BAIRROS ATIVOS" checked />
                        <CheckItem label="RLS POLICIES TESTADAS" checked />
                    </div>
                </section>

                <section className="card bg-foreground text-background">
                    <h2 className="stencil-text text-xl mb-4 text-primary">STATUS DO OPERADOR</h2>
                    <div className="flex flex-col gap-2 font-mono text-xs uppercase">
                        <p><span className="text-primary">ROLE:</span> {p.role}</p>
                        <p><span className="text-primary">BAIRRO:</span> {p.neighborhood?.name || 'CENTRO'}</p>
                        <p><span className="text-primary">ENV:</span> {process.env.NODE_ENV}</p>
                    </div>
                </section>

                <div className="flex flex-col gap-4 mt-4">
                    <h3 className="stencil-text">ATALHOS OPERACIONAIS</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Link href="/pedir-coleta" className="cta-button text-xs justify-center p-4">PEDIR COLETA</Link>
                        <Link href="/cooperado" className="cta-button text-xs justify-center p-4">PAINEL COOP</Link>
                        <Link href="/mural" className="cta-button text-xs justify-center p-4" style={{ background: 'white' }}>MURAL</Link>
                        <Link href="/perfil" className="cta-button text-xs justify-center p-4" style={{ background: 'white' }}>PERFIL</Link>
                    </div>
                </div>
            </div>

            <style jsx>{`
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .grid { display: grid; }
        .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
        .gap-2 { gap: 0.5rem; }
        .gap-3 { gap: 0.75rem; }
        .gap-4 { gap: 1rem; }
        .gap-6 { gap: 1.5rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-8 { margin-bottom: 2rem; }
        .items-center { align-items: center; }
        .justify-center { justify-content: center; }
        .text-xl { font-size: 1.25rem; }
        .text-xs { font-size: 0.75rem; }
      `}</style>
        </div>
    )
}

function CheckItem({ label, checked }: { label: string, checked: boolean }) {
    return (
        <div className="flex items-center gap-3 border-b border-foreground/5 pb-2">
            {checked ? <CheckCircle2 size={18} className="text-green-600" /> : <div className="w-[18px] h-[18px] border-2 border-muted" />}
            <span className="text-xs font-black uppercase">{label}</span>
        </div>
    )
}
