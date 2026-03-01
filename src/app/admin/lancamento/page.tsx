"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Shield, Lock, Unlock, Users, Activity, Save, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { LoadingBlock } from "@/components/loading-block";

export default function LaunchAdmin() {
    const [controls, setControls] = useState<any[]>([]);
    const [telemetry, setTelemetry] = useState<any[]>([]);
    const [obsCriticalHour, setObsCriticalHour] = useState<any[]>([]);
    const [openIncidents, setOpenIncidents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch("/api/admin/launch", {
                headers: { Authorization: `Bearer ${session?.access_token}` }
            });
            const data = await res.json();
            setControls(data.controls || []);
            setTelemetry(data.telemetry || []);
            setObsCriticalHour(data.obs_critical_hour || []);
            setOpenIncidents(data.open_incidents || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function updateControl(id: string, updates: any) {
        setSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch("/api/admin/launch", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ id, ...updates })
            });
            if (res.ok) {
                await loadData();
            }
        } catch (err) {
            alert("Falha ao atualizar controle.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <LoadingBlock />;

    return (
        <div className="animate-slide-up pb-12">
            <div className="flex items-center gap-3 mb-8">
                <Shield size={32} className="text-primary" />
                <h1 className="stencil-text text-3xl">CONTROLE DE LANÇAMENTO</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 flex flex-col gap-6">
                    {controls.map((ctrl) => (
                        <div key={ctrl.id} className={`card border-2 ${ctrl.is_open ? 'border-primary' : 'border-muted'} bg-white`}>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <span className="font-black text-[10px] uppercase text-muted mb-1 block">Escopo: {ctrl.scope}</span>
                                    <h2 className="stencil-text text-xl">
                                        {ctrl.scope === 'global' ? '🌍 CONTROLE GLOBAL' :
                                            ctrl.scope === 'cell' ? `🏙️ CÉLULA: ${ctrl.eco_cells?.name}` :
                                                `📍 BAIRRO: ${ctrl.neighborhoods?.name}`}
                                    </h2>
                                </div>
                                <button
                                    onClick={() => updateControl(ctrl.id, { is_open: !ctrl.is_open })}
                                    className={`p-2 rounded-full border-2 border-foreground transition-transform active:scale-95 ${ctrl.is_open ? 'bg-primary' : 'bg-muted'}`}
                                >
                                    {ctrl.is_open ? <Unlock size={24} /> : <Lock size={24} />}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                <div className="flex flex-col gap-1">
                                    <span className="font-black text-[10px] uppercase text-muted">Modo de Entrada</span>
                                    <select
                                        className="field font-bold uppercase text-xs p-1"
                                        value={ctrl.open_mode}
                                        onChange={(e) => updateControl(ctrl.id, { open_mode: e.target.value })}
                                    >
                                        <option value="invite_only">APENAS CONVITE</option>
                                        <option value="open">ABERTO (LIMITED)</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="font-black text-[10px] uppercase text-muted">Min Health Score</span>
                                    <input
                                        type="number"
                                        className="field font-bold text-xs p-1"
                                        value={ctrl.min_health_score}
                                        onChange={(e) => updateControl(ctrl.id, { min_health_score: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="font-black text-[10px] uppercase text-muted">Max Pedidos/Janela</span>
                                    <input
                                        type="number"
                                        className="field font-bold text-xs p-1"
                                        value={ctrl.max_new_requests_per_window}
                                        onChange={(e) => updateControl(ctrl.id, { max_new_requests_per_window: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-4 pt-4 border-t border-muted/20">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={ctrl.block_on_feedback_blockers}
                                        onChange={(e) => updateControl(ctrl.id, { block_on_feedback_blockers: e.target.checked })}
                                    />
                                    <span className="text-[10px] font-black uppercase">Bloquear se houver Blockers</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={ctrl.block_on_stock_deficit}
                                        onChange={(e) => updateControl(ctrl.id, { block_on_stock_deficit: e.target.checked })}
                                    />
                                    <span className="text-[10px] font-black uppercase">Bloquear se faltar estoque</span>
                                </label>
                            </div>

                            {ctrl.notes_public && (
                                <div className="mt-4 p-2 bg-muted/10 border-l-2 border-foreground italic text-[10px]">
                                    "{ctrl.notes_public}"
                                </div>
                            )}

                            {/* Technical Warning */}
                            {obsCriticalHour.length >= 10 && (
                                <div className="mt-4 p-3 bg-red-50 border-2 border-red-600 animate-pulse">
                                    <h4 className="flex items-center gap-2 text-red-700 font-black text-[10px] uppercase mb-1">
                                        <AlertTriangle size={14} /> Recomendação de Pausa (Técnica)
                                    </h4>
                                    <p className="text-[10px] font-bold text-red-600 uppercase">
                                        Instabilidade técnica detectada ({obsCriticalHour.length} falhas críticas na última hora). Recomenda-se pausar a abertura até a estabilização.
                                    </p>
                                </div>
                            )}

                            {/* Incident Warning */}
                            {openIncidents.some(inc =>
                                inc.severity === 'critical' &&
                                (ctrl.scope === 'global' ||
                                    (ctrl.scope === 'cell' && inc.cell_id === ctrl.cell_id) ||
                                    (ctrl.scope === 'neighborhood' && inc.neighborhood_id === ctrl.neighborhood_id))
                            ) && (
                                    <div className="mt-2 p-3 bg-accent/10 border-2 border-accent">
                                        <h4 className="flex items-center gap-2 text-accent font-black text-[10px] uppercase mb-1">
                                            <AlertTriangle size={14} /> Incidente Crítico Aberto
                                        </h4>
                                        <p className="text-[10px] font-bold text-accent uppercase">
                                            Há um incidente crítico em mitigação neste escopo. Recomenda-se pausar novas aberturas para evitar sobrecarga operativa.
                                        </p>
                                        <Link href="/admin/runbook" className="mt-2 text-[8px] font-black uppercase underline block">Ver no Runbook</Link>
                                    </div>
                                )}
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-6">
                    <section className="card bg-foreground text-white">
                        <h3 className="stencil-text text-sm mb-4 uppercase text-primary flex items-center gap-2">
                            <Activity size={16} /> TELEMETRIA DE ACESSO
                        </h3>
                        <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2">
                            {telemetry.map((t, i) => (
                                <div key={i} className="text-[9px] font-bold border-b border-white/10 pb-1 uppercase flex justify-between">
                                    <span className={t.event_kind.startsWith('blocked') ? 'text-accent' : 'text-primary'}>
                                        {t.event_kind.replace('blocked_', '🚫 ').replace('request_created', '✅ PEDIDO').replace('access_granted', '🔑 ACESSO')}
                                    </span>
                                    <span className="opacity-60">{new Date().toLocaleTimeString()}</span>
                                </div>
                            ))}
                            {telemetry.length === 0 && <p className="text-[10px] italic opacity-50">Nenhum evento registrado hoje.</p>}
                        </div>
                    </section>

                    <section className="card">
                        <h3 className="stencil-text text-sm mb-4 uppercase flex items-center gap-2">
                            <Users size={16} /> REGRAS DE GOVERNANÇA
                        </h3>
                        <div className="text-[10px] font-bold uppercase flex flex-col gap-2">
                            <p>1. Precedência: Bairros &gt; Células &gt; Global.</p>
                            <p>2. Trabalho Digno: O sistema bloqueia pedidos se a janela estiver cheia.</p>
                            <p>3. Resiliência: Saúde abaixo do mínimo interrompe o onboarding.</p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
