"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { ProtectedRouteGate } from "@/components/protected-route-gate";
import {
    BarChart3,
    MapPin,
    Clock,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Users
} from "lucide-react";
import { Profile } from "@/types/eco";
import { formatWindowLabel } from "@/lib/route-windows";

type WindowLoad = {
    window_id: string;
    neighborhood_id: string;
    weekday: number;
    start_time: string;
    end_time: string;
    scheduled_date: string;
    capacity: number;
    requests_total: number;
    status_bucket: 'ok' | 'warning' | 'critical';
};

type WindowQuality = {
    window_id: string;
    receipts_count: number;
    ok_rate: number;
    top_flags: string[];
};

export default function CooperadoInteligenciaPage() {
    const { user, profile } = useAuth();
    const p = profile as Profile;
    const supabase = useMemo(() => createClient(), []);

    const [windowLoads, setWindowLoads] = useState<WindowLoad[]>([]);
    const [windowQualities, setWindowQualities] = useState<Record<string, WindowQuality>>({});
    const [opsAlerts, setOpsAlerts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!p?.neighborhood_id) return;

        const loadIntel = async () => {
            setIsLoading(true);
            try {
                // Refresh alerts
                await supabase.rpc('rpc_refresh_ops_alerts', { p_neighborhood_id: p.neighborhood_id });

                const [loadsRes, qualityRes, alertsRes] = await Promise.all([
                    supabase.from("v_window_load_7d")
                        .select("*")
                        .eq("neighborhood_id", p.neighborhood_id)
                        .order("scheduled_date", { ascending: true }),
                    supabase.from("v_window_quality_7d").select("*"),
                    supabase.from("ops_alerts")
                        .select("*")
                        .eq("neighborhood_id", p.neighborhood_id)
                        .eq("active", true)
                ]);

                if (loadsRes.data) setWindowLoads(loadsRes.data as WindowLoad[]);
                if (qualityRes.data) {
                    const qualMap: Record<string, WindowQuality> = {};
                    qualityRes.data.forEach((q: any) => {
                        qualMap[q.window_id] = q as WindowQuality;
                    });
                    setWindowQualities(qualMap);
                }
                if (alertsRes.data) {
                    setOpsAlerts(alertsRes.data);
                }
            } catch (err) {
                console.error("Error loading cooperado intelligence:", err);
            } finally {
                setIsLoading(false);
            }
        };

        loadIntel();
    }, [p?.neighborhood_id, supabase]);

    return (
        <ProtectedRouteGate>
            <div className="animate-slide-up pb-12">
                <header className="mb-8">
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="text-primary" size={24} />
                        <span className="font-black uppercase text-sm tracking-widest text-muted">MÓDULO COOPERADO</span>
                    </div>
                    <h1 className="stencil-text" style={{ fontSize: '2.4rem' }}>
                        PULSO OPERACIONAL
                    </h1>
                    <p className="font-bold uppercase text-xs opacity-60 flex items-center gap-2">
                        <MapPin size={14} /> {p?.neighborhood_id ? 'Bairro Vinculado' : 'Sem Bairro'}
                    </p>
                </header>

                {isLoading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="animate-spin text-primary" size={48} />
                    </div>
                ) : !p?.neighborhood_id ? (
                    <div className="card text-center py-12">
                        <AlertCircle className="mx-auto mb-4 text-accent" size={48} />
                        <h2 className="stencil-text mb-2">Bairro não configurado</h2>
                        <p className="font-bold uppercase text-sm">Você precisa estar vinculado a um bairro para ver os dados da rota.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-8">
                        {/* Próximas Rotas */}
                        <section>
                            <h2 className="stencil-text text-xl mb-4 flex items-center gap-2">
                                <Clock /> PRÓXIMAS COLETAS
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {windowLoads.length === 0 ? (
                                    <p className="font-bold uppercase text-xs text-muted">Nenhuma rota programada.</p>
                                ) : (
                                    windowLoads.map((wl, i) => (
                                        <div
                                            key={i}
                                            className={`card p-5 border-2 flex justify-between items-center ${wl.status_bucket === 'critical' ? 'border-accent bg-[#fff4f4]' : 'border-foreground'
                                                }`}
                                        >
                                            <div>
                                                <p className="font-black text-xs uppercase mb-1">{formatWindowLabel(wl as any)}</p>
                                                <p className="font-bold text-[10px] opacity-60">{new Date(wl.scheduled_date).toLocaleDateString('pt-BR')}</p>
                                                <div className="mt-3 flex items-center gap-2">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 border-2 border-foreground ${wl.status_bucket === 'critical' ? 'bg-accent text-white' : 'bg-primary'
                                                        }`}>
                                                        {wl.status_bucket === 'critical' ? 'LOTADO' : wl.status_bucket === 'warning' ? 'CARREGADO' : 'NORMAL'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black uppercase text-muted mb-1">Fila prevista</p>
                                                <p className="text-3xl font-black">{wl.requests_total}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>

                        {/* Qualidade e Tendências */}
                        <section>
                            <h2 className="stencil-text text-xl mb-4 flex items-center gap-2">
                                <CheckCircle2 /> O QUE FICAR DE OLHO (7D)
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.values(windowQualities).length === 0 ? (
                                    <p className="font-bold uppercase text-xs text-muted">Sem alertas de qualidade esta semana.</p>
                                ) : (
                                    Object.values(windowQualities).map((wq, i) => {
                                        const wl = windowLoads.find(l => l.window_id === wq.window_id);
                                        return (
                                            <div key={i} className="card p-4">
                                                <h3 className="font-black text-[10px] uppercase mb-3 border-b-2 border-muted pb-2">
                                                    {wl ? formatWindowLabel(wl as any) : 'Resumo da Rota'}
                                                </h3>
                                                <div className="flex flex-col gap-2">
                                                    {wq.top_flags.length === 0 ? (
                                                        <p className="text-[10px] font-bold uppercase text-primary">Qualidade impecável!</p>
                                                    ) : (
                                                        wq.top_flags.map((flag, j) => (
                                                            <div key={j} className="flex items-center gap-2">
                                                                <AlertCircle size={14} className="text-accent" />
                                                                <span className="text-[10px] font-black uppercase">{flag}</span>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <div className="mt-6 border-2 border-dashed border-foreground p-4 bg-muted/30">
                                <p className="font-bold text-xs uppercase leading-tight">
                                    <span className="text-accent">Dica:</span> Use esses indicadores para orientar os moradores durante a coleta.
                                    Explique como evitar contaminantes mais comuns da semana.
                                </p>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </ProtectedRouteGate>
    );
}
