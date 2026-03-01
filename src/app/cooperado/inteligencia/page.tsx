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

type ZoneLoad = {
    zone_id: string;
    neighborhood_id: string;
    requests_count: number;
    receipts_count: number;
    ok_rate: number;
    avg_lat: number;
    avg_lng: number;
};

export default function CooperadoInteligenciaPage() {
    const { user, profile } = useAuth();
    const p = profile as Profile;
    const supabase = useMemo(() => createClient(), []);

    const [windowLoads, setWindowLoads] = useState<WindowLoad[]>([]);
    const [windowQualities, setWindowQualities] = useState<Record<string, WindowQuality>>({});
    const [opsAlerts, setOpsAlerts] = useState<any[]>([]);
    const [activeIncidents, setActiveIncidents] = useState<any[]>([]);
    const [topZones, setTopZones] = useState<ZoneLoad[]>([]);
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

                // Fetch Active Incidents for the neighborhood/cell
                const { data: incData } = await supabase
                    .from("eco_incidents")
                    .select("*, playbook_card:eco_playbook_cards(*)")
                    .neq("status", "resolved")
                    .or(`neighborhood_id.eq.${p.neighborhood_id},cell_id.eq.${p.cell_id}`);

                setActiveIncidents(incData || []);

                // Fetch Top 3 Zones (A15.2)
                const { data: zonesData } = await supabase
                    .from('v_zone_load_14d')
                    .select('*')
                    .eq('neighborhood_id', p.neighborhood_id)
                    .order('requests_count', { ascending: false })
                    .limit(3);
                setTopZones(zonesData || []);
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
                        {/* Runbook Actions (What to do now?) */}
                        {activeIncidents.length > 0 && (
                            <section className="animate-bounce-subtle">
                                <h2 className="stencil-text text-xl mb-4 flex items-center gap-2 text-accent">
                                    <AlertCircle /> RESPOSTA A INCIDENTE
                                </h2>
                                <div className="flex flex-col gap-4">
                                    {activeIncidents.map(inc => (
                                        <div key={inc.id} className="card bg-accent text-white border-2 border-foreground p-5">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <span className="font-black text-[10px] uppercase bg-white text-accent px-1 mb-1 inline-block">
                                                        {inc.kind.replace('_', ' ')} / {inc.severity}
                                                    </span>
                                                    <h3 className="stencil-text text-lg">{inc.playbook_card?.title || 'INCIDENTE ATIVO'}</h3>
                                                </div>
                                                <AlertCircle size={32} className="opacity-40" />
                                            </div>

                                            <div className="space-y-3">
                                                <div className="bg-black/10 p-3 border-l-4 border-white">
                                                    <p className="font-black text-[10px] uppercase mb-1 opacity-70">O que fazer agora:</p>
                                                    <p className="font-bold text-sm leading-tight italic">
                                                        {inc.playbook_card?.immediate_actions?.[0] || 'Aguarde orientações da coordenação.'}
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                                    <div>
                                                        <p className="font-black text-[10px] uppercase opacity-70 mb-1">Diagnóstico:</p>
                                                        <p className="text-[10px] font-bold uppercase leading-tight">
                                                            {inc.playbook_card?.diagnosis_steps || 'Verifique o local e a qualidade.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
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

                        {/* Top 3 Zonas de Demanda (A15.2) */}
                        <section className="animate-slide-up">
                            <h2 className="stencil-text text-xl mb-4 flex items-center gap-2">
                                <BarChart3 className="text-primary" /> TOP 3 ZONAS DE DEMANDA
                            </h2>
                            <div className="flex flex-col gap-3">
                                {topZones.length === 0 ? (
                                    <div className="card text-center py-6 bg-muted/10 border-dashed">
                                        <p className="font-bold uppercase text-[10px] opacity-40">DADOS DE CALOR INDISPONÍVEIS (K &lt; 5)</p>
                                    </div>
                                ) : (
                                    topZones.map((zone, i) => (
                                        <div key={i} className="card p-4 border-2 border-foreground flex justify-between items-center bg-white shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                                            <div className="flex flex-col">
                                                <span className="font-black text-[10px] uppercase opacity-60">ZONA DE ALTA CARGA</span>
                                                <p className="font-black text-xs uppercase leading-tight">CÉLULA {zone.zone_id.replace('Z:', '').replaceAll(':', ' / ')}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-black text-primary">{zone.requests_count}</p>
                                                <p className="text-[8px] font-black uppercase opacity-60">PEDIDOS TOTAIS</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <p className="text-[9px] font-bold uppercase mt-3 opacity-50 italic">
                                * ESTIMATIVA BASEADA NOS ÚLTIMOS 14 DIAS PARA ORIENTAR O DESLOCAMENTO.
                            </p>
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
