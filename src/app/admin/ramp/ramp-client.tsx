"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
    Rocket,
    ShieldCheck,
    AlertCircle,
    BarChart,
    Settings2,
    RefreshCcw,
    CheckCircle2,
    XCircle,
    GraduationCap,
    ShieldCheck as ShieldIcon
} from "lucide-react";
import Link from "next/link";
import { LoadingBlock } from "@/components/loading-block";

export default function RampClient() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [cells, setCells] = useState<any[]>([]);
    const [neighborhoods, setNeighborhoods] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [states, setStates] = useState<Record<string, any>>({});

    // Form state
    const [selectedScope, setSelectedScope] = useState<'cell' | 'neighborhood'>('cell');
    const [selectedId, setSelectedId] = useState("");
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        const loadInitial = async () => {
            setLoading(true);
            const [cellsRes, neighborhoodsRes, plansRes, statesRes] = await Promise.all([
                supabase.from("eco_cells").select("*").order("name"),
                supabase.from("neighborhoods").select("*").order("name"),
                supabase.from("eco_ramp_plans").select("*, cell:eco_cells(name, slug), neighborhood:neighborhoods(name, slug)"),
                supabase.from("eco_ramp_state").select("*").eq("day", new Date().toISOString().split('T')[0])
            ]);

            if (cellsRes.data) setCells(cellsRes.data);
            if (neighborhoodsRes.data) setNeighborhoods(neighborhoodsRes.data);
            if (plansRes.data) setPlans(plansRes.data);

            if (statesRes.data) {
                const sMap: Record<string, any> = {};
                statesRes.data.forEach(s => {
                    sMap[s.ramp_plan_id] = s;
                });
                setStates(sMap);
            }
            setLoading(false);
        };

        loadInitial();
    }, [supabase]);

    const handleRefresh = async (scope: string, id: string) => {
        setRefreshing(true);
        const params: any = { p_scope: scope };
        if (scope === 'cell') params.p_cell_id = id;
        else params.p_neighborhood_id = id;

        const { data, error } = await supabase.rpc('rpc_refresh_ramp_state', params);
        if (error) {
            alert("Erro ao atualizar: " + error.message);
        } else {
            // Reload states
            const { data: newStates } = await supabase.from("eco_ramp_state").select("*").eq("day", new Date().toISOString().split('T')[0]);
            if (newStates) {
                const sMap: Record<string, any> = {};
                newStates.forEach(s => {
                    sMap[s.ramp_plan_id] = s;
                });
                setStates(sMap);
            }
        }
        setRefreshing(false);
    };

    if (loading) return <LoadingBlock text="Carregando planos de ramp-up..." />;

    return (
        <div className="animate-slide-up pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <Rocket className="text-primary" size={32} />
                    <h1 className="stencil-text text-3xl">RAMP-UP DE ABERTURA</h1>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="cta-button small bg-foreground text-white flex gap-2"
                >
                    <Settings2 size={16} /> {showForm ? 'CANCELAR' : 'NOVO PLANO'}
                </button>
            </header>

            {!loading && plans.length > 0 && (
                <div className="card bg-orange-50 border-2 border-orange-500 p-4 mb-8 flex items-center gap-4">
                    <ShieldCheck className="text-orange-500 shrink-0" size={32} />
                    <div>
                        <p className="font-black text-xs uppercase text-orange-600">Alerta de Capacitação</p>
                        <p className="text-[10px] font-bold uppercase opacity-70">
                            Verifique se a equipe local concluiu as trilhas de Operação e Qualidade na <Link href="/admin/formacao" className="underline">Toolbox</Link> antes de avançar nos níveis de Ramp-up.
                        </p>
                    </div>
                </div>
            )}

            {showForm && (
                <section className="card border-primary border-2 mb-8 bg-primary/5">
                    <h2 className="stencil-text text-xl mb-6">CONFIGURAR NOVO RAMP-UP</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase opacity-60">Escopo</label>
                            <select
                                className="field"
                                value={selectedScope}
                                onChange={(e) => setSelectedScope(e.target.value as any)}
                            >
                                <option value="cell">Célula Territorial</option>
                                <option value="neighborhood">Bairro Específico</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase opacity-60">
                                {selectedScope === 'cell' ? 'Célula' : 'Bairro'}
                            </label>
                            <select
                                className="field"
                                value={selectedId}
                                onChange={(e) => setSelectedId(e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {selectedScope === 'cell'
                                    ? cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                                    : neighborhoods.map(n => <option key={n.id} value={n.id}>{n.name}</option>)
                                }
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase opacity-60">Início do Ciclo</label>
                            <input type="date" className="field" defaultValue={new Date().toISOString().split('T')[0]} />
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase opacity-60">Novos Usuários/Dia (W0)</label>
                            <input type="number" className="field" defaultValue={20} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase opacity-60">Novos Pedidos/Janela (W0)</label>
                            <input type="number" className="field" defaultValue={15} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase opacity-60">Crescimento Semanal (%)</label>
                            <input type="number" className="field" defaultValue={25} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase opacity-60">Saúde Mínima (Throttle)</label>
                            <input type="number" className="field" defaultValue={80} />
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                        <button className="cta-button bg-primary text-white">CRIAR PLANO ATIVO</button>
                    </div>
                </section>
            )}

            <div className="grid grid-cols-1 gap-6">
                {plans.length === 0 ? (
                    <div className="card text-center py-24 border-dashed">
                        <Rocket className="mx-auto mb-4 opacity-20" size={48} />
                        <p className="font-bold uppercase text-muted">Nenhum plano de abertura gradual configurado.</p>
                    </div>
                ) : (
                    plans.map((plan) => {
                        const state = states[plan.id];
                        return (
                            <div key={plan.id} className={`card border-2 ${plan.status === 'active' ? 'border-foreground shadow-[8px_8px_0_0_rgba(0,0,0,1)]' : 'border-muted opacity-60'}`}>
                                <div className="flex flex-col md:flex-row justify-between gap-6">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-black text-[10px] uppercase px-2 py-0.5 bg-foreground text-white">
                                                {plan.scope === 'cell' ? 'CÉLULA' : 'BAIRRO'}
                                            </span>
                                            <span className={`font-black text-[10px] uppercase px-2 py-0.5 border-2 border-foreground ${plan.status === 'active' ? 'bg-green-500' : 'bg-muted'}`}>
                                                {plan.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <h3 className="stencil-text text-2xl mb-1">
                                            {plan.scope === 'cell' ? plan.cell?.name : plan.neighborhood?.name}
                                        </h3>
                                        <p className="text-xs font-bold uppercase text-muted mb-4">Início: {new Date(plan.start_date).toLocaleDateString()}</p>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black uppercase opacity-60">Crescimento</span>
                                                <span className="font-black text-sm">+{plan.weekly_growth_pct}% / SEM</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black uppercase opacity-60">Teto Usuários</span>
                                                <span className="font-black text-sm">{plan.max_cap_users_per_day} / DIA</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black uppercase opacity-60">Saúde Mín.</span>
                                                <span className="font-black text-sm text-primary">{plan.min_health_score}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black uppercase opacity-60">Incid. Críticos</span>
                                                <span className="font-black text-sm text-accent">{plan.max_open_incidents_critical}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full md:w-72 bg-muted/10 p-4 border-l-2 border-foreground flex flex-col justify-between">
                                        {state ? (
                                            <>
                                                <div>
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] font-black uppercase opacity-60">Status Hoje</span>
                                                            <div className="flex items-center gap-2">
                                                                {state.computed_is_open ? <CheckCircle2 className="text-green-600" size={16} /> : <XCircle className="text-accent" size={16} />}
                                                                <span className="font-black text-xs uppercase">{state.computed_open_mode.replace('_', ' ')}</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            disabled={refreshing}
                                                            onClick={() => handleRefresh(plan.scope, plan.cell_id || plan.neighborhood_id)}
                                                            className="p-2 hover:bg-white rounded transition shadow-sm"
                                                        >
                                                            <RefreshCcw className={refreshing ? 'animate-spin' : ''} size={14} />
                                                        </button>
                                                    </div>

                                                    <div className="space-y-2 mb-4">
                                                        <div className="flex justify-between">
                                                            <span className="text-[8px] font-bold uppercase opacity-60">Lim. Usuários</span>
                                                            <span className="text-[10px] font-black">{state.computed_max_new_users_per_day}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-[8px] font-bold uppercase opacity-60">Lim. Pedidos</span>
                                                            <span className="text-[10px] font-black">{state.computed_max_new_requests_per_window}</span>
                                                        </div>
                                                    </div>

                                                    <div className="bg-black/5 p-2 rounded">
                                                        <p className="text-[9px] font-bold uppercase leading-tight italic opacity-70">
                                                            {state.computed_reason || 'Pulsando normalmente'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full gap-2">
                                                <AlertCircle className="text-muted" size={24} />
                                                <button
                                                    onClick={() => handleRefresh(plan.scope, plan.cell_id || plan.neighborhood_id)}
                                                    className="font-black text-[10px] uppercase underline"
                                                >
                                                    CALCULAR ESTADO
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <section className="mt-12 card border-dashed">
                <h2 className="stencil-text text-sm mb-4 flex items-center gap-2">
                    <ShieldCheck size={16} /> ESTRATÉGIA ANTI-VIGILÂNCIA
                </h2>
                <p className="font-bold text-[10px] uppercase leading-relaxed text-muted">
                    O COOP ECO não usa algoritmos de retenção ou vício. O ramp-up serve exclusivamente
                    para proteger a integridade física da rota e a dignidade do trabalho cooperado.
                    Se os limites são atingidos ou a saúde cai, o sistema prioriza o cuidado sobre
                    o crescimento desenfreado.
                </p>
            </section>
        </div>
    );
}
