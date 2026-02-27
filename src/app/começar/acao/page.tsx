"use client";

import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Recycle, Calendar, ArrowRight, Star, ExternalLink } from "lucide-react";
import { OnboardingState, RouteWindow } from "@/types/eco";
import Link from "next/link";

export default function OnboardingAction() {
    const { user, profile } = useAuth();
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);
    const [state, setState] = useState<OnboardingState | null>(null);
    const [nextWindow, setNextWindow] = useState<RouteWindow | null>(null);
    const [loading, setLoading] = useState(true);

    const p = profile as { neighborhood_id?: string, neighborhood?: { slug: string } } | null;

    useEffect(() => {
        if (!user || !p?.neighborhood_id) return;
        async function load() {
            const { data: sData } = await supabase
                .from("onboarding_state")
                .select("*")
                .eq("user_id", user?.id)
                .maybeSingle();
            setState(sData);

            if (p?.neighborhood_id) {
                const { data: wData } = await supabase
                    .from("route_windows")
                    .select("*")
                    .eq("neighborhood_id", p.neighborhood_id)
                    .eq("active", true)
                    .order("weekday")
                    .limit(1);

                setNextWindow(wData?.[0] || null);
            }
            setLoading(false);
        }
        load();
    }, [user, p?.neighborhood_id, supabase]);

    const completeOnboarding = async () => {
        if (!user) return;
        await supabase
            .from("onboarding_state")
            .update({ step: 'done', completed_at: new Date().toISOString() })
            .eq("user_id", user.id);
    };

    if (loading) return null;

    const weekdayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    return (
        <div className="flex flex-col gap-8 animate-slide-up">
            <div className="space-y-1 text-center">
                <h2 className="stencil-text text-3xl uppercase">Tudo pronto!</h2>
                <p className="font-bold text-xs text-muted-foreground uppercase">Você já faz parte da logística do comum.</p>
            </div>

            <div className="flex flex-col gap-4">
                {/* Sugestão de Janela */}
                {nextWindow && (
                    <div className="card bg-primary/10 border-primary p-4 flex flex-col items-center text-center gap-1">
                        <span className="font-black text-[10px] uppercase text-primary">Próxima janela estimada</span>
                        <div className="flex items-center gap-2">
                            <Calendar size={16} />
                            <span className="font-black text-sm uppercase">
                                {weekdayNames[nextWindow.weekday]} • {nextWindow.start_time.slice(0, 5)}
                            </span>
                        </div>
                    </div>
                )}

                {/* CTA Primário */}
                <Link
                    href="/pedir-coleta"
                    onClick={completeOnboarding}
                    className="cta-button w-full justify-between h-auto py-6"
                >
                    <div className="flex flex-col items-start gap-1">
                        <span className="text-xl">PEDIR PRIMEIRA COLETA</span>
                        <span className="text-[10px] font-black uppercase text-primary-foreground opacity-80">
                            Já escolhemos seu modo {state?.chosen_mode === 'drop_point' ? 'PONTO ECO' : 'NA PORTA'}
                        </span>
                    </div>
                    <ArrowRight size={28} />
                </Link>

                {/* CTA Secundário */}
                <Link
                    href="/recorrencia"
                    onClick={completeOnboarding}
                    className="cta-button w-full justify-between h-auto py-6"
                    style={{ background: 'white' }}
                >
                    <div className="flex flex-col items-start gap-1">
                        <span className="text-lg">ASSINAR RECORRÊNCIA</span>
                        <span className="text-[10px] font-black uppercase text-muted-foreground">
                            Deixar agendado semanalmente
                        </span>
                    </div>
                    <Calendar size={28} />
                </Link>
            </div>

            <div className="flex flex-col gap-4">
                <h3 className="stencil-text text-sm uppercase text-center text-muted-foreground">Extra: Bairro Piloto</h3>
                <Link
                    href={`/bairros/${p?.neighborhood?.slug}/boletim`}
                    className="card flex items-center justify-between p-4 hover:bg-muted/5 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-foreground text-white p-2 border-2 border-foreground">
                            <Star size={16} />
                        </div>
                        <p className="font-black text-xs uppercase text-balance leading-tight">Ver Plano de Transparência do seu Bairro</p>
                    </div>
                    <ExternalLink size={16} />
                </Link>
            </div>
        </div>
    );
}
