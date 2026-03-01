"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import { Globe, Plus, ChevronRight, CheckCircle2, Circle, Rocket, Printer, Mail, Layout, MapPin, AlertCircle, ShieldAlert, RefreshCw, Package, TrendingUp, ClipboardList } from "lucide-react";
import Link from "next/link";

export default function EscalaClient() {
    const [cells, setCells] = useState<any[]>([]);
    const [selectedCellId, setSelectedCellId] = useState<string>("");
    const [rollouts, setRollouts] = useState<any[]>([]);
    const [neighborhoods, setNeighborhoods] = useState<any[]>([]);
    const [feedbackBlockers, setFeedbackBlockers] = useState<any[]>([]);
    const [improvementBlockers, setImprovementBlockers] = useState<any[]>([]);
    const [cellStocks, setCellStocks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState("sulfluminense_v1");
    const [isApplying, setIsApplying] = useState(false);
    const [applyLogs, setApplyLogs] = useState<any[]>([]);
    const [taskRollup, setTaskRollup] = useState<any>(null);

    const supabase = createClient();

    useEffect(() => {
        async function loadInitial() {
            const [{ data: cData }, { data: tData }] = await Promise.all([
                supabase.from("eco_cells").select("*").order("name"),
                supabase.from("eco_cell_templates").select("*").order("name")
            ]);

            if (cData) {
                setCells(cData);
                if (cData.length > 0) {
                    setSelectedCellId(cData[0].id);
                    await loadCellData(cData[0].id);
                }
            }
            if (tData) setTemplates(tData);
            setLoading(false);
        }
        loadInitial();
    }, [supabase]);

    const loadCellData = async (cellId: string) => {
        const [{ data: rData }, { data: nData }] = await Promise.all([
            supabase.from("eco_cell_rollouts").select("*, steps:eco_rollout_steps(*)").eq("cell_id", cellId).order("created_at", { ascending: false }),
            supabase.from("eco_cell_neighborhoods").select("*, neighborhood:neighborhoods(*)").eq("cell_id", cellId)
        ]);

        setRollouts(rData || []);
        setNeighborhoods(nData || []);

        const rolloutIds = (rData || []).map(r => r.id);
        if (rolloutIds.length > 0) {
            const { data: lData } = await supabase
                .from("eco_cell_rollout_apply_logs")
                .select("*")
                .in("rollout_id", rolloutIds)
                .order("applied_at", { ascending: false });
            setApplyLogs(lData || []);
        } else {
            setApplyLogs([]);
        }

        // 1. Feedback Blockers (original)
        const { data: bData } = await supabase
            .from("eco_feedback_items")
            .select("*")
            .eq("cell_id", cellId)
            .eq("severity", "blocker")
            .in("status", ["new", "triaged", "planned"]);
        setFeedbackBlockers(bData || []);

        // 2. Improvement Cycle Blockers (A28)
        const { data: cycles } = await supabase
            .from("eco_improvement_cycles")
            .select("id")
            .eq("cell_id", cellId)
            .eq("cycle_kind", 'weekly')
            .eq("status", 'open')
            .order("period_start", { ascending: false })
            .limit(1);

        if (cycles?.[0]) {
            const { data: iData } = await supabase
                .from("eco_improvement_items")
                .select("*")
                .eq("cycle_id", cycles[0].id)
                .eq("severity", 'blocker')
                .neq("status", 'done');
            setImprovementBlockers(iData || []);
        } else {
            setImprovementBlockers([]);
        }

        const { data: sData } = await supabase
            .from("eco_asset_stocks")
            .select("*, asset:eco_assets_catalog(*)")
            .eq("cell_id", cellId);
        setCellStocks(sData || []);

        // Weekly Task Rollup (A50)
        const monday = new Date();
        monday.setDate(monday.getDate() - monday.getDay() + (monday.getDay() === 0 ? -6 : 1));
        const mondayStr = monday.toISOString().split('T')[0];

        const { data: rollupData } = await supabase
            .from("eco_task_rollups_weekly")
            .select("*")
            .eq("cell_id", cellId)
            .eq("week_start", mondayStr)
            .maybeSingle();
        setTaskRollup(rollupData);
    };

    const createRollout = async () => {
        if (!selectedCellId) return;
        const { data: { user } } = await supabase.auth.getUser();

        const { data: rollout, error: rError } = await supabase
            .from("eco_cell_rollouts")
            .insert({
                cell_id: selectedCellId,
                status: 'setup',
                created_by: user?.id
            })
            .select()
            .single();

        if (rError) {
            alert(rError.message);
            return;
        }

        const steps = [
            'choose_anchor_partners',
            'create_windows',
            'create_drop_points',
            'print_kits',
            'generate_invites',
            'first_week_bulletin'
        ];

        const { error: sError } = await supabase
            .from("eco_rollout_steps")
            .insert(steps.map(key => ({
                rollout_id: rollout.id,
                step_key: key,
                status: 'todo'
            })));

        if (sError) alert(sError.message);
        else loadCellData(selectedCellId);
    };

    const applyTemplate = async (rolloutId: string) => {
        setIsApplying(true);
        try {
            const { data, error } = await supabase.rpc('rpc_apply_cell_template', {
                p_rollout_id: rolloutId,
                p_template_slug: selectedTemplate
            });

            if (error) throw error;

            alert("Pacote de escala aplicado com sucesso!");
            await loadCellData(selectedCellId);
        } catch (err: any) {
            alert("Erro ao aplicar template: " + err.message);
        } finally {
            setIsApplying(false);
        }
    };

    const toggleStep = async (stepId: string, currentStatus: string, stepKey: string) => {
        const newStatus = currentStatus === 'done' ? 'todo' : 'done';

        if (newStatus === 'done' && stepKey === 'print_kits') {
            const hasStock = cellStocks.some(s => s.qty_on_hand > 0);
            if (!hasStock) {
                alert("Não é possível concluir: Nenhum item em estoque ou movimentação registrada para esta célula.");
                return;
            }
        }

        const { error } = await supabase
            .from("eco_rollout_steps")
            .update({
                status: newStatus,
                completed_at: newStatus === 'done' ? new Date().toISOString() : null
            })
            .eq("id", stepId);

        if (error) alert(error.message);
        else loadCellData(selectedCellId);
    };

    if (loading) return <LoadingBlock text="Carregando matriz de escala..." />;

    const currentCell = cells.find(c => c.id === selectedCellId);
    const activeRollout = rollouts[0];

    return (
        <div className="animate-slide-up pb-12">
            {/* A56 Breadcrumb */}
            <Link href="/admin" className="text-[10px] font-black uppercase text-muted underline mb-4 flex w-fit">
                &lt; VOLTAR PARA O PAINEL ADMIN
            </Link>

            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <Globe className="text-secondary" size={32} />
                    <h1 className="stencil-text text-3xl">ESCALA POR CÉLULAS</h1>
                </div>

                <div className="flex gap-2">
                    <select
                        className="field max-w-xs"
                        value={selectedCellId}
                        onChange={(e) => {
                            setSelectedCellId(e.target.value);
                            loadCellData(e.target.value);
                        }}
                    >
                        {cells.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <button className="cta-button small" onClick={() => setIsCreating(true)}>
                        <Plus size={16} /> NOVA CÉLULA
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 flex flex-col gap-8">
                    {/* Dashboard da Célula */}
                    <section className="card">
                        <h2 className="stencil-text text-lg mb-4 flex items-center gap-2">
                            <MapPin size={20} /> TERRITÓRIO: {currentCell?.name}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <span className="font-black text-[10px] uppercase text-muted">Bairros Ativos</span>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {neighborhoods.map(n => (
                                        <span key={n.neighborhood_id} className="bg-secondary/10 border border-secondary px-2 py-1 font-bold text-xs uppercase">
                                            {n.neighborhood?.name}
                                        </span>
                                    ))}
                                    {neighborhoods.length === 0 && <span className="text-muted-foreground text-xs font-bold uppercase italic">Nenhum bairro vinculado</span>}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="font-black text-[10px] uppercase text-muted">Ações de Expansão</span>
                                <button
                                    onClick={createRollout}
                                    className="cta-button small w-full justify-center bg-secondary text-white"
                                >
                                    INICIAR NOVO ROLLOUT (SETUP)
                                </button>
                                <Link
                                    href="/admin/campanha"
                                    className="cta-button small w-full justify-center border-2 border-foreground"
                                >
                                    CAMPANHAS DE CULTURA
                                </Link>
                            </div>
                        </div>
                    </section>

                    {/* Força de Trabalho (A50) */}
                    {taskRollup && (
                        <section className="animate-slide-up flex flex-col gap-6">
                            <h2 className="stencil-text text-xl flex items-center gap-2">
                                <ClipboardList size={24} className="text-secondary" /> TRABALHO DO COMUM (SEMANA)
                            </h2>
                            <div className="card bg-foreground text-white p-6 flex flex-col md:flex-row items-center justify-between gap-8 border-l-8 border-secondary shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                                <div className="flex flex-col items-center md:items-start shrink-0">
                                    <span className="text-[10px] font-black uppercase opacity-60">Entregáveis</span>
                                    <span className="stencil-text text-5xl text-secondary">{taskRollup.done_count}</span>
                                </div>
                                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                                    {Object.entries(taskRollup.kinds || {}).map(([kind, count]: [string, any]) => (
                                        <div key={kind} className="flex flex-col border-l-2 border-white/10 pl-3">
                                            <span className="text-[8px] font-black uppercase opacity-60 line-clamp-1">{kind}</span>
                                            <span className="font-black text-xl">{count}</span>
                                        </div>
                                    ))}
                                </div>
                                <Link href="/admin/tarefas" className="cta-button tiny bg-secondary text-white whitespace-nowrap">
                                    MAPEAR IMPACTO
                                </Link>
                            </div>
                        </section>
                    )}

                    {/* Setup Guiado (Rollout) */}
                    {activeRollout && (
                        <section className="animate-slide-up flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <h2 className="stencil-text text-xl flex items-center gap-2">
                                    <Rocket size={24} className="text-secondary" /> SETUP DA CÉLULA
                                </h2>
                                <span className={`px-2 py-0.5 border-2 border-foreground font-black text-xs uppercase ${activeRollout.status === 'setup' ? 'bg-yellow-400' : 'bg-primary'}`}>
                                    STATUS: {activeRollout.status}
                                </span>
                            </div>

                            {/* Aplicar Template (A27) */}
                            {activeRollout.status === 'setup' && (
                                <div className="card bg-secondary/10 border-2 border-secondary p-6">
                                    <h3 className="stencil-text text-sm mb-4">ACELERAR IMPLANTAÇÃO (SCALE PACK)</h3>
                                    <div className="flex flex-col md:flex-row gap-4">
                                        <select
                                            className="field flex-1"
                                            value={selectedTemplate}
                                            onChange={(e) => setSelectedTemplate(e.target.value)}
                                        >
                                            {templates.map(t => (
                                                <option key={t.id} value={t.slug}>{t.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            className="cta-button bg-secondary text-white"
                                            onClick={() => applyTemplate(activeRollout.id)}
                                            disabled={isApplying}
                                        >
                                            {isApplying ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Rocket className="mr-2" size={16} />}
                                            APLICAR TEMPLATE
                                        </button>
                                    </div>
                                    <p className="text-[10px] font-bold uppercase mt-3 opacity-60">
                                        Isso criará automaticamente janelas, convites, controles de lançamento e missões iniciais.
                                    </p>
                                </div>
                            )}

                            {/* Resumo da Aplicação */}
                            {applyLogs.length > 0 && (
                                <div className="flex flex-col gap-4">
                                    <div className="card border-2 border-foreground bg-white">
                                        <h3 className="stencil-text text-xs mb-3">CONTAGEM DE IMPLANTAÇÃO</h3>
                                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                            {[
                                                { label: 'Bairros', key: 'neighborhoods', color: 'bg-muted' },
                                                { label: 'Janelas', key: 'windows', color: 'bg-primary/20' },
                                                { label: 'Controles', key: 'controls', color: 'bg-secondary/20' },
                                                { label: 'Invites', key: 'invites', color: 'bg-accent/20' },
                                                { label: 'Estoque', key: 'assets', color: 'bg-orange-100' },
                                                { label: 'Missões', key: 'missions', color: 'bg-green-100' }
                                            ].map(stat => (
                                                <div key={stat.key} className={`p-2 flex flex-col items-center justify-center border border-foreground ${stat.color}`}>
                                                    <span className="font-black text-xs">{(applyLogs[0].summary || {})[stat.key] || 0}</span>
                                                    <span className="text-[8px] font-bold uppercase">{stat.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Quick Actions (A27) */}
                                    <div className="flex flex-wrap gap-2">
                                        <Link href="/admin/piloto" className="cta-button tiny bg-white border-2 border-foreground">
                                            <Printer size={12} className="mr-1" /> PLACAS DOS PONTOS
                                        </Link>
                                        <Link href="/admin/operacao" className="cta-button tiny bg-white border-2 border-foreground">
                                            <Package size={12} className="mr-1" /> KIT DO OPERADOR
                                        </Link>
                                        <Link href={`/admin/logistica?cell_id=${selectedCellId}`} className="cta-button tiny bg-white border-2 border-foreground">
                                            <RefreshCw size={12} className="mr-1" /> VER DÉFICIT DE ESTOQUE
                                        </Link>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-3">
                                {activeRollout.steps?.map((step: any) => (
                                    <div key={step.id} className="card bg-white hover:border-secondary transition-colors group">
                                        <div className="flex items-center justify-between gap-4">
                                            <button
                                                onClick={() => toggleStep(step.id, step.status, step.step_key)}
                                                className="flex items-center gap-3 text-left flex-1"
                                            >
                                                {step.status === 'done' ? (
                                                    <CheckCircle2 size={24} className="text-secondary shrink-0" />
                                                ) : (
                                                    <Circle size={24} className="opacity-20 shrink-0" />
                                                )}
                                                <div>
                                                    <h3 className={`font-black text-sm uppercase ${step.status === 'done' ? 'line-through opacity-50' : ''}`}>
                                                        {step.step_key.replace(/_/g, ' ')}
                                                    </h3>
                                                    <p className="text-[10px] font-bold uppercase text-muted">Ação mandatória para expansão saudável</p>
                                                </div>
                                            </button>

                                            {/* Deep Links depending on step */}
                                            <div className="flex gap-2">
                                                {step.step_key === 'choose_anchor_partners' && (
                                                    <Link href="/admin/ancoras" className="p-2 border-2 border-foreground hover:bg-secondary hover:text-white transition-all">
                                                        <Plus size={14} />
                                                    </Link>
                                                )}
                                                {step.step_key === 'create_windows' && (
                                                    <Link href="/admin/rotas" className="p-2 border-2 border-foreground hover:bg-secondary hover:text-white transition-all">
                                                        <Layout size={14} />
                                                    </Link>
                                                )}
                                                {step.step_key === 'create_drop_points' && (
                                                    <Link href="/admin/pontos" className="p-2 border-2 border-foreground hover:bg-secondary hover:text-white transition-all">
                                                        <MapPin size={14} />
                                                    </Link>
                                                )}
                                                {step.step_key === 'print_kits' && (
                                                    <Link href="/admin/operacao" className="p-2 border-2 border-foreground hover:bg-secondary hover:text-white transition-all">
                                                        <Printer size={14} />
                                                    </Link>
                                                )}
                                                {step.step_key === 'generate_invites' && (
                                                    <Link href="/admin/piloto" className="p-2 border-2 border-foreground hover:bg-secondary hover:text-white transition-all">
                                                        <Mail size={14} />
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Sidebar: Governança e Transparência */}
                <aside className="flex flex-col gap-8">
                    <section className="card bg-foreground text-white border-foreground">
                        <h3 className="stencil-text text-sm mb-4 uppercase text-secondary">Governança de Escala</h3>
                        <div className="flex flex-col gap-3">
                            <div className="bg-white/5 p-3 border-l-4 border-secondary">
                                <p className="text-[10px] font-black uppercase mb-1 flex items-center gap-1">
                                    <AlertCircle size={10} /> Regra Anti-Captura
                                </p>
                                <p className="text-[10px] font-bold uppercase opacity-60">
                                    Toda nova célula deve possuir pelo menos 1 papel rotativo (A11) configurado antes de rodar.
                                </p>
                            </div>
                            <Link href="/admin/governanca" className="cta-button small w-full justify-between" style={{ background: 'white' }}>
                                LIVRO DE DECISÕES
                                <ChevronRight size={16} />
                            </Link>
                        </div>
                    </section>

                    <section className="card border-2 border-foreground bg-white">
                        <h3 className="stencil-text text-sm mb-4 uppercase flex items-center justify-between">
                            <span>Estoque da Célula</span>
                            <Link href="/admin/logistica" className="text-[10px] underline">Gerenciar</Link>
                        </h3>
                        <div className="flex flex-col gap-2">
                            {cellStocks.length === 0 ? (
                                <p className="text-[10px] font-bold uppercase text-center opacity-50 py-4">Sem estoque registrado.</p>
                            ) : (
                                cellStocks.slice(0, 4).map((s: any) => (
                                    <div key={s.id} className="flex justify-between items-center text-[10px] font-bold uppercase">
                                        <span className="text-black">{s.asset?.name}</span>
                                        <span className={s.qty_on_hand < s.qty_min ? 'text-red-600' : 'text-black'}>{s.qty_on_hand}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    <section className="card border-2 border-secondary bg-secondary/5">
                        <h3 className="stencil-text text-sm mb-4 uppercase">Playbook In-App</h3>
                        <ul className="flex flex-col gap-4 list-none p-0">
                            <li className="flex gap-3">
                                <div className="bg-secondary text-white p-1 font-black text-[10px]">FIXO</div>
                                <div>
                                    <p className="font-bold text-xs uppercase">Bairro a Bairro</p>
                                    <p className="text-[10px] text-muted">Não acelerar além da capacidade operacional (A15.1).</p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <div className="bg-secondary text-white p-1 font-black text-[10px]">FIXO</div>
                                <div>
                                    <p className="font-bold text-xs uppercase">Concreto e Stencil</p>
                                    <p className="text-[10px] text-muted">Manter estética brutalista nos kits impressos.</p>
                                </div>
                            </li>
                        </ul>
                    </section>

                    {/* Blockers de Melhoria Contínua (A28) */}
                    {improvementBlockers.length > 0 && (
                        <section className="card border-2 border-red-600 bg-red-50 animate-pulse">
                            <h3 className="stencil-text text-sm mb-4 text-red-600 flex items-center justify-between">
                                <span className="flex items-center gap-2 px-2 py-0.5 bg-red-600 text-white border-2 border-foreground">
                                    <TrendingUp size={14} /> CICLO: BLOCKERS ({improvementBlockers.length})
                                </span>
                                <Link href={`/admin/melhorias?cell_id=${selectedCellId}`} className="text-[10px] underline font-black uppercase">Resolver</Link>
                            </h3>
                            <div className="flex flex-col gap-2">
                                {improvementBlockers.slice(0, 3).map(b => (
                                    <div key={b.id} className="flex flex-col">
                                        <p className="font-black text-[10px] uppercase leading-tight">{b.title}</p>
                                        <p className="text-[8px] font-bold uppercase opacity-50">{b.category} • {b.source_kind}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {feedbackBlockers.length > 0 && (
                        <section className="card border-2 border-red-600 bg-red-50">
                            <h3 className="stencil-text text-sm mb-4 text-red-600 flex items-center justify-between">
                                <span className="flex items-center gap-2 px-2 py-0.5 bg-red-600 text-white border-2 border-foreground">
                                    <ShieldAlert size={14} /> FEEDBACK: FEEDBACK ({feedbackBlockers.length})
                                </span>
                                <Link href={`/admin/feedback?cell_id=${selectedCellId}&severity=blocker`} className="text-[10px] underline font-black uppercase">Triar</Link>
                            </h3>
                            <div className="flex flex-col gap-2">
                                {feedbackBlockers.slice(0, 2).map(b => (
                                    <div key={b.id} className="flex flex-col">
                                        <p className="font-black text-xs uppercase leading-tight">{b.summary}</p>
                                        <p className="text-[9px] font-bold uppercase opacity-50">{new Date(b.created_at).toLocaleDateString()}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="card border-2 border-primary bg-primary/5">
                        <h3 className="stencil-text text-sm mb-4 uppercase flex items-center justify-between">
                            <span>Prontidão de Formação</span>
                            <Link href="/admin/formacao" className="text-[10px] underline">Painel</Link>
                        </h3>
                        <div className="p-3 bg-white border border-primary/20 flex flex-col gap-3">
                            <div className="flex justify-between items-center text-[9px] font-black uppercase">
                                <span>Operadores Formados</span>
                                <span>Min: 2</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <ShieldAlert size={14} className="text-orange-500" />
                                <p className="text-[9px] font-bold uppercase opacity-70">Recomenda-se formar mais 1 curador antes do ramp-up.</p>
                            </div>
                        </div>
                    </section>

                    <div className="flex flex-col gap-3">
                        <Link href="/reports" className="card hover:bg-muted/5 transition-colors flex items-center justify-between py-3 px-4 bg-white/50">
                            <span className="font-black text-[10px] uppercase text-muted">Arquivos de Impacto</span>
                            <ChevronRight size={14} />
                        </Link>
                    </div>
                </aside>
            </div>
        </div>
    );
}
