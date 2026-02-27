"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Neighborhood } from "@/types/eco";
import Link from "next/link";
import { Recycle, ArrowRight, TrendingUp, ShieldCheck, MapPin, FileText } from "lucide-react";

export default function HomeClient() {
    const [pilot, setPilot] = useState<any | null>(null);
    const [onboarding, setOnboarding] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        async function load() {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            const [programRes, onboardingRes] = await Promise.all([
                supabase
                    .from("pilot_programs")
                    .select("*, neighborhoods:pilot_program_neighborhoods(neighborhood:neighborhoods(*))")
                    .eq("status", "active")
                    .limit(1)
                    .maybeSingle(),
                user ? supabase
                    .from("onboarding_state")
                    .select("*")
                    .eq("user_id", user.id)
                    .maybeSingle() : Promise.resolve({ data: null })
            ]);

            const program = programRes.data;
            if (program && program.neighborhoods && program.neighborhoods.length > 0) {
                setPilot({
                    ...program,
                    neighborhood: program.neighborhoods[0].neighborhood
                });
            }

            setOnboarding(onboardingRes.data);
            setLoading(false);
        }
        load();
    }, [supabase]);

    return (
        <div className="animate-slide-up">
            <section className="hero" style={{ padding: '3rem 0', textAlign: 'left', borderBottom: '4px solid var(--foreground)' }}>
                <h1 className="stencil-text" style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', lineHeight: '0.9', marginBottom: '1.5rem' }}>
                    Sua ação vira <span style={{ background: 'var(--primary)', padding: '0 10px' }}>impacto</span>.
                </h1>
                <p style={{ fontSize: '1.1rem', fontWeight: 600, maxWidth: '600px', marginBottom: '2.5rem' }}>
                    REDE SOCIAL DO BEM: RECICLAGEM GERA RECIBO E ORGULHO LOCAL.
                </p>

                {onboarding && onboarding.step !== 'done' && (
                    <div className="card bg-accent text-white p-4 mb-8 flex flex-col md:flex-row justify-between items-center gap-4 animate-slide-up border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                        <div className="flex items-center gap-3">
                            <Recycle className="animate-spin-slow" />
                            <div>
                                <p className="font-black text-xs uppercase">Onboarding Pendente</p>
                                <p className="font-bold text-[10px] uppercase opacity-90">Complete seu início para liberar todas as funções (30s).</p>
                            </div>
                        </div>
                        <Link href="/começar" className="bg-white text-accent px-4 py-2 font-black text-xs uppercase border-2 border-black hover:bg-zinc-100 transition-colors">
                            CONTINUAR
                        </Link>
                    </div>
                )}

                <div className="flex flex-wrap gap-4 mb-4">
                    <Link href="/pedir-coleta" className="cta-button">
                        <Recycle size={28} />
                        Pedir coleta agora
                        <ArrowRight size={24} />
                    </Link>

                    {pilot?.neighborhood && (
                        <Link href={`/bairros/${pilot.neighborhood.slug}/boletim`} className="cta-button" style={{ background: 'white' }}>
                            <FileText size={28} />
                            Boletim da Semana
                        </Link>
                    )}
                </div>
            </section>

            {pilot?.neighborhood && (
                <section className="mt-12 mb-12">
                    <div className="card bg-primary/10 border-primary p-8">
                        <div className="flex items-center gap-2 mb-4">
                            <MapPin className="text-primary" size={24} />
                            <span className="stencil-text text-xl">BAIRRO PILOTO ATIVO: {pilot.neighborhood.name.toUpperCase()}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="font-black text-sm uppercase mb-3">PLANO DO BAIRRO</h3>
                                <div className="prose prose-sm font-bold uppercase text-xs text-muted-foreground whitespace-pre-wrap">
                                    {pilot.notes_public || "Ritual diário de coletas e transparência total para o bairro."}
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                <h3 className="font-black text-sm uppercase mb-3">RECIBO COMO LEI</h3>
                                <div className="bg-white border-2 border-foreground p-4 text-balance">
                                    <p className="font-black text-sm uppercase">Transparência sanitizada: veja os resultados agregados da semana sem exposição de dados sensíveis.</p>
                                </div>
                                <Link href={`/bairros/${pilot.neighborhood.slug}/boletim`} className="cta-button small w-fit mt-2">
                                    VER BOLETIM COMPLETO
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {!loading && !pilot && (
                <section className="mt-12">
                    <div className="card border-dashed">
                        <p className="font-black text-xs uppercase text-center py-4">Nenhum bairro piloto ativo no momento. Aguarde atualizações.</p>
                    </div>
                </section>
            )}

            <section style={{ marginTop: '3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
                    <h2 className="stencil-text" style={{ fontSize: '1.75rem' }}>Destaques / News</h2>
                    <Link href="/mural" style={{ fontWeight: 800, textDecoration: 'underline', color: 'var(--accent)' }}>VER TUDO</Link>
                </div>

                <div className="card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <div style={{ background: 'var(--primary)', padding: '1rem', border: '2px solid var(--foreground)' }}>
                        <TrendingUp size={32} />
                    </div>
                    <div>
                        <h3 className="stencil-text" style={{ fontSize: '1.25rem' }}>Transparência Ativa</h3>
                        <p style={{ fontWeight: 600, color: '#404040' }}>TODOS OS LOTES PROCESSADOS AGORA SÃO PÚBLICOS NO DASHBOARD.</p>
                    </div>
                </div>
            </section>

            <style jsx>{`
        .flex { display: flex; }
        .flex-wrap { flex-wrap: wrap; }
        .gap-4 { gap: 1rem; }
        .mb-4 { margin-bottom: 1rem; }
        .grid { display: grid; }
        .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
        @media (min-width: 768px) {
          .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
        </div>
    )
}
