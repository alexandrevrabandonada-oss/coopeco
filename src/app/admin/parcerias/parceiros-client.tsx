"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import { ShieldCheck, Target, Award, AlertTriangle, UserPlus, History, ExternalLink, MoreVertical, Star, Ban, CheckCircle2 } from "lucide-react";
import { lintCopy } from "@/lib/copy/lint";
import Link from "next/link";

export default function ParceirosClient() {
    const [loading, setLoading] = useState(true);
    const [partners, setPartners] = useState<any[]>([]);
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    // Triage state
    const [selectedPartnerId, setSelectedPartnerId] = useState("");
    const [publicNotes, setPublicNotes] = useState("");
    const [internalNotes, setInternalNotes] = useState("");

    const supabase = createClient();

    useEffect(() => {
        refreshData();
    }, [supabase]);

    const refreshData = async () => {
        setLoading(true);
        const { data: rData } = await supabase.from("v_partner_recommendations").select("*").order("receipts_count_30d", { ascending: false });
        const { data: sData } = await supabase.from("eco_partner_status").select("*");

        // Merge recommendations with existing status metadata
        const merged = (rData || []).map(r => {
            const statusMeta = (sData || []).find(s => s.partner_id === r.partner_id);
            return { ...r, ...statusMeta };
        });

        setPartners(merged);
        setRecommendations(merged.filter(p => p.recommendation !== 'keep_current'));
        setLoading(false);
    };

    const handleAction = async (partnerId: string, action: string, tier?: string) => {
        setSaving(true);
        const { error } = await supabase.rpc('rpc_review_partner_status', {
            p_partner_id: partnerId,
            p_action: action,
            p_tier: tier
        });

        if (error) alert(error.message);
        else {
            if (publicNotes || internalNotes) {
                // A43: Copy Anti-Culpa Linting for Public Notes
                if (publicNotes) {
                    const lintResult = await lintCopy(publicNotes, { source_kind: 'partner_notes_public' });
                    if (!lintResult.ok) {
                        const blockers = lintResult.findings.filter(f => f.severity === 'blocker');
                        alert(`BLOQUEIO DE LINGUAGEM (Anti-Culpa):\n\n${blockers.map(b => `- ${b.excerpt}: ${b.hint}`).join('\n')}\n\nA nota pública não foi salva para proteger o parceiro de exposição punitiva.`);
                        setSaving(false);
                        return;
                    }
                }

                await supabase.from("eco_partner_status").upsert({
                    partner_id: partnerId,
                    notes_public: publicNotes,
                    notes_internal: internalNotes
                });
            }
            alert("Status atualizado com sucesso!");
            setPublicNotes("");
            setInternalNotes("");
            await refreshData();
        }
        setSaving(false);
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'anchor': return 'bg-primary text-black border-primary';
            case 'partner': return 'bg-green-500 text-white border-green-700';
            case 'suspended': return 'bg-red-500 text-white border-red-700';
            case 'inactive': return 'bg-muted text-muted-foreground border-muted';
            default: return 'bg-white text-muted-foreground border-foreground/20';
        }
    };

    if (loading) return <LoadingBlock text="Auditando parcerias do comum..." />;

    return (
        <div className="animate-slide-up pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="text-secondary" size={32} />
                    <h1 className="stencil-text text-3xl">POLÍTICA DE PARCERIAS</h1>
                </div>

                <div className="flex gap-2">
                    <button className="cta-button small" onClick={refreshData}>ATUALIZAR MÉTRICAS</button>
                    <Link href="/reports" className="cta-button small bg-white">REPORTS</Link>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 flex flex-col gap-8">

                    {/* Recomendações de Status */}
                    {recommendations.length > 0 && (
                        <section className="animate-slide-up">
                            <h2 className="stencil-text text-lg mb-4 flex items-center gap-2">
                                <Award size={20} className="text-secondary" /> RECOMENDAÇÕES (BEHAVIOR-BASED)
                            </h2>
                            <div className="flex flex-col gap-3">
                                {recommendations.map(p => (
                                    <div key={p.partner_id} className="card border-2 border-secondary bg-secondary/5 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div>
                                            <p className="font-black text-sm uppercase">{p.partner_name}</p>
                                            <p className="text-[10px] font-bold uppercase text-secondary">
                                                Ação sugerida: <span className="underline">{p.recommendation.replace(/_/g, ' ')}</span>
                                            </p>
                                            <div className="mt-2 text-[8px] font-black uppercase opacity-60 flex gap-4">
                                                <span>Recibos 30d: {p.receipts_count_30d}</span>
                                                <span>Qualidade: {Math.round(p.ok_rate_30d * 100)}%</span>
                                                <span>Inativo há: {p.inactivity_days || 0} dias</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {p.recommendation === 'promote_to_partner' && (
                                                <button onClick={() => handleAction(p.partner_id, 'promote_candidate_to_partner', 'bronze')} className="cta-button tiny bg-green-500 text-white">PROMOVER</button>
                                            )}
                                            {p.recommendation === 'mark_inactive' && (
                                                <button onClick={() => handleAction(p.partner_id, 'suspend_partner')} className="cta-button tiny bg-muted text-black">INATIVAR</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Lista Completa de Parceiros */}
                    <section className="card p-0 overflow-hidden">
                        <div className="p-4 border-b-2 border-foreground bg-muted/5 flex items-center justify-between">
                            <h2 className="stencil-text text-sm flex items-center gap-2 uppercase">
                                <Target size={16} /> Monitoramento de Impacto
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-foreground text-white">
                                    <tr>
                                        <th className="p-4 stencil-text text-[10px] uppercase">Parceiro</th>
                                        <th className="p-4 stencil-text text-[10px] uppercase text-center">Status/Tier</th>
                                        <th className="p-4 stencil-text text-[10px] uppercase text-center">Atividade 30d</th>
                                        <th className="p-4 stencil-text text-[10px] uppercase text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {partners.map(p => (
                                        <tr key={p.partner_id} className="border-b-2 border-foreground/10 hover:bg-muted/5">
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-xs uppercase">{p.partner_name}</span>
                                                    <span className="text-[9px] text-muted font-bold uppercase">{p.current_status || 'Sem status'}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`px-2 py-0.5 border-2 font-black text-[9px] uppercase ${getStatusStyle(p.current_status)}`}>
                                                        {p.current_status || 'candidate'}
                                                    </span>
                                                    {p.tier && <span className="text-[8px] font-black uppercase text-secondary flex items-center gap-1">
                                                        <Star size={8} fill="currentColor" /> {p.tier}
                                                    </span>}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col items-center">
                                                    <span className="font-black text-xs">{p.receipts_count_30d} recibos</span>
                                                    <div className="w-16 bg-muted h-1 mt-1 border border-foreground/10">
                                                        <div className="bg-primary h-full" style={{ width: `${Math.min(100, p.ok_rate_30d * 100)}%` }} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <select
                                                    className="field tiny font-bold uppercase text-[9px]"
                                                    onChange={(e) => {
                                                        if (e.target.value === 'none') return;
                                                        const [action, tier] = e.target.value.split('|');
                                                        handleAction(p.partner_id, action, tier || undefined);
                                                        e.target.value = 'none';
                                                    }}
                                                >
                                                    <option value="none">MUDAR STATUS...</option>
                                                    <option value="promote_candidate_to_partner|bronze">PARTNER (BRONZE)</option>
                                                    <option value="promote_partner_to_anchor|prata">ÂNCORA (PRATA)</option>
                                                    <option value="promote_partner_to_anchor|ouro">ÂNCORA (OURO)</option>
                                                    <option value="suspend_partner|">SUSPENDER</option>
                                                    <option value="reactivate_partner|">REATIVAR</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                {/* Sidebar: Política e Notas */}
                <aside className="flex flex-col gap-8">
                    <section className="card bg-foreground text-white border-foreground">
                        <h3 className="stencil-text text-sm mb-4 uppercase text-secondary">Nota de Revisão</h3>
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase opacity-60 mb-1 block">Explicação Pública (200 chars)</label>
                                <textarea
                                    className="field text-xs text-black w-full"
                                    rows={3}
                                    maxLength={200}
                                    placeholder="Visível no perfil do parceiro..."
                                    value={publicNotes}
                                    onChange={e => setPublicNotes(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase opacity-60 mb-1 block">Nota Interna (Operator only)</label>
                                <textarea
                                    className="field text-xs text-black w-full"
                                    rows={3}
                                    maxLength={300}
                                    placeholder="Histórico técnico do parceiro..."
                                    value={internalNotes}
                                    onChange={e => setInternalNotes(e.target.value)}
                                />
                            </div>
                            <p className="text-[9px] font-bold uppercase text-white/40 italic">
                                * Notas são salvas ao realizar uma ação de status.
                            </p>
                        </div>
                    </section>

                    <section className="card border-2 border-secondary bg-secondary/5">
                        <h3 className="stencil-text text-sm mb-4 uppercase flex items-center justify-between">
                            <span>Policy v1.0</span>
                            <History size={16} />
                        </h3>
                        <div className="flex flex-col gap-4">
                            <div className="p-3 bg-white border-2 border-foreground">
                                <p className="font-black text-[10px] uppercase mb-1">ÂNCORA</p>
                                <ul className="text-[9px] font-bold uppercase list-none p-0 flex flex-col gap-1 opacity-60">
                                    <li>- Frequência semanal</li>
                                    <li>- Qualidade &gt; 95%</li>
                                    <li>- Consistência &gt; 6 meses</li>
                                </ul>
                            </div>
                            <Link href="/reports" className="cta-button tiny w-full justify-between">
                                VER POLÍTICA COMPLETA
                                <ExternalLink size={12} />
                            </Link>
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}
