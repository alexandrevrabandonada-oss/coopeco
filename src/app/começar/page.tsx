"use client";

import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Rocket, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

export default function OnboardingStart() {
    const router = useRouter();
    const { user } = useAuth();
    const supabase = useMemo(() => createClient(), []);
    const [loading, setLoading] = useState(false);

    const handleStart = async () => {
        if (!user) return;
        setLoading(true);
        // Initialize or update onboarding state
        const { error } = await supabase.from("onboarding_state").upsert({
            user_id: user.id,
            step: 'neighborhood'
        });

        if (error) {
            console.error(error);
            setLoading(false);
        } else {
            router.push("/começar/bairro");
        }
    };

    return (
        <div className="flex flex-col items-center text-center gap-8 py-12">
            <div className="bg-primary p-6 border-2 border-foreground shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
                <Rocket size={64} className="animate-pulse" />
            </div>

            <div className="space-y-4">
                <h1 className="stencil-text text-4xl leading-tight">VAMOS ORGANIZAR SUA ROTA</h1>
                <p className="font-bold text-lg leading-snug">
                    Sem likes. Com prova e cuidado. Sua cidade primeiro.
                </p>
            </div>

            <button
                disabled={loading}
                onClick={handleStart}
                className="cta-button w-full justify-center text-xl py-6"
            >
                {loading ? "Iniciando..." : "COMEÇAR AGORA"}
                <ArrowRight size={24} />
            </button>

            <p className="text-[10px] font-black uppercase text-muted-foreground">
                Leva menos de 60 segundos para começar a sua primeira ação.
            </p>
        </div>
    );
}
