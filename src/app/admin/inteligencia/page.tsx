"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { ProtectedRouteGate } from "@/components/protected-route-gate";
import {
    BarChart3,
    AlertTriangle,
    MapPin,
    Clock,
    CheckCircle2,
    AlertCircle,
    TrendingDown,
    TrendingUp,
    Loader2,
    Filter,
    Plus,
    BarChart,
    ChevronRight,
    X,
    MessageSquare
} from "lucide-react";
import { Neighborhood } from "@/types/eco";
import { formatWindowLabel } from "@/lib/route-windows";

type WindowLoad = {
    window_id: string;
    neighborhood_id: string;
    weekday: number;
    start_time: string;
    end_time: string;
    scheduled_date: string;
    capacity: number;
    requests_scheduled_count: number;
    requests_drop_point_count: number;
    requests_total: number;
    recurring_count: number;
    recurring_coverage_pct: number;
    load_ratio: number;
    status_bucket: 'ok' | 'warning' | 'critical';
};

type WindowQuality = {
    window_id: string;
    receipts_count: number;
    ok_rate: number;
    attention_rate: number;
    contaminated_rate: number;
    top_flags: string[];
};

type DropPointLoad = {
    drop_point_id: string;
    name: string;
    requests_total: number;
    receipts_total: number;
    ok_rate: number;
    top_flags: string[];
    status_bucket: 'ok' | 'warning' | 'critical';
};

