"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ArrowLeft, Gift } from "lucide-react";
import Link from "next/link";
import { LoadingBlock } from "@/components/loading-block";

export default function NovoCatalogItemPage() {
    const router = useRouter();
    const supabase = createClient();
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [costPoints, setCostPoints] = useState(100);
    const [scope, setScope] = useState("neighborhood");
    const [needsGovernance, setNeedsGovernance] = useState(true);

    const [cells, setCells] = useState<any[]>([]);
    const [selectedCell, setSelectedCell] = useState("");

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: mandates } = await supabase.from("eco_mandates").select("cell_id").eq("user_id", user.id).eq("status", "active");
            const cellIds = mandates?.map(m => m.cell_id) || [];
            const { data: cData } = await supabase.from("eco_cells").select("*").in("id", cellIds);
            setCells(cData || []);
            if (cData && cData.length > 0) setSelectedCell(cData[0].id);
        };
        load();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase.from("eco_reward_catalog").insert({
            scope: scope,
            cell_id: selectedCell,
            title: title,
            description_md: description,
            cost_points: costPoints,
            needs_governance: needsGovernance,
            status: 'active'
        });

        setLoading(false);
        if (error) {
            alert("Erro: " + error.message);
        } else {
            router.push("/admin/recompensas");
        }
    };

    if (cells.length === 0) return <LoadingBlock text="Verificando acesso..." />;

    return (
        <div className="max-w-2xl mx-auto pb-20 animate-slide-up">
            <header className="mb-8">
                <Link href="/admin/recompensas" className="flex items-center gap-2 text-xs font-black uppercase mb-4 hover:underline">
                    <ArrowLeft size={16} /> Voltar para Recompensas
                </Link>
                <div className="flex items-center gap-4 border-b-4 border-foreground pb-4">
                    <div className="p-2 bg-secondary text-white shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                        <Gift size={24} />
                    </div>
                    <h1 className="stencil-text text-3xl uppercase tracking-tighter">CADASTRAR TROCA</h1>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase opacity-60">Célula Gestora</label>
                    <select required className="field w-full border-2 bg-white p-3 font-bold uppercase text-xs"
                        value={selectedCell} onChange={e => setSelectedCell(e.target.value)}>
                        {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase opacity-60">Título da Recompensa</label>
                    <input required type="text" maxLength={120} className="field w-full border-2 bg-white p-3 font-bold"
                        placeholder="Ex: Kits Limpeza Ponto, Oficina de Design"
                        value={title} onChange={e => setTitle(e.target.value)} />
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase opacity-60">Escopo da Troca</label>
                    <select required className="field w-full border-2 bg-white p-3 font-bold uppercase text-xs"
                        value={scope} onChange={e => setScope(e.target.value)}>
                        <option value="neighborhood">Restrito ao Bairro (Acumulado do Bairro)</option>
                        <option value="drop_point">Específico para Ponto Físico</option>
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase opacity-60">Custo Total (Pontos)</label>
                    <input required type="number" min={1} className="field w-full border-2 bg-white p-3 text-xl font-bold font-mono"
                        value={costPoints} onChange={e => setCostPoints(parseInt(e.target.value))} />
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase opacity-60">Exige Aprovação em Assembleia (A29)?</label>
                    <select required className="field w-full border-2 bg-white p-3 font-bold uppercase text-xs"
                        value={needsGovernance.toString()} onChange={e => setNeedsGovernance(e.target.value === 'true')}>
                        <option value="true">SIM - Trocas caras ou operacionais (Requer Recibo A29)</option>
                        <option value="false">NÃO - Liberação Rápida / Simbólica</option>
                    </select>
                    <p className="text-[9px] font-bold opacity-50 mt-1">A55: Grandes trocas não são brindes de consumo, exigem concordância do coletivo no formato assembleia.</p>
                </div>

                <button disabled={loading} type="submit" className="cta-button w-full justify-center py-4 bg-primary border-4 text-black text-lg">
                    {loading ? "SALVANDO..." : "CRIAR CATALOGO"}
                </button>
            </form>
        </div>
    );
}
