"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import { Package, Truck, AlertTriangle, CheckCircle2, ListFilter, Plus, Download, ArrowRight, Home, MapPin, Inbox } from "lucide-react";

export default function LogisticaClient() {
    const [loading, setLoading] = useState(true);
    const [cells, setCells] = useState<any[]>([]);
    const [neighborhoods, setNeighborhoods] = useState<any[]>([]);
    const [dropPoints, setDropPoints] = useState<any[]>([]);
    const [catalog, setCatalog] = useState<any[]>([]);
    const [stocks, setStocks] = useState<any[]>([]);
    const [restockNeeded, setRestockNeeded] = useState<any[]>([]);

    // Selection/Filters
    const [selectedCellId, setSelectedCellId] = useState<string>("all");

    // Movement form state
    const [assetId, setAssetId] = useState("");
    const [qty, setQty] = useState(0);
    const [reason, setReason] = useState("restock");
    const [fromScope, setFromScope] = useState("external");
    const [fromId, setFromId] = useState("");
    const [toScope, setToScope] = useState("cell");
    const [toId, setToId] = useState("");
    const [saving, setSaving] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        async function loadInitial() {
            const { data: cData } = await supabase.from("eco_cells").select("*").order("name");
            const { data: aData } = await supabase.from("eco_assets_catalog").select("*").order("name");
            const { data: nData } = await supabase.from("neighborhoods").select("*").order("name");
            const { data: dpData } = await supabase.from("eco_drop_points").select("*").order("name");

            if (cData) setCells(cData);
            if (aData) {
                setCatalog(aData);
                if (aData.length > 0) setAssetId(aData[0].id);
            }
            setNeighborhoods(nData || []);
            setDropPoints(dpData || []);

            if (cData && cData.length > 0) {
                setSelectedCellId(cData[0].id);
                setToId(cData[0].id);
            }

            await refreshData();
            setLoading(false);
        }
        loadInitial();
    }, [supabase]);

    const refreshData = async () => {
        let stockQuery = supabase.from("eco_asset_stocks").select("*, asset:eco_assets_catalog(*), neighborhood:neighborhoods(name), drop_point:eco_drop_points(name)");
        let restockQuery = supabase.from("v_asset_restock_needed").select("*");

        if (selectedCellId !== "all") {
            stockQuery = stockQuery.eq("cell_id", selectedCellId);
            restockQuery = restockQuery.eq("cell_id", selectedCellId);
        }

        const { data: sData } = await stockQuery;
        const { data: rData } = await restockQuery;

        setStocks(sData || []);
        setRestockNeeded(rData || []);
    };

    const openIncident = async (kind: string, neighborhoodId?: string) => {
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

    const recordMove = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assetId || qty <= 0) return;
        setSaving(true);

        // Determine cell_id for the move based on "To" scope
        let moveCellId = selectedCellId === 'all' ? cells[0]?.id : selectedCellId;
        if (toScope === 'cell') moveCellId = toId;
        else if (toScope === 'neighborhood') {
            const n = neighborhoods.find(n => n.id === toId);
            // We'd need to find which cell this neighborhood belongs to
            // For simplicity, we use the selected cell or first cell
        }

        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await supabase.from("eco_asset_moves").insert({
            cell_id: moveCellId,
            from_scope: fromScope,
            from_id: fromScope === 'external' ? null : fromId,
            to_scope: toScope,
            to_id: toScope === 'external' ? null : toId,
            asset_id: assetId,
            qty,
            reason,
            created_by: user?.id
        });

        if (error) alert(error.message);
        else {
            alert("Movimentação registrada!");
            setQty(0);
            await refreshData();
        }
        setSaving(false);
    };

    const downloadCSV = () => {
        if (restockNeeded.length === 0) return;
        const headers = ["Cell", "Neighborhood", "Asset", "On Hand", "Min", "Deficit"];
        const rows = restockNeeded.map(r => [
            r.cell_name,
            r.neighborhood_name || "CELL STORAGE",
            r.asset_name,
            r.qty_on_hand,
            r.qty_min,
            r.deficit
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `eco_reporsicao_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
    };

    if (loading) return <LoadingBlock text="Conferindo estoque físico..." />;

    return (
        <div className="animate-slide-up pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <Truck className="text-secondary" size={32} />
                    <h1 className="stencil-text text-3xl">LOGÍSTICA FÍSICA</h1>
                </div>

                <div className="flex gap-2">
                    <select
                        className="field text-xs font-bold uppercase"
                        value={selectedCellId}
                        onChange={(e) => {
                            setSelectedCellId(e.target.value);
                        }}
                    >
                        <option value="all">TODAS AS CÉLULAS</option>
                        {cells.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <button className="cta-button small" onClick={refreshData}>ATUALIZAR</button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 flex flex-col gap-8">

                    {/* Dashboard de Estoque */}
                    <section className="card p-0 overflow-hidden">
                        <div className="p-4 border-b-2 border-foreground bg-muted/5 flex items-center justify-between">
                            <h2 className="stencil-text text-lg flex items-center gap-2">
                                <Package size={20} /> INVENTÁRIO ATUAL
                            </h2>
                            <span className="font-black text-[10px] uppercase text-muted">Acesso: Operador/Admin</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-foreground text-white">
                                    <tr>
                                        <th className="p-4 stencil-text text-xs uppercase">Item</th>
                                        <th className="p-4 stencil-text text-xs uppercase">Localização</th>
                                        <th className="p-4 stencil-text text-xs uppercase">Qtd</th>
                                        <th className="p-4 stencil-text text-xs uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stocks.map(s => (
                                        <tr key={s.id} className="border-b-2 border-foreground/10 hover:bg-muted/5">
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-xs uppercase">{s.asset?.name}</span>
                                                    <span className="text-[10px] text-muted font-bold uppercase">{s.asset?.slug}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="font-black text-[10px] uppercase leading-tight">
                                                    {s.drop_point?.name || s.neighborhood?.name || 'CENTRAL CÉLULA'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="font-black text-xl">{s.qty_on_hand}</span>
                                                <span className="text-[10px] font-bold text-muted uppercase block">{s.asset?.unit}</span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 border-2 border-foreground font-black text-[10px] uppercase ${s.qty_on_hand < s.qty_min ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                                                    {s.qty_on_hand < s.qty_min ? 'REPOR' : 'OK'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {stocks.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-20 text-center font-black text-xs uppercase text-muted opacity-50">
                                                <Inbox className="mx-auto mb-4" size={48} />
                                                Nenhum item em estoque registrado nesta célula.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Registrar Movimentação */}
                    <section className="card">
                        <h2 className="stencil-text text-lg mb-6 flex items-center gap-2">
                            <Truck size={20} /> REGISTRAR MOVIMENTAÇÃO (30S)
                        </h2>
                        <form onSubmit={recordMove} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="font-black text-[10px] uppercase text-muted">Item do Catálogo</label>
                                <select className="field font-bold uppercase text-xs" value={assetId} onChange={e => setAssetId(e.target.value)} required>
                                    {catalog.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="font-black text-[10px] uppercase text-muted">Quantidade</label>
                                <input type="number" className="field font-bold uppercase text-xs" value={qty} onChange={e => setQty(Number(e.target.value))} min={1} required />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="font-black text-[10px] uppercase text-muted">Origem (DE)</label>
                                <div className="flex gap-2">
                                    <select className="field text-[10px] font-bold uppercase w-1/3" value={fromScope} onChange={e => { setFromScope(e.target.value); setFromId(""); }}>
                                        <option value="external">EXTERNO</option>
                                        <option value="cell">CENTRAL</option>
                                        <option value="neighborhood">BAIRRO</option>
                                    </select>
                                    {fromScope === 'cell' && <select className="field text-[10px] font-bold uppercase grow" value={fromId} onChange={e => setFromId(e.target.value)} required>
                                        <option value="">Selecione...</option>
                                        {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>}
                                    {fromScope === 'neighborhood' && <select className="field text-[10px] font-bold uppercase grow" value={fromId} onChange={e => setFromId(e.target.value)} required>
                                        <option value="">Selecione...</option>
                                        {neighborhoods.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                                    </select>}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="font-black text-[10px] uppercase text-muted">Destino (PARA)</label>
                                <div className="flex gap-2">
                                    <select className="field text-[10px] font-bold uppercase w-1/3" value={toScope} onChange={e => { setToScope(e.target.value); setToId(""); }}>
                                        <option value="cell">CENTRAL</option>
                                        <option value="neighborhood">BAIRRO</option>
                                        <option value="drop_point">PONTO ECO</option>
                                    </select>
                                    <select className="field text-[10px] font-bold uppercase grow" value={toId} onChange={e => setToId(e.target.value)} required>
                                        <option value="">Selecione...</option>
                                        {toScope === 'cell' && cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        {toScope === 'neighborhood' && neighborhoods.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                                        {toScope === 'drop_point' && dropPoints.map(dp => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="font-black text-[10px] uppercase text-muted">Motivo</label>
                                <select className="field font-bold uppercase text-xs" value={reason} onChange={e => setReason(e.target.value)} required>
                                    <option value="restock">REPOSIÇÃO ESTOQUE</option>
                                    <option value="deploy_point">IMPLANTAÇÃO DE PONTO</option>
                                    <option value="print_batch">LOTE DE IMPRESSÃO</option>
                                    <option value="event">EVENTO/MUTIRÃO</option>
                                    <option value="damage">DANO/DEFEITO</option>
                                    <option value="loss">EXTRAVIO</option>
                                </select>
                            </div>

                            <div className="flex items-end">
                                <button type="submit" className="cta-button w-full justify-center bg-secondary text-white" disabled={saving}>
                                    {saving ? "REGISTRANDO..." : "REGISTRAR MOVIMENTO"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>

                {/* Sidebar: Aletas de Reposição */}
                <aside className="flex flex-col gap-8">
                    <section className="card bg-accent text-white border-foreground">
                        <h3 className="stencil-text text-sm mb-4 uppercase">Reposição Necessária</h3>
                        <div className="flex flex-col gap-4">
                            {restockNeeded.length === 0 ? (
                                <div className="flex flex-col items-center py-4 bg-white/5 border-2 border-white/10">
                                    <CheckCircle2 size={32} className="text-white opacity-40 mb-2" />
                                    <p className="text-[10px] font-black uppercase">Estoque em Dia</p>
                                </div>
                            ) : (
                                restockNeeded.map((r, i) => (
                                    <div key={i} className="flex flex-col bg-white border-2 border-foreground p-3 text-black">
                                        <span className="font-black text-[10px] uppercase text-accent mb-1 flex items-center gap-1">
                                            <AlertTriangle size={12} /> DÉFICIT: {r.deficit} {r.asset_slug.includes('pcs') ? 'unidades' : ''}
                                        </span>
                                        <p className="font-black text-xs uppercase leading-tight">{r.asset_name}</p>
                                        <p className="text-[9px] font-bold uppercase opacity-50 mt-1">{r.neighborhood_name || r.cell_name}</p>
                                        <button
                                            onClick={() => openIncident('stock_deficit', r.neighborhood_id)}
                                            className="mt-2 text-[8px] font-black uppercase bg-accent text-white py-1 border border-foreground hover:bg-black transition-colors"
                                        >
                                            ABRIR INCIDENTE
                                        </button>
                                    </div>
                                ))
                            )}
                            <button className="cta-button small w-full justify-between" style={{ background: 'white' }} onClick={downloadCSV}>
                                DOWNLOAD LISTA REPOSIÇÃO
                                <Download size={16} />
                            </button>
                        </div>
                    </section>

                    <section className="card border-2 border-muted bg-muted/5">
                        <h3 className="stencil-text text-sm mb-4 uppercase">Fluxo de Logística</h3>
                        <div className="flex flex-col gap-4">
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-foreground text-white flex items-center justify-center font-black text-xs shrink-0">1</div>
                                <p className="text-[10px] font-bold uppercase">Imprimiu um novo lote de placas no escritório da célula? Registre como **EXTERNO → CENTRAL**.</p>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-foreground text-white flex items-center justify-center font-black text-xs shrink-0">2</div>
                                <p className="text-[10px] font-bold uppercase">Enviou kits para um bairro no dia do mutirão? Registre como **CENTRAL → BAIRRO**.</p>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-foreground text-white flex items-center justify-center font-black text-xs shrink-0">3</div>
                                <p className="text-[10px] font-bold uppercase">Colou o adesivo no ponto? Registre como **BAIRRO → PONTO ECO**.</p>
                            </div>
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}
