"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { Mail, Loader2, ArrowRight } from "lucide-react"

export function LoginForm() {
    const [email, setEmail] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSent, setIsSent] = useState(false)
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: window.location.origin + '/perfil',
                }
            })
            if (error) throw error
            setIsSent(true)
        } catch (err) {
            console.error(err)
            alert("Erro ao enviar link. Verifique o email.")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isSent) {
        return (
            <div className="card text-center py-12 animate-slide-up">
                <Mail size={48} className="mx-auto mb-4 text-primary" />
                <h3 className="stencil-text text-xl mb-2">LINK ENVIADO!</h3>
                <p style={{ fontWeight: 700 }}>VERIFIQUE SUA CAIXA DE ENTRADA E CLIQUE NO LINK PARA ENTRAR.</p>
                <button
                    onClick={() => setIsSent(false)}
                    className="mt-6 text-sm font-black underline uppercase"
                >
                    TENTAR OUTRO EMAIL
                </button>
            </div>
        )
    }

    return (
        <div className="animate-slide-up">
            <h2 className="stencil-text" style={{ fontSize: '1.5rem', marginBottom: '1.5rem', background: 'var(--primary)', padding: '0 8px', border: '2px solid var(--foreground)', width: 'fit-content' }}>
                ENTRAR NO ECO
            </h2>
            <p style={{ fontWeight: 700, marginBottom: '2rem' }}>VAMOS CONECTAR VOCÊ À REDE DO BEM.</p>

            <form onSubmit={handleLogin} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <label className="stencil-text text-sm">SEU MELHOR EMAIL</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={20} />
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-4 pl-12 border-2 border-foreground bg-white font-bold uppercase focus:bg-primary transition-colors outline-none"
                            placeholder="VOCO@EXEMPLO.COM"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="cta-button w-full justify-center py-6 mt-4"
                >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : (
                        <>
                            ENVIAR ACESSO RÁPIDO
                            <ArrowRight size={20} />
                        </>
                    )}
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
        .text-center { text-align: center; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mt-6 { margin-top: 1.5rem; }
      `}</style>
        </div>
    )
}
