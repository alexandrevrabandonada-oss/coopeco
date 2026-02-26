"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { LoginForm } from "@/components/login-form"
import { ProfileOnboarding } from "@/components/profile-onboarding"
import { Loader2, LogOut, User as UserIcon, MapPin, Shield, Recycle } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { PickupAddressProfile } from "@/types/eco"

export default function Perfil() {
    const { user, profile, isLoading, signOut } = useAuth()
    const supabase = useMemo(() => createClient(), [])
    const [addressFull, setAddressFull] = useState("")
    const [contactPhone, setContactPhone] = useState("")
    const [isAddressLoading, setIsAddressLoading] = useState(false)
    const [isAddressSaving, setIsAddressSaving] = useState(false)
    const [addressMessage, setAddressMessage] = useState<string | null>(null)
    const [recurringAlertCount, setRecurringAlertCount] = useState(0)
    const p = profile as { display_name?: string; role: string; neighborhood?: { name: string } } | null

    useEffect(() => {
        const run = async () => {
            if (!user || profile?.role !== "resident") return
            setIsAddressLoading(true)
            setAddressMessage(null)
            const [{ data, error }, { count }] = await Promise.all([
                supabase
                    .from("pickup_address_profiles")
                    .select("user_id, address_full, contact_phone")
                    .eq("user_id", user.id)
                    .maybeSingle<PickupAddressProfile>(),
                supabase
                    .from("user_notifications")
                    .select("id", { count: "exact", head: true })
                    .eq("user_id", user.id)
                    .eq("kind", "recurring_skipped_invalid")
                    .eq("is_read", false),
            ])

            if (error) {
                setAddressMessage(error.message)
            } else if (data) {
                setAddressFull(data.address_full || "")
                setContactPhone(data.contact_phone || "")
            }
            setRecurringAlertCount(count || 0)
            setIsAddressLoading(false)
        }
        run()
    }, [user, profile?.role, supabase])

    const saveAddressProfile = async () => {
        if (!user) return
        if (!addressFull.trim()) {
            setAddressMessage("Informe o endereço para recorrência doorstep.")
            return
        }
        setIsAddressSaving(true)
        setAddressMessage(null)
        const { error } = await supabase.from("pickup_address_profiles").upsert(
            {
                user_id: user.id,
                address_full: addressFull.trim(),
                contact_phone: contactPhone.trim() || null,
            },
            { onConflict: "user_id" },
        )
        if (error) {
            setAddressMessage(error.message)
        } else {
            setAddressMessage("Endereço de coleta salvo.")
        }
        const { count } = await supabase
            .from("user_notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("kind", "recurring_skipped_invalid")
            .eq("is_read", false)
        setRecurringAlertCount(count || 0)
        setIsAddressSaving(false)
    }

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

    if (!profile || !p) {
        return <ProfileOnboarding onComplete={() => window.location.reload()} />
    }

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

            {p.role === "resident" && (
                <div className="card mt-6">
                    {recurringAlertCount > 0 && (
                        <div className="border-2 border-accent bg-white p-3 mb-4">
                            <p className="font-black text-xs uppercase">
                                Você tem {recurringAlertCount} alerta(s) de recorrência para resolver.
                            </p>
                            <p className="font-bold text-xs uppercase mb-2">
                                Atualize seu endereço para evitar skipped_invalid na próxima geração.
                            </p>
                            <Link href="/notificacoes" className="cta-button small inline-flex">
                                Ver notificações
                            </Link>
                        </div>
                    )}
                    <h3 className="stencil-text mb-4" style={{ fontSize: "1.1rem" }}>
                        Endereço de Coleta (Recorrência Doorstep)
                    </h3>
                    {isAddressLoading ? (
                        <p className="font-bold text-xs uppercase">Carregando endereço...</p>
                    ) : (
                        <div id="endereco-coleta" className="flex flex-col gap-3">
                            <textarea
                                value={addressFull}
                                onChange={(event) => setAddressFull(event.target.value)}
                                className="w-full p-4 border-2 border-foreground bg-white font-bold outline-none h-24"
                                placeholder="Rua, número e complemento (privado)"
                            />
                            <input
                                value={contactPhone}
                                onChange={(event) => setContactPhone(event.target.value)}
                                className="w-full p-4 border-2 border-foreground bg-white font-bold outline-none"
                                placeholder="Telefone de contato"
                            />
                            <button
                                onClick={saveAddressProfile}
                                disabled={isAddressSaving}
                                className="cta-button w-full justify-center"
                            >
                                {isAddressSaving ? "Salvando..." : "Salvar meu endereço de coleta"}
                            </button>
                            {addressMessage && (
                                <p className="font-bold text-xs uppercase">{addressMessage}</p>
                            )}
                        </div>
                    )}
                </div>
            )}

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
                    <Link href="/recorrencia" className="cta-button w-full justify-between" style={{ background: 'white' }}>
                        MINHA RECORRÊNCIA
                        <Recycle size={20} />
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
