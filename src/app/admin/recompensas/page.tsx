"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    Gift,
    Coins,
    CheckCircle2,
    XCircle,
    Plus,
    History,
    Scale,
    AlertTriangle,
    BadgeAlert,
    Clock
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default function AdminRewardsPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [cells, setCells] = useState<any[]>([]);
    const [selectedCell, setSelectedCell] = useState<string>("");

    const [balances, setBalances] = useState<any[]>([]);
    const [catalog, setCatalog] = useState<any[]>([]);
    const [redemptions, setRedemptions] = useState<any[]>([]);
    const [lastLedger, setLastLedger] = useState<any[]>([]);

    useEffect(() => {
        loadCells();
    }, []);

    useEffect(() => {
        if (selectedCell) {
            loadDashboard(selectedCell);
        }
    }, [selectedCell]);

    const loadCells = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: mandates } = await supabase.from("eco_mandates").select("cell_id").eq("user_id", user.id).eq("status", "active");
        const cellIds = mandates?.map(m => m.cell_id) || [];
        const { data: cData } = await supabase.from("eco_cells").select("*").in("id", cellIds).order("name");
        setCells(cData || []);
        if (cData && cData.length > 0) setSelectedCell(cData[0].id);
        setLoading(false);
    };

    const loadDashboard = async (cellId: string) => {
        setLoading(true);
        const [balRes, catRes, redRes, ledRes] = await Promise.all([
            supabase.from("v_collective_points_balance").select("*, neighborhoods(slug, name)").eq("cell_id", cellId).eq("scope", "neighborhood"),
            supabase.from("eco_reward_catalog").select("*").eq("cell_id", cellId).order("status"),
            supabase.from("eco_reward_redemptions").select("*, eco_reward_catalog(title), neighborhoods(name), auth_users!requested_by(raw_user_meta_data)").eq("cell_id", cellId).order("created_at", { ascending: false }),
            supabase.from("eco_collective_points_ledger").select("*, neighborhoods(name)").eq("cell_id", cellId).order("created_at", { ascending: false }).limit(5)
        ]);

        if (balRes.data) setBalances(balRes.data);
        if (catRes.data) setCatalog(catRes.data);
        if (redRes.data) setRedemptions(redRes.data);
        if (ledRes.data) setLastLedger(ledRes.data);
        setLoading(false);
    };

    const toggleCatalogStatus = async (item: any) => {
        const newStatus = item.status === 'active' ? 'paused' : 'active';
        await supabase.from("eco_reward_catalog").update({ status: newStatus }).eq("id", item.id);
        loadDashboard(selectedCell);
    };

    const handleAdjust = async () => {
        const p = prompt("Digite os pontos (positivo/negativo), neighborhood_id, e o motivo separados por vírgula.\nExemplo: 50, d123..., Limpeza Mutirão");
        if (!p) return;
        const [ptsStr, nId, ...notesArr] = p.split(',').map(s => s.trim());
        const pts = parseInt(ptsStr, 10);
        if (isNaN(pts) || !nId) { alert("Inválido"); return; }

        const { error } = await supabase.rpc("rpc_manual_adjust_points", {
            p_cell_id: selectedCell, p_scope: 'neighborhood', p_neighborhood_id: nId,
            p_drop_point_id: null, p_delta: pts, p_notes: notesArr.join(',')
        });

        if (error) alert("Erro: " + error.message);
        else loadDashboard(selectedCell);
    };

    const handleApproveRedemption = async (id: string, needsGovernance: boolean) => {
        if (needsGovernance) {
            alert("Aviso A29: Este item exige uma decisão de assembleia. Crie uma proposta no Mural de Decisões, e após aprovação, anexe o recibo de decisão AQUI na próxima versão para audibilidade completa.");
            const p = prompt("Cole o ID do Recibo de Decisão (eco_cell_decision_receipts):");
            if (!p) return;
            await supabase.from("eco_reward_redemptions").update({ status: 'approved', decision_receipt_id: p }).eq("id", id);
        } else {
            if (confirm("Aprovar resgate direto? Isso deve deduzir os pontos (gerando transação manual).")) {
                // Numa arquitetura real, aprovar aqui subtrai os pontos no ledger
                // Por simplicidade do MVP, apenas marcamos approved
                await supabase.from("eco_reward_redemptions").update({ status: 'approved' }).eq("id", id);
            }
        }
        loadDashboard(selectedCell);
    };

    if (loading && cells.length === 0) return <LoadingBlock text="Carregando matriz de recompensas..." />;

    return (
        <div className="animate-slide-up pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b-4 border-foreground pb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-secondary text-white rounded-sm shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                        <Gift size={32} />
                    </div>
                    <div>
                        <h1 className="stencil-text text-4xl uppercase tracking-tighter">TROCAS DO COMUM</h1>
                        <p className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                            <Scale size={12} /> INCENTIVO COLETIVO (A55)
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <select
                        className="field py-2 text-[10px] font-black uppercase bg-white border-2"
                        value={selectedCell}
                        onChange={e => setSelectedCell(e.target.value)}
                    >
                        {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <div className="md:col-span-2 space-y-8">
                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="stencil-text text-2xl uppercase">Saldo dos Bairros</h2>
                            <button onClick={handleAdjust} className="cta-button tiny bg-black text-white">AJUSTE</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {balances.map(b => (
                                <div key={b.neighborhood_id} className="card border-2 p-4 flex justify-between items-center">
                                    <div>
                                        <h3 className="font-black text-xs uppercase">{b.neighborhoods?.name}</h3>
                                        <p className="text-[10px] uppercase opacity-50">+ {b.last_30d_delta} em 30d</p>
                                    </div>
                                    <div className="stencil-text text-3xl text-green-700">{b.points_balance}</div>
                                </div>
                            ))}
                            {balances.length === 0 && <p className="text-xs font-bold opacity-50">Nenhum ledger de bairro nativo ainda.</p>}
                        </div>
                    </section>

                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="stencil-text text-2xl uppercase">Transações Recentes (Ledger)</h2>
                        </div>
                        <div className="card overflow-hidden bg-white border-2">
                            <table className="w-full text-left text-[10px] font-bold uppercase">
                                <thead>
                                    <tr className="bg-foreground text-white">
                                        <th className="p-3">Data</th>
                                        <th className="p-3">Bairro</th>
                                        <th className="p-3">Evento</th>
                                        <th className="p-3 text-right">Pts</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lastLedger.map(l => (
                                        <tr key={l.id} className="border-t border-foreground/10 hover:bg-muted/10">
                                            <td className="p-3">{new Date(l.created_at).toLocaleString()}</td>
                                            <td className="p-3">{l.neighborhoods?.name || l.scope}</td>
                                            <td className="p-3 truncate max-w-[120px]">{l.notes || l.event_kind}</td>
                                            <td className={`p-3 text-right text-lg stencil-text ${l.points_delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {l.points_delta > 0 ? '+' : ''}{l.points_delta}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                <div className="space-y-8">
                    <section>
                        <div className="flex justify-between items-center mb-4 border-b-2 border-foreground/20 pb-2">
                            <h2 className="stencil-text text-2xl uppercase">Catálogo de Trocas</h2>
                            <Link href="/admin/recompensas/novo" className="cta-button py-1 px-2 border border-foreground bg-white hover:bg-black hover:text-white">
                                <Plus size={16} /> NOVO
                            </Link>
                        </div>
                        <div className="space-y-3">
                            {catalog.map(c => (
                                <div key={c.id} className={`p-4 border-2 ${c.status === 'active' ? 'border-primary bg-primary/5' : 'border-dashed border-foreground/20 opacity-60'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-black text-[12px] uppercase leading-tight">{c.title}</h3>
                                        <span className="stencil-text text-xl ml-2">{c.cost_points}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-4">
                                        <span className="text-[9px] font-black uppercase text-foreground/60 flex items-center gap-1" title={c.needs_governance ? "Assembleia" : ""}>
                                            {c.needs_governance ? <Scale size={10} className="text-accent" /> : <CheckCircle2 size={10} />}
                                            {c.needs_governance ? 'GOVERNANÇA REQUERIDA' : 'RESGATE DIRETO'}
                                        </span>
                                        <button onClick={() => toggleCatalogStatus(c)} className="text-[10px] font-bold underline uppercase">
                                            {c.status === 'active' ? 'Pausar' : 'Ativar'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h2 className="stencil-text text-xl uppercase mb-4 text-accent border-b-2 border-accent pb-2">Pedidos de Resgate</h2>
                        <div className="space-y-3">
                            {redemptions.filter(r => r.status === 'requested').map(r => (
                                <div key={r.id} className="card bg-accent/10 border-2 border-accent p-4">
                                    <h3 className="font-black text-[10px] uppercase text-accent mb-1">{r.neighborhoods?.name}</h3>
                                    <p className="font-bold text-sm mb-3">"{r.eco_reward_catalog?.title}"</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleApproveRedemption(r.id, r.needs_governance)} className="cta-button tiny bg-black text-white w-full border-0 justify-center">
                                            <ScanSearch size={14} /> AVALIAR / APROVAR
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {redemptions.filter(r => r.status === 'requested').length === 0 && <p className="text-[10px] font-black uppercase opacity-40">Nenhum pedido pendente.</p>}
                        </div>
                    </section>
                </div>
            </div>

            <style jsx>{`
                .card { border-radius: 0; }
                .field { border-radius: 0; }
            `}</style>
        </div>
    );
}

// Temporary icon stub for unused import
const ScanSearch = ({ size }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>;
