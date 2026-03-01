"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Loader2, Rocket } from "lucide-react";

export default function InviteEntryPage({ params }: { params: { code: string } }) {
    const { code } = params;
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        async function resolveInvite() {
            try {
                // 1. Resolve code
                const { data: invite, error: inviteError } = await supabase
                    .from("invite_codes")
                    .select("*, neighborhood:neighborhoods(name, slug), drop_point:eco_drop_points(name)")
                    .eq("code", code)
                    .eq("active", true)
                    .maybeSingle();

                if (inviteError) throw inviteError;
                if (!invite) {
                    setError("Convite inválido ou expirado.");
                    return;
                }

                // 2. Log event (opened)
                await supabase.from("invite_events").insert({
                    code_id: invite.id,
                    event_kind: "opened"
                });

                // 3. Store context in localStorage
                const context = {
                    code: invite.code,
                    scope: invite.scope,
                    neighborhoodId: invite.neighborhood_id,
                    neighborhoodSlug: invite.neighborhood?.slug,
                    dropPointId: invite.drop_point_id,
                    dropPointName: invite.drop_point?.name
                };
                localStorage.setItem("eco_invite_context", JSON.stringify(context));

                // 4. Redirect to onboarding
                router.push("/começar");
            } catch (err) {
                setError("Erro ao processar convite.");
                console.error(err);
            }
        }

        resolveInvite();
    }, [code, router, supabase]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-slide-up">
                <div className="card border-accent border-4 p-8 max-w-sm">
                    <h1 className="stencil-text text-2xl mb-4 text-accent">OPS!</h1>
                    <p className="font-bold uppercase text-sm mb-6">{error}</p>
                    <button
                        onClick={() => router.push("/")}
                        className="cta-button w-full"
                    >
                        VOLTAR PARA O INÍCIO
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-pulse">
            <Rocket size={64} className="text-primary mb-6" />
            <h1 className="stencil-text text-3xl mb-2">CONECTANDO...</h1>
            <p className="font-bold uppercase text-xs opacity-60">Entrando no ritmo do seu bairro.</p>
            <Loader2 className="animate-spin text-primary mt-8" size={32} />
        </div>
    );
}
