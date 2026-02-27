"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { LoginForm } from "@/components/login-form"
import { ProfileOnboarding } from "@/components/profile-onboarding"
import { Loader2, LogOut, User as UserIcon, MapPin, Shield, Recycle, Rocket } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { PickupAddressProfile, ProfileGamificationSummary } from "@/types/eco"

export default function Perfil() {
    const { user, profile, isLoading, signOut } = useAuth()
    const supabase = useMemo(() => createClient(), [])
    const [addressFull, setAddressFull] = useState("")
    const [contactPhone, setContactPhone] = useState("")
    const [isAddressLoading, setIsAddressLoading] = useState(false)
    const [isAddressSaving, setIsAddressSaving] = useState(false)
    const [addressMessage, setAddressMessage] = useState<string | null>(null)
    const [recurringAlertCount, setRecurringAlertCount] = useState(0)
    const [gamification, setGamification] = useState<ProfileGamificationSummary | null>(null)
    const [isGamiLoading, setIsGamiLoading] = useState(false)
    const [activePilot, setActivePilot] = useState<any | null>(null)
    const [onboarding, setOnboarding] = useState<any | null>(null)

    const p = profile as { display_name?: string; role: string; neighborhood_id?: string; neighborhood?: { name: string, slug: string } } | null

    useEffect(() => {
        const run = async () => {
            if (!user) return
            setIsAddressLoading(true)
            setIsGamiLoading(true)
            setAddressMessage(null)

            const [addressRes, notifRes, gamiRes, pilotRes, onboardingRes] = await Promise.all([
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
                supabase
                    .from("v_profile_gamification_summary")
                    .select("*")
                    .eq("user_id", user.id)
                    .maybeSingle<ProfileGamificationSummary>(),
                supabase
                    .from("pilot_programs")
                    .select("*, neighborhoods:pilot_program_neighborhoods(*)")
                    .eq("status", "active")
                    .limit(1)
                    .maybeSingle(),
                supabase
                    .from("onboarding_state")
                    .select("*")
                    .eq("user_id", user.id)
                    .maybeSingle()
            ])

            if (addressRes.error) {
                setAddressMessage(addressRes.error.message)
            } else if (addressRes.data) {
                setAddressFull(addressRes.data.address_full || "")
                setContactPhone(addressRes.data.contact_phone || "")
            }

            // Check if user neighborhood is in the active pilot
            if (p?.neighborhood_id && pilotRes.data?.neighborhoods) {
                const isMember = pilotRes.data.neighborhoods.some((n: any) => n.neighborhood_id === p.neighborhood_id);
                if (isMember) {
                    setActivePilot(pilotRes.data);
                }
            }

            setRecurringAlertCount(notifRes.count || 0)
            setGamification(gamiRes.data)
            setOnboarding(onboardingRes.data)
            setIsAddressLoading(false)
            setIsGamiLoading(false)
        }
        run()
    }, [user, profile?.role, p?.neighborhood_id, supabase])

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
                <div className="flex gap-2">
                    {activePilot && (
                        <div className="hidden md:flex gap-2">
                            <Link href={`/bairros/${p.neighborhood?.slug}/boletim`} className="cta-button small" style={{ background: 'white' }}>
                                Boletim da Semana
                            </Link>
                        </div>
                    )}
                    <button
                        onClick={() => signOut()}
                        className="p-2 border-2 border-foreground bg-accent text-white"
                    >
                        <LogOut size={24} />
                    </button>
                </div>
            </div>

            {activePilot && (
                <div className="card bg-primary/10 border-primary p-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <Rocket className="text-primary" />
                        <div>
                            <p className="font-black text-xs uppercase">Bairro Piloto Ativo</p>
                            <p className="font-bold text-[10px] uppercase text-muted-foreground">Você está participando do ritual "{activePilot.city}"</p>
                        </div>
                    </div>
                    <Link href={`/bairros/${p.neighborhood?.slug}/boletim`} className="cta-button small w-full md:w-fit justify-center">
                        VER BOLETIM DA SEMANA
                    </Link>
                </div>
            )}

            {onboarding && onboarding.step !== 'done' && (
                <div className="card bg-accent text-white p-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                    <div className="flex items-center gap-3">
                        <Recycle size={20} className="animate-spin-slow" />
                        <div>
                            <p className="font-black text-xs uppercase">Onboarding Pendente</p>
                            <p className="font-bold text-[10px] uppercase opacity-90">Complete seu início (30s).</p>
                        </div>
                    </div>
                    <Link href="/começar" className="bg-white text-accent px-4 py-2 font-black text-xs uppercase border-2 border-black hover:bg-zinc-100 transition-colors">
                        CONTINUAR
                    </Link>
                </div>
            )}

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

            {gamification && (
                <section className="mt-8 animate-slide-up">
                    <div className="card border-foreground p-6 relative overflow-hidden"
                        style={{ borderLeft: `8px solid ${gamification.level_color}` }}>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <span className="stencil-text text-[10px] text-muted-foreground uppercase">Nível atual</span>
                                <h3 className="stencil-text text-2xl" style={{ color: gamification.level_color }}>
                                    {gamification.level_name.toUpperCase()}
                                </h3>
                            </div>
                            <div className="text-right">
                                <span className="stencil-text text-[10px] text-muted-foreground uppercase">Impacto Total</span>
                                <p className="font-black text-2xl">{gamification.impact_score}</p>
                            </div>
                        </div>

                        {gamification.next_level_min && (
                            <div className="mb-4">
                                <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                                    <span>Próximo: {gamification.next_level_name}</span>
                                    <span>{gamification.impact_score} / {gamification.next_level_min}</span>
                                </div>
                                <div className="w-full bg-muted border-2 border-foreground h-4 relative">
                                    <div
                                        className="h-full transition-all duration-1000"
                                        style={{
                                            width: `${Math.min(100, (gamification.impact_score - gamification.level_min) / (gamification.next_level_min - gamification.level_min) * 100)}%`,
                                            background: gamification.level_color
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <Shield size={16} className="text-primary" />
                            <span className="font-black text-[10px] uppercase">
                                {gamification.badges_count > 0
                                    ? `${gamification.badges_count} Badge(s) conquistado(s)`
                                    : 'Nenhum badge ainda. Continue coletando!'}
                            </span>
                        </div>
                    </div>
                </section>
            )}

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
                    <Link href="/perfil/endereco" className="cta-button w-full justify-between" style={{ background: 'white' }}>
                        ENDEREÇO DE COLETA
                        <MapPin size={20} />
                    </Link>
                    <Link href="/notificacoes" className="cta-button w-full justify-between" style={{ background: 'white' }}>
                        MINHAS NOTIFICAÇÕES
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
