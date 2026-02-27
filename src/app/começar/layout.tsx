"use client";

import { useAuth } from "@/contexts/auth-context";
import { ProtectedRouteGate } from "@/components/protected-route-gate";
import { Loader2, ArrowLeft } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
    const { user, profile, isLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    // Progress mapping
    const steps = [
        { path: "/começar", label: "Início" },
        { path: "/começar/bairro", label: "Bairro" },
        { path: "/começar/modo", label: "Modo" },
        { path: "/começar/endereco", label: "Endereço" },
        { path: "/começar/acao", label: "Ação" }
    ];

    const currentStepIndex = steps.findIndex(s => s.path === pathname);
    const progressPercent = ((currentStepIndex + 1) / steps.length) * 100;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    return (
        <ProtectedRouteGate>
            <div className="max-w-md mx-auto min-h-screen bg-white shadow-xl flex flex-col p-6 animate-slide-up">
                {/* Header / Nav */}
                <div className="flex items-center justify-between mb-8">
                    {currentStepIndex > 0 ? (
                        <button onClick={() => router.back()} className="p-2 border-2 border-foreground hover:bg-primary transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                    ) : <div className="w-10" />}

                    <div className="text-center">
                        <span className="stencil-text text-xl bg-primary px-2 border-2 border-foreground">COOP ECO</span>
                    </div>
                    <div className="w-10" />
                </div>

                {/* Progress Bar */}
                <div className="mb-8 space-y-1">
                    <div className="flex justify-between text-[10px] font-black uppercase">
                        <span>Passo {currentStepIndex + 1} de {steps.length}</span>
                        <span>{Math.round(progressPercent)}%</span>
                    </div>
                    <div className="w-full bg-muted border-2 border-foreground h-4 overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                    {children}
                </div>
            </div>
        </ProtectedRouteGate>
    );
}