export default function AdminInteligenciaPage() {
    const { user } = useAuth();
    const supabase = useMemo(() => createClient(), []);

    const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
    const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string>("");
    const [windowLoads, setWindowLoads] = useState<WindowLoad[]>([]);
    const [windowQualities, setWindowQualities] = useState<Record<string, WindowQuality>>({});
    const [dropPointLoads, setDropPointLoads] = useState<DropPointLoad[]>([]);
    const [inactivePoints, setInactivePoints] = useState<any[]>([]);
    const [opsAlerts, setOpsAlerts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Action Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        type: 'extra_window' | 'capacity_override' | 'promote_drop_point' | null;
        alert?: any;
        entityId?: string;
    }>({ isOpen: false, type: null });
    const [actionForm, setActionForm] = useState({
        date: new Date().toISOString().split('T')[0],
        capacity: 0,
        reason: "",
        startTime: "08:00",
        endTime: "12:00",
        message: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const loadNeighborhoods = async () => {
            const { data } = await supabase.from("neighborhoods").select("*").order("name");
            if (data) {
                setNeighborhoods(data);
                if (data.length > 0) setSelectedNeighborhoodId(data[0].id);
            }
        };
        loadNeighborhoods();
    }, [supabase]);

    useEffect(() => {
        if (!selectedNeighborhoodId) return;

        const loadIntel = async () => {
            setIsLoading(true);
            try {
                // Refresh alerts on load
                await supabase.rpc('rpc_refresh_ops_alerts', { p_neighborhood_id: selectedNeighborhoodId });

                const [loadsRes, qualityRes, dpRes, alertsRes] = await Promise.all([
                    supabase.from("v_window_load_7d")
                        .select("*")
                        .eq("neighborhood_id", selectedNeighborhoodId)
                        .order("scheduled_date", { ascending: true }),
                    supabase.from("v_window_quality_7d").select("*"),
                    supabase.from("v_drop_point_load_7d").select("*"),
                    supabase.from("ops_alerts")
                        .select("*")
                        .eq("neighborhood_id", selectedNeighborhoodId)
                        .eq("active", true)
                        .order("created_at", { ascending: false })
                ]);

                if (loadsRes.data) setWindowLoads(loadsRes.data as WindowLoad[]);
                if (qualityRes.data) {
                    const qualMap: Record<string, WindowQuality> = {};
                    qualityRes.data.forEach((q: any) => {
                        qualMap[q.window_id] = q as WindowQuality;
                    });
                    setWindowQualities(qualMap);
                }
                if (dpRes.data) {
                    setDropPointLoads(dpRes.data as DropPointLoad[]);
                }
                if (alertsRes.data) {
                    setOpsAlerts(alertsRes.data);
                }

                // Fetch Inactive Points (A15.4)
                const { data: inactiveData } = await supabase
                    .from('v_drop_point_inactivity_14d')
                    .select('*')
                    .eq('neighborhood_id', selectedNeighborhoodId)
                    .in('status', ['stale', 'inactive'])
                    .order('days_since_last_request', { ascending: false });
                setInactivePoints(inactiveData || []);
            } catch (err) {
                console.error("Error loading intelligence:", err);
            } finally {
                setIsLoading(false);
            }
        };

        loadIntel();
    }, [selectedNeighborhoodId, supabase]);

    const handleAction = async () => {
        if (!modalConfig.type) return;
        setIsSubmitting(true);
        try {
            if (modalConfig.type === 'capacity_override' || modalConfig.type === 'extra_window') {
                const { error } = await supabase.from('route_window_overrides').insert({
                    window_id: modalConfig.entityId,
                    override_date: actionForm.date,
                    capacity_override: actionForm.capacity,
                    is_extra_window: modalConfig.type === 'extra_window',
                    extra_start_time: modalConfig.type === 'extra_window' ? actionForm.startTime : null,
                    extra_end_time: modalConfig.type === 'extra_window' ? actionForm.endTime : null,
                    reason: actionForm.reason,
                    created_by: user?.id
                });
                if (error) throw error;

                await supabase.from('admin_audit_log').insert({
                    user_id: user?.id,
                    action: modalConfig.type === 'extra_window' ? 'extra_window_created' : 'window_override_created',
                    payload: { window_id: modalConfig.entityId, date: actionForm.date, reason: actionForm.reason }
                });
            } else if (modalConfig.type === 'promote_drop_point') {
                const { error } = await supabase.from('drop_point_promotions').insert({
                    drop_point_id: modalConfig.entityId,
                    neighborhood_id: selectedNeighborhoodId,
                    starts_at: new Date(actionForm.date + 'T00:00:00Z').toISOString(),
                    ends_at: new Date(new Date(actionForm.date + 'T23:59:59Z').getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    message: actionForm.message,
                    created_by: user?.id
                });
                if (error) throw error;

                await supabase.from('admin_audit_log').insert({
                    user_id: user?.id,
                    action: 'drop_point_promoted',
                    payload: { drop_point_id: modalConfig.entityId, message: actionForm.message }
                });
            }

            setModalConfig({ isOpen: false, type: null });
            // Refresh
            const loadIntel = async () => { /* reuse logic or trigger re-render by selectedNeighborhoodId change? Better just call loadIntel again */ };
            setSelectedNeighborhoodId(prev => String(prev)); // Force re-effect
        } catch (err: any) {
            alert("Erro ao realizar ação: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const alerts = useMemo(() => {
        const list: { kind: string; severity: 'warn' | 'critical'; title: string; body: string; alert?: any }[] = [];

        // 1. Add DB-based system alerts (Deduplicated & Persistent)
        opsAlerts.forEach(oa => {
            list.push({
                kind: oa.kind,
                severity: oa.severity as 'warn' | 'critical',
                title: oa.severity === 'critical' ? `🚨 ALERTA: ${oa.kind}` : `⚠️ AVISO: ${oa.kind}`,
                body: oa.message,
                alert: oa
            });
        });

        // 2. Add real-time ephemeral alerts (UI-only for instant feedback if DB hasn't refreshed)
        windowLoads.forEach(wl => {
            if (wl.status_bucket === 'critical' && !opsAlerts.find(oa => oa.entity_id === wl.window_id && oa.kind === 'capacity_critical')) {
                list.push({
                    kind: 'capacity',
                    severity: 'critical',
                    title: `Janela lotada: ${formatWindowLabel(wl as any)}`,
                    body: `Ocupação em ${Math.round(wl.load_ratio * 100)}%. Considere abrir vaga extra ou antecipar rota.`,
                    alert: { entity_id: wl.window_id, kind: 'capacity_critical' }
                });
            }
        });

        return list;
    }, [windowLoads, opsAlerts]);

    return (
        <ProtectedRouteGate>
            <div className="animate-slide-up pb-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <h1 className="stencil-text" style={{ fontSize: '2.4rem', color: 'var(--foreground)' }}>
                        INTELIGÊNCIA
                    </h1>
                    <div className="flex items-center gap-2 bg-white border-2 border-foreground p-2">
                        <Filter size={20} />
                        <select
                            value={selectedNeighborhoodId}
                            onChange={(e) => setSelectedNeighborhoodId(e.target.value)}
                            className="font-black uppercase text-sm outline-none bg-transparent"
                        >
                            {neighborhoods.map(n => (
                                <option key={n.id} value={n.id}>{n.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="animate-spin text-primary" size={48} />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-8">
                        {/* Alertas Operacionais */}
                        {alerts.length > 0 && (
                            <section>
                                <h2 className="stencil-text text-xl mb-4 flex items-center gap-2">
                                    <AlertTriangle className="text-accent" /> ALERTAS DA SEMANA
                                </h2>
                                <div className="flex flex-col gap-3">
                                    {alerts.map((alert, i) => (
                                        <div
                                            key={i}
                                            className="card border-2 p-4 flex gap-4 items-start"
                                            style={{
                                                borderColor: alert.severity === 'critical' ? 'var(--accent)' : 'var(--primary)',
                                                background: alert.severity === 'critical' ? '#fff4f4' : '#f4faff'
                                            }}
                                        >
                                            <div className={`p-2 border-2 border-foreground ${alert.severity === 'critical' ? 'bg-accent text-white' : 'bg-primary'}`}>
                                                <AlertCircle size={20} />
                                            </div>
                                            <div>
                                                <h3 className="font-black uppercase text-sm">{alert.title}</h3>
                                                <p className="text-xs font-bold uppercase opacity-70 mb-3">{alert.body}</p>

                                                <div className="flex gap-2">
                                                    {alert.kind.includes('capacity') && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    setModalConfig({ isOpen: true, type: 'capacity_override', entityId: alert.alert.entity_id, alert: alert.alert });
                                                                    setActionForm(prev => ({ ...prev, capacity: 50, reason: "Resolver lotação" }));
                                                                }}
                                                                className="text-[9px] font-black uppercase bg-white px-2 py-1 border-2 border-foreground hover:bg-muted"
                                                            >
                                                                Aumentar Vagas
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setModalConfig({ isOpen: true, type: 'extra_window', entityId: alert.alert.entity_id, alert: alert.alert });
                                                                    setActionForm(prev => ({ ...prev, capacity: 20, reason: "Janela extra para demanda" }));
                                                                }}
                                                                className="text-[9px] font-black uppercase bg-primary px-2 py-1 border-2 border-foreground hover:translate-x-0.5 hover:translate-y-0.5"
                                                            >
                                                                Criar Janela Extra
                                                            </button>
                                                        </>
                                                    )}
                                                    {alert.kind === 'quality_drop' && (
                                                        <button
                                                            className="text-[9px] font-black uppercase bg-foreground text-white px-2 py-1 border-2 border-foreground"
                                                            onClick={() => window.alert("Notificação educativa enviada para o bairro.")}
                                                        >
                                                            Avisar Cooperados
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Pontos Parados (A15.4) */}
                        {inactivePoints.length > 0 && (
                            <section className="animate-slide-up">
                                <div className="flex items-center gap-2 mb-4">
                                    <MapPin className="text-accent" />
                                    <h2 className="stencil-text text-xl">PONTOS PARADOS (7D+)</h2>
                                </div>
                                <div className="card border-2 border-foreground p-0 overflow-hidden shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-muted border-b-2 border-foreground">
                                                <th className="p-3 stencil-text text-[10px]">PONTO ECO</th>
                                                <th className="p-3 stencil-text text-[10px]">ULT. PEDIDO</th>
                                                <th className="p-3 stencil-text text-[10px]">ULT. RECIBO</th>
                                                <th className="p-3 stencil-text text-[10px]">AÇÃO</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {inactivePoints.map((ip, i) => (
                                                <tr key={i} className="border-b border-muted hover:bg-muted/30 transition-colors">
                                                    <td className="p-3">
                                                        <p className="font-black text-xs uppercase">{ip.name}</p>
                                                        <span className={`text-[8px] font-black uppercase px-1 border-2 border-foreground ${ip.status === 'inactive' ? 'bg-accent text-white' : 'bg-yellow-400'}`}>
                                                            {ip.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 font-bold text-xs">{ip.days_since_last_request} DIAS</td>
                                                    <td className="p-3 font-bold text-xs">{ip.days_since_last_receipt} DIAS</td>
                                                    <td className="p-3">
                                                        <button
                                                            onClick={() => {
                                                                setModalConfig({ isOpen: true, type: 'promote_drop_point', entityId: ip.drop_point_id });
                                                                setActionForm(prev => ({
                                                                    ...prev,
                                                                    message: "Este ponto precisa de energia! Vamos reativar as coletas aqui?",
                                                                    reason: "Reativação de ponto parado"
                                                                }));
                                                            }}
                                                            className="text-[9px] font-black uppercase bg-foreground text-white px-2 py-1 border-2 border-foreground hover:bg-foreground/80"
                                                        >
                                                            Reativar
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}

                        {/* Drop Points Section with Promotion action */}
                        <section className="animate-slide-up">
                            <h2 className="stencil-text text-xl mb-4 flex items-center gap-2">
                                <MapPin /> PONTOS ECO (7D)
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {dropPointLoads.length === 0 ? (
                                    <p className="font-bold uppercase text-xs text-muted">Sem Pontos ECO com movimento.</p>
                                ) : (
                                    dropPointLoads.map((dp, i) => (
                                        <div key={i} className={`card p-4 border-2 ${dp.status_bucket === 'critical' ? 'border-accent bg-[#fff4f4]' : 'border-foreground'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-black text-xs uppercase leading-tight">{dp.name}</h3>
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 border-2 border-foreground ${dp.status_bucket === 'critical' ? 'bg-accent text-white' : 'bg-primary'}`}>
                                                    {dp.status_bucket}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] font-bold uppercase opacity-80 mb-3">
                                                <span>{dp.requests_total} PEDIDOS</span>
                                                <span>{Math.round(dp.ok_rate * 100)}% QUALIDADE</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setModalConfig({ isOpen: true, type: 'promote_drop_point', entityId: dp.drop_point_id });
                                                        setActionForm(prev => ({ ...prev, message: "Ponto recomendado esta semana para equilibrar rotas.", reason: "Promoção de ponto secundário" }));
                                                    }}
                                                    className="w-full text-[9px] font-black uppercase bg-foreground text-white px-2 py-1 border-2 border-foreground hover:bg-foreground/80"
                                                >
                                                    Promover Ponto
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>

                        {/* Modals */}
                        {modalConfig.isOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                                <div className="card w-full max-w-md bg-white border-4 border-foreground shadow-[8px_8px_0_0_rgba(0,0,0,1)] animate-scale-up">
                                    <div className="flex justify-between items-center bg-foreground text-white p-4">
                                        <h3 className="stencil-text uppercase">
                                            {modalConfig.type === 'extra_window' ? 'CRIAR JANELA EXTRA' :
                                                modalConfig.type === 'capacity_override' ? 'AJUSTAR CAPACIDADE' : 'PROMOVER PONTO ECO'}
                                        </h3>
                                        <button onClick={() => setModalConfig({ isOpen: false, type: null })}>
                                            <X size={24} />
                                        </button>
                                    </div>

                                    <div className="p-6 flex flex-col gap-4 text-foreground">
                                        <div>
                                            <label className="label-text">Data da Ação</label>
                                            <input
                                                type="date"
                                                className="field"
                                                value={actionForm.date}
                                                onChange={e => setActionForm({ ...actionForm, date: e.target.value })}
                                            />
                                        </div>

                                        {(modalConfig.type === 'extra_window' || modalConfig.type === 'capacity_override') && (
                                            <div>
                                                <label className="label-text">Nova Capacidade (Pedidos)</label>
                                                <input
                                                    type="number"
                                                    className="field"
                                                    value={actionForm.capacity}
                                                    onChange={e => setActionForm({ ...actionForm, capacity: parseInt(e.target.value) })}
                                                />
                                            </div>
                                        )}

                                        {modalConfig.type === 'extra_window' && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="label-text">Início</label>
                                                    <input type="time" className="field" value={actionForm.startTime} onChange={e => setActionForm({ ...actionForm, startTime: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="label-text">Fim</label>
                                                    <input type="time" className="field" value={actionForm.endTime} onChange={e => setActionForm({ ...actionForm, endTime: e.target.value })} />
                                                </div>
                                            </div>
                                        )}

                                        {modalConfig.type === 'promote_drop_point' && (
                                            <div>
                                                <label className="label-text">Mensagem Pública (7 dias)</label>
                                                <textarea
                                                    className="field min-h-[80px]"
                                                    placeholder="Ex: Ponto recomendado para esta semana devido à facilidade de acesso."
                                                    value={actionForm.message}
                                                    onChange={e => setActionForm({ ...actionForm, message: e.target.value })}
                                                />
                                            </div>
                                        )}

                                        <div>
                                            <label className="label-text">Motivo (Interno)</label>
                                            <textarea
                                                className="field min-h-[60px]"
                                                value={actionForm.reason}
                                                onChange={e => setActionForm({ ...actionForm, reason: e.target.value })}
                                            />
                                        </div>

                                        <div className="flex gap-4 mt-4">
                                            <button
                                                onClick={() => setModalConfig({ isOpen: false, type: null })}
                                                className="cta-button secondary w-1/2"
                                            >
                                                CANCELAR
                                            </button>
                                            <button
                                                onClick={handleAction}
                                                disabled={isSubmitting}
                                                className="cta-button w-1/2 flex items-center justify-center gap-2"
                                            >
                                                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'CONFIRMAR'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Próximas Janelas */}
                        <section>
                            <h2 className="stencil-text text-xl mb-4 flex items-center gap-2">
                                <Clock /> CARGA DAS PRÓXIMAS JANELAS
                            </h2>
                            <div className="card overflow-x-auto p-0 border-2 border-foreground">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-muted border-b-2 border-foreground">
                                            <th className="p-3 stencil-text text-[10px]">JANELA / DATA</th>
                                            <th className="p-3 stencil-text text-[10px]">CAPACIDADE</th>
                                            <th className="p-3 stencil-text text-[10px]">TOTAL</th>
                                            <th className="p-3 stencil-text text-[10px]">RECORRÊNCIA</th>
                                            <th className="p-3 stencil-text text-[10px]">STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {windowLoads.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center font-bold uppercase text-muted">Sem janelas ativas</td></tr>
                                        ) : (
                                            windowLoads.map((wl: any, i) => (
                                                <tr key={i} className="border-b border-muted hover:bg-muted/50 transition-colors">
                                                    <td className="p-3">
                                                        <p className="font-black text-xs uppercase">{formatWindowLabel(wl as any)}</p>
                                                        <p className="font-bold text-[10px] text-muted">{new Date(wl.scheduled_date).toLocaleDateString('pt-BR')}</p>
                                                    </td>
                                                    <td className="p-3 font-bold text-xs">{wl.capacity}</td>
                                                    <td className="p-3">
                                                        <span className="font-black text-xs">{wl.requests_total}</span>
                                                        <span className="text-[10px] text-muted ml-1">({wl.requests_scheduled_count} casa | {wl.requests_drop_point_count} ponto)</span>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black text-xs">{Math.round(wl.recurring_coverage_pct * 100)}%</span>
                                                            <div className="w-12 h-2 bg-muted relative rounded-full overflow-hidden">
                                                                <div
                                                                    className="absolute top-0 left-0 h-full bg-primary"
                                                                    style={{ width: `${wl.recurring_coverage_pct * 100}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className={`stencil-text text-[10px] px-2 py-0.5 border-2 border-foreground ${wl.status_bucket === 'critical' ? 'bg-accent text-white' :
                                                            wl.status_bucket === 'warning' ? 'bg-yellow-400' : 'bg-primary'
                                                            }`}>
                                                            {wl.status_bucket}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* Qualidade e Pontos ECO */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <section>
                                <h2 className="stencil-text text-xl mb-4 flex items-center gap-2">
                                    <CheckCircle2 /> QUALIDADE POR JANELA (7D)
                                </h2>
                                <div className="flex flex-col gap-4">
                                    {Object.values(windowQualities).length === 0 ? (
                                        <p className="font-bold uppercase text-xs text-muted">Sem dados de qualidade recentes.</p>
                                    ) : (
                                        Object.values(windowQualities).map((wq, i) => {
                                            const wl = windowLoads.find(l => l.window_id === wq.window_id);
                                            return (
                                                <div key={i} className="card p-4 flex flex-col gap-3">
                                                    <div className="flex justify-between items-center">
                                                        <h3 className="font-black text-xs uppercase">
                                                            {wl ? formatWindowLabel(wl as any) : 'Janela Removida'}
                                                        </h3>
                                                        <span className="font-black text-primary text-sm">{Math.round(wq.ok_rate * 100)}% OK</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {wq.top_flags.map((f, j) => (
                                                            <span key={j} className="text-[9px] font-black uppercase bg-accent/10 text-accent px-2 py-0.5 border border-accent/20">
                                                                {f}
                                                            </span>
                                                        ))}
                                                        {wq.top_flags.length === 0 && <span className="text-[9px] font-bold uppercase text-muted">Sem alertas recorrentes</span>}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </section>

                            <section>
                                <h2 className="stencil-text text-xl mb-4 flex items-center gap-2">
                                    <MapPin /> PONTOS ECO (7D)
                                </h2>
                                <div className="flex flex-col gap-4">
                                    {dropPointLoads.length === 0 ? (
                                        <p className="font-bold uppercase text-xs text-muted">Sem Pontos ECO com movimento.</p>
                                    ) : (
                                        dropPointLoads.map((dp, i) => (
                                            <div key={i} className={`card p-4 border-2 ${dp.status_bucket === 'critical' ? 'border-accent bg-[#fff4f4]' : 'border-foreground'}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="font-black text-xs uppercase leading-tight">{dp.name}</h3>
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 border-2 border-foreground ${dp.status_bucket === 'critical' ? 'bg-accent text-white' : 'bg-primary'
                                                        }`}>
                                                        {dp.status_bucket}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] font-bold uppercase opacity-80 mb-3">
                                                    <span>{dp.requests_total} PEDIDOS</span>
                                                    <span>{Math.round(dp.ok_rate * 100)}% QUALIDADE</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {dp.top_flags.map((f, j) => (
                                                        <span key={j} className="text-[8px] font-black uppercase bg-foreground text-white px-1.5 py-0.5">
                                                            {f}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRouteGate>
    );
}
