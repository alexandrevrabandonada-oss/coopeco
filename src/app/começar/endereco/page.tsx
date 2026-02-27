"use client";

import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MapPin, ArrowRight, Save } from "lucide-react";

export default function OnboardingAddress() {
    const { user } = useAuth();
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);
    const [address, setAddress] = useState("");
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !address.trim() || !phone.trim()) return;
        setLoading(true);

        const [aUpdate, oUpdate] = await Promise.all([
            supabase.from("pickup_address_profiles").upsert({
                user_id: user.id,
                address_full: address.trim(),
                contact_phone: phone.trim()
            }, { onConflict: 'user_id' }),
            supabase.from("onboarding_state").update({ step: 'first_action' }).eq("user_id", user.id)
        ]);

        if (aUpdate.error || oUpdate.error) {
            alert("Erro ao salvar endereço.");
            setLoading(false);
        } else {
            router.push("/começar/acao");
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-slide-up">
            <div className="space-y-1">
                <h2 className="stencil-text text-2xl uppercase">Onde é o ponto de encontro?</h2>
                <p className="font-bold text-xs text-muted-foreground uppercase">Precisamos saber exatamente onde buscar.</p>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1">
                    <span className="font-black text-[10px] uppercase">Endereço Completo</span>
                    <textarea
                        required
                        className="field min-h-[100px]"
                        placeholder="RUA, NÚMERO, BLOCO, APTO..."
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                    />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="font-black text-[10px] uppercase">Telefone de Contato</span>
                    <input
                        required
                        type="tel"
                        className="field"
                        placeholder="(00) 00000-0000"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                    />
                </label>

                <button
                    disabled={loading || !address.trim() || !phone.trim()}
                    className="cta-button w-full justify-center mt-4"
                >
                    {loading ? "Salvando..." : "CONTINUAR"}
                    <ArrowRight size={20} />
                </button>
            </form>

            <div className="p-4 bg-muted/20 border-l-4 border-foreground">
                <p className="text-[10px] font-bold leading-tight uppercase">
                    <span className="font-black">PRIVACIDADE:</span> Seu endereço é visto apenas pelos cooperados durante a rota oficial.
                </p>
            </div>
        </div>
    );
}
