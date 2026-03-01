"use client";

import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Recycle, Calendar, ArrowRight, Star, ExternalLink, BookOpen } from "lucide-react";
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

    const [launchControl, setLaunchControl] = useState<any>(null);
    const [hasGrant, setHasGrant] = useState(false);

    useEffect(() => {
        if (!user || !p?.neighborhood_id) return;
        async function load() {
            setLoading(true);
            const { data: sData } = await supabase
                .from("onboarding_state")
                .select("*")
                .eq("user_id", user?.id)
                .maybeSingle();
            setState(sData);

            if (!user?.id || !p?.neighborhood_id) return;

            // Fetch Access Grant
            const { data: grant } = await supabase
                .from("eco_access_grants")
                .select("id")
                .eq("user_id", user.id)
                .eq("active", true)
                .maybeSingle();
            setHasGrant(!!grant);

            // Fetch Launch Control
            const { data: control } = await supabase
                .from("eco_launch_controls")
                .select("*")
                .or(`scope.eq.global,and(scope.eq.neighborhood,neighborhood_id.eq.${p.neighborhood_id})`)
                .order("scope", { ascending: false })
                .limit(1);
            setLaunchControl(control?.[0] || null);

            const { data: wData } = await supabase
                .from("route_windows")
                .select("*")
                .eq("neighborhood_id", p.neighborhood_id)
                .eq("active", true)
                .order("weekday")
                .limit(1);

            setNextWindow(wData?.[0] || null);
            setLoading(false);
        }
        load();
    }, [user, p?.neighborhood_id, supabase]);

    const completeOnboarding = async (e: React.MouseEvent) => {
        if (!user || !p?.neighborhood_id) return;

        // If not open and no grant, blocking is handled by UI, 
        // but it's safer to check here too if they force a navigation.
        if (launchControl?.open_mode === 'invite_only' && !hasGrant) {
            e.preventDefault();
            alert("Abertura controlada. Você precisa de um grant de acesso.");
            return;
        }

        // Auto-grant if open mode is 'open'
        if (launchControl?.open_mode === 'open' && !hasGrant) {
            await supabase.from("eco_access_grants").upsert({
                user_id: user.id,
                neighborhood_id: p.neighborhood_id,
                granted_via: 'auto'
            });
        }

        await supabase
            .from("onboarding_state")
            .update({ step: 'done', completed_at: new Date().toISOString() })
            .eq("user_id", user.id);

        // Log first_action_done if invite context exists
        try {
            const stored = localStorage.getItem("eco_invite_context");
            if (stored) {
                const context = JSON.parse(stored);
                // We need the invite_id. We can fetch it once or assume it's valid to find by code again.
                const { data: invite } = await supabase.from("invite_codes").select("id").eq("code", context.code).maybeSingle();
                if (invite) {
                    await supabase.from("invite_events").insert({
                        code_id: invite.id,
                        event_kind: 'first_action_done'
                    });

                    // Also grant access via invite if not already granted
                    if (!hasGrant) {
                        await supabase.from("eco_access_grants").upsert({
                            user_id: user.id,
                            neighborhood_id: p.neighborhood_id,
                            granted_via: 'invite'
                        });
                    }
                }
                localStorage.removeItem("eco_invite_context");
            }
        } catch (e) {
            console.error("Failed to log first action conversion", e);
        }
    };

    if (loading) return null;

    const weekdayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    const isBlocked = (!launchControl?.is_open || (launchControl?.open_mode === 'invite_only' && !hasGrant));

    // For better UX, show the reason if blocked by ramp
    const [rampStatus, setRampStatus] = useState<any>(null);
    useEffect(() => {
        if (p?.neighborhood?.slug) {
            supabase.from("v_ramp_public_status")
                .select("*")
                .eq("slug", p.neighborhood.slug)
                .maybeSingle()
                .then(({ data }) => setRampStatus(data));
        }
    }, [p?.neighborhood?.slug, supabase]);

    return (
        <div className="flex flex-col gap-8 animate-slide-up">
            <div className="space-y-1 text-center">
                <h2 className="stencil-text text-3xl uppercase">
                    {isBlocked ? "Acesso Restrito" : "Tudo pronto!"}
                </h2>
                <p className="font-bold text-xs text-muted-foreground uppercase">
                    {isBlocked ? "ECO em fase de implantação controlada." : "Você já faz parte da logística do comum."}
                </p>
            </div>

            <div className="flex flex-col gap-4">
                {isBlocked ? (
                    <div className="card border-2 border-accent bg-accent/5 p-6 text-center space-y-4">
                        <p className="font-black text-xs uppercase leading-tight">
                            {rampStatus?.reason || "Este bairro está operando via convites no momento para garantir trabalho digno."}
                        </p>
                        <div className="flex flex-col gap-2">
                            <Link href={`/bairros/${p?.neighborhood?.slug}/boletim`} className="cta-button small w-full justify-center" style={{ background: 'white' }}>
                                VER BOLETIM DO BAIRRO
                            </Link>
                            <Link href="/feedback" className="text-[10px] font-black uppercase underline">
                                SOLICITAR ACESSO / ENVIAR FEEDBACK
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
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
                    </>
                )}
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

                <Link
                    href={`/bairros/${p?.neighborhood?.slug}/semana`}
                    className="card flex items-center justify-between p-4 hover:bg-primary/5 transition-colors border-primary/20"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-primary text-white p-2 border-2 border-primary">
                            <BookOpen size={16} />
                        </div>
                        <div>
                            <p className="font-black text-xs uppercase text-balance leading-tight">Ritual da Primeira Semana</p>
                            <p className="text-[8px] font-bold uppercase opacity-60">Aprenda a separar do jeito certo</p>
                        </div>
                    </div>
                    <ArrowRight size={16} className="text-primary" />
                </Link>
            </div>
        </div>
    );
}
