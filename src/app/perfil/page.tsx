"use client"

import { useAuth } from "@/contexts/auth-context"
import { LoginForm } from "@/components/login-form"
import { ProfileOnboarding } from "@/components/profile-onboarding"
import { Loader2, LogOut, User as UserIcon, MapPin, Shield, Recycle } from "lucide-react"
import Link from "next/link"

export default function Perfil() {
    const { user, profile, isLoading, signOut } = useAuth()

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        )
    }

    if (!user) {
        return <LoginForm />
    }

    if (!profile) {
        return <ProfileOnboarding onComplete={() => window.location.reload()} />
    }

    // Profile Data
    const p = profile as { display_name?: string; role: string; neighborhood?: { name: string } };

    return (
        <div className="animate-slide-up">
            <div className="flex justify-between items-start mb-8">
                <h1 className="stencil-text" style={{ fontSize: '2.5rem', background: 'var(--primary)', padding: '0 8px', border: '2px solid var(--foreground)' }}>
                    MEU PERFIL
                </h1>
                <button
                    onClick={() => signOut()}
                    className="p-2 border-2 border-foreground bg-accent text-white"
                >
                    <LogOut size={24} />
                </button>
            </div>

            <div className="card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ background: '#3b82f6', color: 'white', padding: '1rem', border: '2px solid var(--foreground)' }}>
                    <UserIcon size={32} />
                </div>
                <div>
                    <h2 className="stencil-text" style={{ fontSize: '1.5rem' }}>{p.display_name}</h2>
                    <p style={{ fontWeight: 800, color: '#404040', fontSize: '0.875rem' }}>E-MAIL: {user.email}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card flex items-center gap-4">
                    <MapPin className="text-primary" />
                    <div>
                        <span className="stencil-text text-xs">TERRITÓRIO</span>
                        <p className="font-extrabold uppercase">BAIRRO {p.neighborhood?.name || 'VINCUALDO'}</p>
                    </div>
                </div>

                <div className="card flex items-center gap-4">
                    <Shield style={{ color: '#3b82f6' }} />
                    <div>
                        <span className="stencil-text text-xs">PAPEL NO ECO</span>
                        <p className="font-extrabold uppercase">{p.role}</p>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
                <h3 className="stencil-text mb-4" style={{ fontSize: '1.25rem' }}>Ações Rápidas</h3>
                <div className="flex flex-col gap-3">
                    <Link href="/pedidos" className="cta-button w-full justify-between" style={{ background: 'white' }}>
                        MEUS PEDIDOS DE COLETA
                        <Recycle size={20} />
                    </Link>
                    <Link href="/recibos" className="cta-button w-full justify-between" style={{ background: 'white' }}>
                        MEUS RECIBOS ECO
                        <Shield size={20} />
                    </Link>
                    {['cooperado', 'operator'].includes(p.role) && (
                        <Link href="/cooperado" className="cta-button w-full justify-between" style={{ background: 'var(--accent)', color: 'white' }}>
                            PAINEL DO COOPERADO
                            <Shield size={20} />
                        </Link>
                    )}
                </div>
            </div>

            <style jsx>{`
        .flex { display: flex; }
        .items-center { align-items: center; }
        .justify-center { justify-content: center; }
        .justify-between { justify-content: space-between; }
        .flex-col { flex-direction: column; }
        .gap-3 { gap: 0.75rem; }
        .gap-4 { gap: 1rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-8 { margin-bottom: 2rem; }
        .text-xs { font-size: 0.75rem; }
        .grid { display: grid; }
        .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
        @media (min-width: 768px) {
          .md\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
        </div>
    )
}
