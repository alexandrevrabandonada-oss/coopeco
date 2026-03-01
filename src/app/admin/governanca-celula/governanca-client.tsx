"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    ShieldCheck,
    Users,
    ScrollText,
    Gavel,
    Plus,
    RefreshCw,
    RotateCcw,
    XCircle,
    CheckCircle2,
    ChevronRight,
    ExternalLink,
    FileText,
    Vote as VoteIcon,
    AlertCircle,
    Copy,
    Save
} from "lucide-react";
import Link from "next/link";

export default function GovernancaCélulaClient() {
    const [cells, setCells] = useState<any[]>([]);
    const [selectedCellId, setSelectedCellId] = useState<string>("");
    const [charter, setCharter] = useState<any>(null);
    const [roles, setRoles] = useState<any[]>([]);
    const [activeTerms, setActiveTerms] = useState<any[]>([]);
    const [assemblies, setAssemblies] = useState<any[]>([]);
    const [proposals, setProposals] = useState<any[]>([]);
    const [blockers, setBlockers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'charter' | 'roles' | 'decisions'>('roles');

    const supabase = createClient();

    useEffect(() => {
        async function loadInitial() {
            const { data: cData } = await supabase.from("eco_cells").select("*").order("name");
            if (cData) {
                setCells(cData);
                if (cData.length > 0) {
                    setSelectedCellId(cData[0].id);
                    await loadCellGovernance(cData[0].id);
                }
            }
            setLoading(false);
        }
        loadInitial();
    }, [supabase]);

    const loadCellGovernance = async (cellId: string) => {
        setLoading(true);
        const [
            { data: chData },
            { data: rData },
            { data: tData },
            { data: aData },
            { data: pData }
        ] = await Promise.all([
            supabase.from("eco_cell_charters").select("*").eq("cell_id", cellId).maybeSingle(),
            supabase.from("eco_cell_roles").select("*").eq("cell_id", cellId),
            supabase.from("eco_cell_role_terms").select("*, profile:profiles(name)").eq("cell_id", cellId).eq("status", "active"),
            supabase.from("eco_cell_assemblies").select("*").eq("cell_id", cellId).order("scheduled_for", { ascending: false }),
            supabase.from("eco_cell_proposals").select("*").eq("cell_id", cellId).order("created_at", { ascending: false })
        ]);

        setCharter(chData);
        setRoles(rData || []);
        setActiveTerms(tData || []);
        setAssemblies(aData || []);
        setProposals(pData || []);

        // Fetch blockers from A28 (Monthly cycle)
        const { data: cycleData } = await supabase
            .from("eco_improvement_cycles")
            .select("id")
            .eq("cell_id", cellId)
            .eq("cycle_kind", "monthly")
            .eq("status", "open")
            .order("period_start", { ascending: false })
            .limit(1);

        if (cycleData?.[0]) {
            const { data: bData } = await supabase
                .from("eco_improvement_items")
                .select("*")
                .eq("cycle_id", cycleData[0].id)
                .eq("severity", "blocker")
                .neq("status", "done");
            setBlockers(bData || []);
        } else {
            setBlockers([]);
        }

        setLoading(false);
    };

    const handleAssignRole = async (roleKey: string) => {
        const userId = prompt("ID do Usuário para assumir o papel:");
        if (!userId) return;
        const days = prompt("Duração do mandato (dias):", "30");
        if (!days) return;

        setActionLoading(true);
        try {
            const { error } = await supabase.rpc('rpc_assign_role_term', {
                p_cell_id: selectedCellId,
                p_role_key: roleKey,
                p_holder_id: userId,
                p_days: parseInt(days)
            });
            if (error) throw error;
            await loadCellGovernance(selectedCellId);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRevokeRole = async (termId: string) => {
        const reason = prompt("Motivo da revogação (sanitizado):");
        if (!reason) return;

        setActionLoading(true);
        try {
            const { error } = await supabase.rpc('rpc_revoke_role_term', {
                p_term_id: termId,
                p_reason: reason
            });
            if (error) throw error;
            await loadCellGovernance(selectedCellId);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const createProposalFromBlocker = async (blocker: any) => {
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc('rpc_create_proposal', {
                p_cell_id: selectedCellId,
                p_title: `Resolução: ${blocker.title}`,
                p_body_md: `Proposta de intervenção sistêmica baseada no bloqueador operacional: ${blocker.summary}`,
                p_decision_type: 'operation'
            });
            if (error) throw error;
            alert("Proposta criada como rascunho!");
            await loadCellGovernance(selectedCellId);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenVoting = async (proposalId: string) => {
        const days = prompt("A votação fecha em quantos dias?", "7");
        if (!days) return;
        const closesAt = new Date();
        closesAt.setDate(closesAt.getDate() + parseInt(days));

        setActionLoading(true);
        try {
            const { error } = await supabase.rpc('rpc_open_voting', {
                p_proposal_id: proposalId,
                p_closes_at: closesAt.toISOString()
            });
            if (error) throw error;
            await loadCellGovernance(selectedCellId);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCloseVoting = async (proposalId: string) => {
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc('rpc_close_voting', {
                p_proposal_id: proposalId
            });
            if (error) throw error;
            alert("Votação encerrada! Recibo de decisão gerado.");
            await loadCellGovernance(selectedCellId);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading && !selectedCellId) return <LoadingBlock text="Carregando governança..." />;

    const cell = cells.find(c => c.id === selectedCellId);

    return (
        <div className="animate-slide-up pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="text-primary" size={32} />
                    <h1 className="stencil-text text-3xl">GOVERNANÇA DA CÉLULA</h1>
                </div>

                <div className="flex gap-2">
                    <select
                        className="field max-w-xs"
                        value={selectedCellId}
                        onChange={(e) => {
                            setSelectedCellId(e.target.value);
                            loadCellGovernance(e.target.value);
                        }}
                    >
                        {cells.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </header>

            <div className="flex gap-1 mb-6 border-b-2 border-foreground/10">
                <button
                    className={`px-6 py-2 font-black text-xs uppercase transition-all ${activeTab === 'roles' ? 'border-b-4 border-primary text-primary bg-primary/5' : 'opacity-40 hover:opacity-100'}`}
                    onClick={() => setActiveTab('roles')}
                >
                    Gestão de Mandatos
                </button>
                <button
                    className={`px-6 py-2 font-black text-xs uppercase transition-all ${activeTab === 'decisions' ? 'border-b-4 border-primary text-primary bg-primary/5' : 'opacity-40 hover:opacity-100'}`}
                    onClick={() => setActiveTab('decisions')}
                >
                    Assembleia & Votos
                </button>
                <button
                    className={`px-6 py-2 font-black text-xs uppercase transition-all ${activeTab === 'charter' ? 'border-b-4 border-primary text-primary bg-primary/5' : 'opacity-40 hover:opacity-100'}`}
                    onClick={() => setActiveTab('charter')}
                >
                    Carta da Célula
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 flex flex-col gap-6">
                    {activeTab === 'roles' && (
                        <div className="flex flex-col gap-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {roles.map(role => {
                                    const terms = activeTerms.filter(t => t.role_key === role.role_key);
                                    return (
                                        <div key={role.id} className="card bg-white border-2 border-foreground/10 p-5">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="stencil-text text-lg uppercase leading-tight">{role.title}</h3>
                                                    <p className="text-[10px] font-bold uppercase opacity-50">{role.description}</p>
                                                </div>
                                                <button
                                                    className="p-2 bg-muted hover:bg-muted-hover transition-colors"
                                                    onClick={() => handleAssignRole(role.role_key)}
                                                    disabled={actionLoading || terms.length >= role.max_holders}
                                                    title="Novo Mandato"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                {terms.length === 0 ? (
                                                    <p className="text-[10px] font-bold uppercase italic opacity-30 py-2 border-2 border-dashed border-foreground/5 text-center">VAGO</p>
                                                ) : (
                                                    terms.map(term => (
                                                        <div key={term.id} className="bg-muted/30 p-3 border border-foreground/10 flex justify-between items-center group">
                                                            <div className="flex items-center gap-3">
                                                                <Users size={16} className="text-primary opacity-60" />
                                                                <div>
                                                                    <p className="text-xs font-black uppercase">{term.profile?.name || 'Vago'}</p>
                                                                    <p className="text-[8px] font-bold uppercase opacity-50">Até {new Date(term.ends_at).toLocaleDateString()}</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                className="text-red-600 opacity-20 group-hover:opacity-100 transition-opacity"
                                                                onClick={() => handleRevokeRole(term.id)}
                                                                title="Revogar Mandato"
                                                            >
                                                                <XCircle size={16} />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                            <div className="mt-4 flex items-center justify-between">
                                                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 border border-foreground">Rotatividade: {role.rotation_days}d</span>
                                                <span className="text-[8px] font-black uppercase opacity-40">Max: {role.max_holders}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'decisions' && (
                        <div className="flex flex-col gap-8">
                            {blockers.length > 0 && (
                                <section className="card border-2 border-secondary bg-secondary/5">
                                    <h3 className="stencil-text text-sm mb-4 text-secondary flex items-center gap-2">
                                        <AlertCircle size={16} /> BLOQUEADORES PARA RESOLUÇÃO (A28)
                                    </h3>
                                    <div className="flex flex-col gap-3">
                                        {blockers.map(b => (
                                            <div key={b.id} className="flex items-center justify-between p-3 bg-white border border-secondary/20">
                                                <div>
                                                    <p className="font-black text-[10px] uppercase truncate max-w-[400px]">{b.title}</p>
                                                    <p className="text-[8px] font-bold uppercase opacity-50">{b.category} • {b.source_kind}</p>
                                                </div>
                                                <button
                                                    className="cta-button tiny bg-secondary text-white"
                                                    onClick={() => createProposalFromBlocker(b)}
                                                    disabled={actionLoading}
                                                >
                                                    CRIAR PROPOSTA
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            <section className="card bg-white">
                                <div className="flex justify-between items-center mb-6 pb-4 border-b">
                                    <h3 className="stencil-text text-xl flex items-center gap-2">
                                        <Gavel size={24} /> PROPOSTAS & VOTOS
                                    </h3>
                                    <button className="cta-button small bg-foreground text-white">
                                        <Plus size={14} className="mr-2" /> NOVA PAUTA
                                    </button>
                                </div>

                                <div className="flex flex-col gap-4">
                                    {proposals.length === 0 ? (
                                        <p className="py-20 text-center opacity-30 italic font-bold uppercase text-xs">Nenhuma proposta registrada.</p>
                                    ) : (
                                        proposals.map(p => (
                                            <div key={p.id} className="p-5 border-2 border-foreground/5 hover:border-primary transition-all shadow-[4px_4px_0_0_rgba(0,0,0,0.02)]">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-[8px] font-black uppercase px-1 py-0.5 border ${p.status === 'voting' ? 'bg-secondary text-white border-secondary' :
                                                                p.status === 'approved' ? 'bg-primary border-primary' : 'bg-muted'
                                                                }`}>
                                                                {p.status}
                                                            </span>
                                                            <span className="text-[8px] font-bold uppercase text-muted">{p.decision_type}</span>
                                                        </div>
                                                        <h4 className="font-black text-lg uppercase leading-tight">{p.title}</h4>
                                                    </div>
                                                    {p.status === 'draft' && (
                                                        <button
                                                            className="cta-button small"
                                                            onClick={() => handleOpenVoting(p.id)}
                                                            disabled={actionLoading}
                                                        >
                                                            ABRIR VOTOS
                                                        </button>
                                                    )}
                                                    {p.status === 'voting' && (
                                                        <button
                                                            className="cta-button small bg-foreground text-white"
                                                            onClick={() => handleCloseVoting(p.id)}
                                                            disabled={actionLoading}
                                                        >
                                                            FECHAR & APURAR
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="bg-muted/20 p-3 mb-4 rounded-sm italic text-xs border-l-4 border-muted">
                                                    {p.body_md}
                                                </div>
                                                <div className="flex items-center gap-4 text-[10px] font-bold uppercase">
                                                    <span className="flex items-center gap-1"><Users size={12} /> Quorum: {p.quorum_min}</span>
                                                    <span className="flex items-center gap-1"><VoteIcon size={12} /> Threshold: {p.approval_threshold_pct}%</span>
                                                    {p.voting_closes_at && (
                                                        <span className="text-secondary">Fecha em: {new Date(p.voting_closes_at).toLocaleDateString()}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'charter' && (
                        <div className="card bg-white p-8 border-4 border-foreground">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="stencil-text text-2xl uppercase">Carta de Princípios</h3>
                                <div className="flex gap-2">
                                    <button className="cta-button small bg-white border-2 border-foreground">
                                        <Save size={14} className="mr-2" /> SALVAR RASCUNHO
                                    </button>
                                    <button className="cta-button small bg-foreground text-white">
                                        PUBLICAR V{charter?.version || '1.0'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-8">
                                <section>
                                    <label className="text-[10px] font-black uppercase opacity-60 mb-2 block">Princípios do Comum (MD)</label>
                                    <textarea
                                        className="field w-full h-40 font-mono text-xs p-4"
                                        defaultValue={charter?.principles_md || "# Princípios da Célula\n1. Autogestão\n2. Transparência Plena\n3. Dignidade do Trabalho"}
                                    />
                                </section>

                                <section>
                                    <label className="text-[10px] font-black uppercase opacity-60 mb-2 block">Processo Decisório (Quórum, Prazos, Revogação)</label>
                                    <textarea
                                        className="field w-full h-40 font-mono text-xs p-4"
                                        defaultValue={charter?.decision_process_md || "## Quórum Mínimo: 3 membros\n## Maioria: 60%\n## Mandatos: 30 dias com revogabilidade imediata."}
                                    />
                                </section>

                                <section className="p-6 bg-muted/5 border-2 border-foreground border-dashed">
                                    <h4 className="stencil-text text-sm mb-4">SEGURANÇA EDITORIAL (A48)</h4>
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] font-black uppercase">Modo de Revisão</p>
                                                <p className="text-[9px] font-bold opacity-50 uppercase leading-none">Define quando o conteúdo deve passar pelo Hub Editorial.</p>
                                            </div>
                                            <select
                                                className="field text-[10px] py-1"
                                                value={cell?.editorial_mode || 'lint_only'}
                                                onChange={async (e) => {
                                                    const mode = e.target.value;
                                                    const { error } = await supabase
                                                        .from("eco_cells")
                                                        .update({ editorial_mode: mode })
                                                        .eq("id", selectedCellId);
                                                    if (!error) {
                                                        setCells(cells.map(c => c.id === selectedCellId ? { ...c, editorial_mode: mode } : c));
                                                    }
                                                }}
                                            >
                                                <option value="off">DESATIVADO (LIVRE)</option>
                                                <option value="lint_only">SOMENTE COM ALERTAS LINT</option>
                                                <option value="review_required">REVISÃO OBRIGATÓRIA (HUB)</option>
                                            </select>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}
                </div>

                <aside className="flex flex-col gap-8">
                    <section className="card bg-foreground text-white border-foreground">
                        <h3 className="stencil-text text-sm mb-4 uppercase text-primary">Transparência</h3>
                        <div className="flex flex-col gap-3">
                            <Link
                                href={`/celulas/${cell?.slug}/carta`}
                                className="cta-button small w-full justify-between"
                                style={{ background: 'white' }}
                            >
                                VER CARTA PÚBLICA
                                <ExternalLink size={14} />
                            </Link>
                            <Link
                                href={`/celulas/${cell?.slug}/decisoes`}
                                className="cta-button small w-full justify-between"
                                style={{ background: 'white' }}
                            >
                                VER DECISÕES (RECIBOS)
                                <ChevronRight size={14} />
                            </Link>
                        </div>
                    </section>

                    <section className="card border-2 border-foreground bg-white">
                        <h3 className="stencil-text text-sm mb-4 uppercase">Assembleias</h3>
                        <div className="flex flex-col gap-3">
                            {assemblies.length === 0 ? (
                                <p className="text-[10px] font-bold uppercase text-center opacity-40 py-4 italic">Nenhuma assembleia agendada.</p>
                            ) : (
                                assemblies.slice(0, 3).map(a => (
                                    <div key={a.id} className="flex flex-col p-2 border border-foreground/10 bg-muted/20">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[8px] font-black uppercase px-1 border border-foreground bg-white">{a.kind}</span>
                                            <span className={`text-[8px] font-black uppercase px-1 ${a.status === 'open' ? 'text-secondary' : 'text-muted'}`}>{a.status}</span>
                                        </div>
                                        <p className="text-[10px] font-black uppercase">{new Date(a.scheduled_for).toLocaleString()}</p>
                                    </div>
                                ))
                            )}
                            <button className="cta-button small w-full mt-2">
                                <Plus size={14} className="mr-2" /> AGENDAR SESSÃO
                            </button>
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}
