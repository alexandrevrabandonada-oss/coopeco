"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { Neighborhood } from "@/types/eco"
import { useAuth } from "@/contexts/auth-context"
import { Loader2, MapPin, User as UserIcon } from "lucide-react"

export function ProfileOnboarding({ onComplete }: { onComplete: () => void }) {
    const { user } = useAuth()
    const [displayName, setDisplayName] = useState("")
    const [neighborhoodId, setNeighborhoodId] = useState("")
    const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const supabase = createClient()

    const loadNeighborhoods = useCallback(async () => {
        const { data } = await supabase.from("neighborhoods").select("*").order("name")
        if (data) setNeighborhoods(data)
    }, [supabase])

    useEffect(() => {
        loadNeighborhoods()
    }, [loadNeighborhoods])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !displayName || !neighborhoodId) return

        setIsSubmitting(true)
        try {
            const { error } = await supabase.from("profiles").insert({
                user_id: user.id,
                display_name: displayName,
                neighborhood_id: neighborhoodId,
                role: 'resident'
            })
            if (error) throw error
            onComplete()
        } catch (err) {
            console.error(err)
            alert("Erro ao criar perfil. Tente novamente.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="animate-slide-up">
            <h2 className="stencil-text" style={{ fontSize: '1.5rem', marginBottom: '1.5rem', background: 'var(--primary)', padding: '0 8px', border: '2px solid var(--foreground)', width: 'fit-content' }}>
                BOAS-VINDAS AO ECO
            </h2>
            <p style={{ fontWeight: 700, marginBottom: '2rem' }}>COMPLETE SEU CADASTRO PARA COMEÇAR A IMPACTAR.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <label className="stencil-text text-sm">COMO QUER SER CHAMADO?</label>
                    <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={20} />
                        <input
                            type="text"
                            required
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full p-4 pl-12 border-2 border-foreground bg-white font-bold uppercase focus:bg-primary transition-colors outline-none"
                            placeholder="SEU APELIDO"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="stencil-text text-sm">QUAL SEU BAIRRO?</label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={20} />
                        <select
                            required
                            value={neighborhoodId}
                            onChange={(e) => setNeighborhoodId(e.target.value)}
                            className="w-full p-4 pl-12 border-2 border-foreground bg-white font-bold uppercase focus:bg-primary transition-colors outline-none appearance-none"
                        >
                            <option value="">SELECIONE SEU TERRITÓRIO</option>
                            {neighborhoods.map((n) => (
                                <option key={n.id} value={n.id}>{n.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="cta-button w-full justify-center py-6 mt-4"
                >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "FINALIZAR CADASTRO"}
                </button>
            </form>

            <style jsx>{`
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .gap-2 { gap: 0.5rem; }
        .gap-6 { gap: 1.5rem; }
        .text-sm { font-size: 0.875rem; }
        .text-muted { color: #737373; }
        .relative { position: relative; }
        .absolute { position: absolute; }
        .left-3 { left: 0.75rem; }
        .top-1/2 { top: 50%; }
        .-translate-y-1/2 { transform: translateY(-50%); }
        .pl-12 { padding-left: 3rem; }
        .w-full { width: 100%; }
      `}</style>
        </div>
    )
}
