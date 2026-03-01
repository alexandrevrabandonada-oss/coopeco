"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    ShieldCheck,
    Activity,
    AlertTriangle,
    Save,
    RefreshCw,
    ArrowRight,
    Layout,
    Users,
    Package,
    MessageSquare,
    Award,
    FileText,
    Thermometer,
    Zap,
    Fingerprint,
    CheckCircle2,
    CircleDashed
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";

export default function AdminSaudePage() {
    const { user } = useAuth();
    const [neighborhoods, setNeighborhoods] = useState<any[]>([]);
    const [selectedSlug, setSelectedSlug] = useState("");
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        async function loadNeighborhoods() {
            const { data } = await supabase.from("neighborhoods").select("id, name, slug").order("name");
            if (data) {
                setNeighborhoods(data);
                if (data.length > 0) setSelectedSlug(data[0].slug);
            }
        }
        loadNeighborhoods();
    }, [supabase]);

    useEffect(() => {
        if (selectedSlug) {
            fetchSummary();
        }
    }, [selectedSlug]);

    const fetchSummary = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`/api/admin/health/summary?neighborhood_slug=${selectedSlug}`, {
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });
            if (!res.ok) throw new Error("Falha ao carregar sumário de saúde.");
            const data = await res.json();
            setSummary(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const openIncident = async (kind: string) => {
        const neighborhoodId = neighborhoods.find(n => n.slug === selectedSlug)?.id;
        try {
            const res = await fetch("/api/admin/incidents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ kind, neighborhood_id: neighborhoodId })
            });
            if (!res.ok) throw new Error("Falha ao abrir incidente");
            alert("Incidente aberto no Runbook.");
            window.location.href = "/admin/runbook";
        } catch (err: any) {
            alert(err.message);
        }
    };

    const saveSnapshot = async () => {
        if (!summary) return;
        setSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const neighborhoodId = neighborhoods.find(n => n.slug === selectedSlug)?.id;
            const res = await fetch(`/api/admin/health/snapshot`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    neighborhood_id: neighborhoodId,
                    summary
                })
            });
            if (!res.ok) throw new Error("Erro ao salvar snapshot.");
            alert("Snapshot de saúde registrado no log do sistema.");
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleUxItem = async (itemId: string, currentStatus: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`/api/admin/health/ux-toggle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ item_id: itemId, new_status: currentStatus === 'done' ? 'todo' : 'done' })
            });
            if (!res.ok) throw new Error("Falha ao atualizar item de UX.");
            fetchSummary(); // reload to reflect
        } catch (err: any) {
            alert(err.message);
        }
    };

    const getHealthScore = () => {
        if (!summary) return 0;
        let score = 0;
        if (summary.pilot_active) score += 20;
        if (summary.ok_rate_last7d >= 0.9) score += 20;
        if (summary.feedback_blockers_open === 0) score += 20;
        if (summary.assets_restock_deficits_count === 0) score += 20;
        if (summary.next_windows_count > 0) score += 20;
        // Penality for privacy fail
        if (summary.privacy_audit?.result_status === 'fail') score -= 30;
        return Math.max(0, score);
    };

    const healthScore = getHealthScore();
    const scoreColor = healthScore >= 80 ? 'text-green-500' : healthScore >= 50 ? 'text-yellow-500' : 'text-red-500';

    if (loading && !summary) return <LoadingBlock text="Auditando saúde do sistema..." />;

    return (
        <div className="animate-slide-up pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <Activity className="text-primary" size={32} />
                    <h1 className="stencil-text text-3xl">SAÚDE DO SISTEMA</h1>
                </div>

                <div className="flex gap-2">
                    <select
                        className="field"
                        value={selectedSlug}
                        onChange={(e) => setSelectedSlug(e.target.value)}
                    >
                        {neighborhoods.map(n => (
                            <option key={n.id} value={n.slug}>{n.name}</option>
                        ))}
                    </select>
                    <button className="cta-button small" onClick={fetchSummary} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            {error ? (
                <div className="card border-2 border-red-500 bg-red-50 p-12 text-center">
                    <p className="font-black text-red-500 uppercase mb-4">{error}</p>
                    <button className="cta-button small mx-auto" onClick={fetchSummary}>TENTAR NOVAMENTE</button>
                </div>
            ) : summary ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                    {/* Health Score Card */}
                    <div className="lg:col-span-1 card border-4 border-foreground flex flex-col items-center justify-center py-10 bg-white">
                        <Thermometer size={48} className={scoreColor} />
                        <span className={`stencil-text text-5xl mt-4 ${scoreColor}`}>{healthScore}%</span>
                        <span className="font-black text-[10px] uppercase mt-2">SINAL VITAL ECO</span>
                        <button
                            className="mt-6 cta-button tiny w-full"
                            onClick={saveSnapshot}
                            disabled={saving}
                        >
                            <Save size={12} /> {saving ? 'GRAVANDO...' : 'SALVAR SNAPSHOT'}
                        </button>
                    </div>

                    {/* Core Metrics */}
                    <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="card bg-white flex flex-col gap-1">
                            <span className="font-black text-[10px] uppercase text-muted">Janelas Ativas</span>
                            <p className="font-black text-2xl">{summary.next_windows_count}</p>
                            <Link href="/admin/rotas" className="text-[9px] font-bold uppercase underline">Ver Rotas</Link>
                        </div>
                        <div className="card bg-white flex flex-col gap-1">
                            <span className="font-black text-[10px] uppercase text-muted">Qualidade (7d)</span>
                            <p className="font-black text-2xl">{Math.round((summary.ok_rate_last7d || 0) * 100)}%</p>
                            <Link href="/reports" className="text-[9px] font-bold uppercase underline">Ver Relatórios</Link>
                        </div>
                        <div className="card bg-white flex flex-col gap-1">
                            <span className="font-black text-[10px] uppercase text-muted">Recorrência Ativa</span>
                            <p className="font-black text-2xl">{summary.recurring_subscriptions_active}</p>
                            <Link href="/admin/lancador" className="text-[9px] font-bold uppercase underline">Gerar Lote</Link>
                        </div>
                        <div className="card bg-white flex flex-col gap-1">
                            <span className="font-black text-[10px] uppercase text-muted">Pontos ECO</span>
                            <p className="font-black text-2xl">{summary.drop_points_active_count}</p>
                            <Link href="/admin/pontos" className="text-[9px] font-bold uppercase underline">Gerar Placa</Link>
                        </div>
                        <div className={`card ${summary.launch_is_open ? 'bg-primary/20' : 'bg-muted/10'} flex flex-col gap-1`}>
                            <span className="font-black text-[10px] uppercase text-muted">Acesso: {summary.launch_open_mode}</span>
                            <p className="font-black text-2xl">{summary.launch_is_open ? 'ABERTO' : 'FECHADO'}</p>
                            <Link href="/admin/lancamento" className="text-[9px] font-bold uppercase underline">Grants: {summary.launch_grants_count}</Link>
                        </div>
                    </div>

                    {/* Risks & Blockers */}
                    <section className="lg:col-span-3 flex flex-col gap-4">
                        <h2 className="stencil-text text-lg flex items-center gap-2">
                            <AlertTriangle size={20} className="text-secondary" /> RISCOS & IMPEDIMENTOS
                        </h2>
                        <div className="flex flex-col gap-3">
                            {summary.feedback_blockers_open > 0 && (
                                <div className="card border-2 border-red-500 bg-red-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <MessageSquare className="text-red-500" />
                                        <div>
                                            <p className="font-black text-xs uppercase">BLOCKERS DE RUA</p>
                                            <p className="text-[10px] font-bold">{summary.feedback_blockers_open} itens travando a operação.</p>
                                        </div>
                                    </div>
                                    <Link href="/admin/feedback" className="cta-button tiny bg-red-500 text-white">TRIAGEM</Link>
                                </div>
                            )}

                            {summary.assets_restock_deficits_count > 0 && (
                                <div className="card border-2 border-orange-500 bg-orange-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Package className="text-orange-500" />
                                        <div>
                                            <p className="font-black text-xs uppercase">DÉFICIT DE LOGÍSTICA</p>
                                            <p className="text-[10px] font-bold">{summary.assets_restock_deficits_count} materiais abaixo do estoque mínimo.</p>
                                        </div>
                                    </div>
                                    <Link href="/admin/logistica" className="cta-button tiny bg-orange-500 text-white">REPOSIÇÃO</Link>
                                </div>
                            )}

                            {summary.drop_points_inactive_count > 0 && (
                                <div className="card border-2 border-yellow-500 bg-yellow-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Zap className="text-yellow-500" />
                                        <div>
                                            <p className="font-black text-xs uppercase">PONTOS FRIOS</p>
                                            <p className="text-[10px] font-bold">{summary.drop_points_inactive_count} pontos ECO em inatividade.</p>
                                        </div>
                                    </div>
                                    <Link href="/admin/piloto" className="cta-button tiny bg-yellow-500 text-white">REATIVAR</Link>
                                </div>
                            )}

                            {summary.privacy_audit?.result_status === 'fail' && (
                                <div className="card border-2 border-red-500 bg-red-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Fingerprint className="text-red-500" />
                                        <div>
                                            <p className="font-black text-xs uppercase">VAZAMENTO DE PRIVACIDADE</p>
                                            <p className="text-[10px] font-bold">PII detectada em auditoria recente. Corrigir imediatamente.</p>
                                        </div>
                                    </div>
                                    <Link href="/admin/privacidade" className="cta-button tiny bg-red-500 text-white">AUDITAR</Link>
                                </div>
                            )}

                            {healthScore < 80 && (
                                <div className="mt-6 p-4 bg-muted/5 border-2 border-foreground flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle size={20} className="text-accent" />
                                        <span className="font-black text-[10px] uppercase">Anomalias Detectadas. Seguir Runbook?</span>
                                    </div>
                                    <button
                                        onClick={() => openIncident(healthScore < 50 ? 'capacity_critical' : 'quality_drop')}
                                        className="cta-button tiny bg-foreground text-white"
                                    >
                                        ABRIR INCIDENTE
                                    </button>
                                </div>
                            )}

                            {summary.open_incidents?.length > 0 && (
                                <div className="mt-8">
                                    <h4 className="stencil-text text-[10px] uppercase mb-4 text-muted border-b border-muted/20 pb-2 flex items-center gap-2">
                                        <Activity size={12} /> Incidentes em Mitigação
                                    </h4>
                                    <div className="flex flex-col gap-2">
                                        {summary.open_incidents.map((inc: any) => (
                                            <Link
                                                key={inc.id}
                                                href="/admin/runbook"
                                                className="flex justify-between items-center p-3 border-2 border-foreground/10 hover:border-foreground bg-white transition-all shadow-[2px_2px_0_0_rgba(0,0,0,0.05)]"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full border border-foreground ${inc.severity === 'critical' ? 'bg-red-600 animate-pulse' : 'bg-yellow-400'}`} />
                                                    <span className="font-black text-[9px] uppercase">{inc.kind.replace('_', ' ')}</span>
                                                </div>
                                                <ArrowRight size={14} className="opacity-30" />
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {healthScore >= 80 && (!summary.open_incidents || summary.open_incidents.length === 0) && (
                                <div className="mt-12 text-center opacity-40">
                                    <ShieldCheck size={32} className="mx-auto mb-2 text-green-700" />
                                    <p className="font-black text-sm uppercase text-green-700">Sistema nominal. Nenhuma anomalia crítica detectada.</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* UX Readiness Checklist (A56) */}
                    <section className="lg:col-span-4 mt-8">
                        <h2 className="stencil-text text-lg flex items-center gap-2 mb-4">
                            <CheckCircle2 size={20} className="text-primary" /> UX READINESS (DIA 1)
                        </h2>
                        {summary.ux_readiness_items?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {summary.ux_readiness_items.map((item: any) => (
                                    <button
                                        key={item.id}
                                        onClick={() => toggleUxItem(item.id, item.status)}
                                        className={`text-left p-3 border-2 flex items-start gap-3 transition-colors ${item.status === 'done' ? 'border-primary bg-primary/10' : 'border-foreground/20 bg-white hover:border-foreground/50'}`}
                                    >
                                        {item.status === 'done' ? (
                                            <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
                                        ) : (
                                            <CircleDashed size={16} className="text-muted shrink-0 mt-0.5" />
                                        )}
                                        <div>
                                            <p className={`font-black text-[10px] uppercase ${item.status === 'done' ? 'opacity-100' : 'opacity-60'}`}>
                                                {item.item_key.replace(/_/g, ' ')}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs font-bold opacity-50">Nenhum item pré-lançamento configurado para esta célula.</p>
                        )}
                    </section>

                    {/* Quick Stats sidebar */}
                    <aside className="lg:col-span-1 flex flex-col gap-6">
                        <div className="card bg-muted/10">
                            <h3 className="stencil-text text-[10px] uppercase mb-4 text-muted">Integrações</h3>
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                    <span>Feeds Ativos</span>
                                    <span>{summary.active_feeds_count || 0}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                    <span>Webhooks</span>
                                    <span>{summary.active_webhooks_count || 0}</span>
                                </div>
                                <div className="mt-2 pt-2 border-t border-foreground/5">
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                        <span className="text-muted">Erros Técnicos (24h)</span>
                                        <span className={summary.obs_critical_24h > 0 ? 'text-red-600' : 'text-foreground'}>
                                            {(summary.obs_critical_24h || 0) + (summary.obs_error_24h || 0)}
                                        </span>
                                    </div>
                                    {summary.obs_critical_24h > 0 && (
                                        <p className="text-[8px] font-bold uppercase text-red-600 mt-1 animate-pulse">
                                            Incidentes críticos detectados
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="card bg-muted/10">
                            <h3 className="stencil-text text-[10px] uppercase mb-4 text-muted">Parcerias do Comum</h3>
                            <div className="flex flex-col gap-2">
                                {Object.entries(summary.partner_status_counts || {}).map(([status, count]: [any, any]) => (
                                    <div key={status} className="flex justify-between items-center text-[10px] font-black uppercase">
                                        <span>{status}</span>
                                        <span>{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="card bg-muted/10">
                            <h3 className="stencil-text text-[10px] uppercase mb-4 text-muted">Operação 7d</h3>
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                    <span>Recibos</span>
                                    <span>{summary.receipts_last7d}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                    <span>Comunicações</span>
                                    <span>{summary.comm_exports_last7d}</span>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            ) : null}
        </div>
    );
}
