"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    LayoutList,
    FileText,
    Megaphone,
    BookOpen,
    Radio,
    ShieldAlert,
    ChevronRight,
    Clock,
    Filter,
    CheckCircle2,
    XCircle,
    UserCircle,
    Paperclip
} from "lucide-react";
import Link from "next/link";

export default function EditorialDashboard() {
    const [queue, setQueue] = useState<any[]>([]);
    const [cells, setCells] = useState<any[]>([]);
    const [selectedCellId, setSelectedCellId] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function loadInitial() {
            setLoading(true);
            const { data: cData } = await supabase.from("eco_cells").select("*").order("name");
            setCells(cData || []);
            if (cData && cData.length > 0) {
                const defaultCell = cData[0].id;
                setSelectedCellId(defaultCell);
                await loadQueue(defaultCell);
            }
            setLoading(false);
        }
        loadInitial();
    }, [supabase]);

    const loadQueue = async (cellId: string) => {
        setLoading(true);
        const { data } = await supabase
            .from("eco_editorial_queue")
            .select("*")
            .eq("cell_id", cellId)
            .order("status", { ascending: false }) // draft/review first
            .order("created_at", { ascending: false });
        setQueue(data || []);
        setLoading(false);
    };

    const getSourceIcon = (kind: string) => {
        switch (kind) {
            case 'template': return <LayoutList size={16} />;
            case 'campaign_item': return <Megaphone size={16} />;
            case 'bulletin': return <FileText size={16} />;
            case 'edu_media': return <Radio size={16} />;
            case 'runbook_card': return <BookOpen size={16} />;
            case 'task_evidence': return <Paperclip size={16} />;
            default: return <FileText size={16} />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'review': return <span className="bg-primary text-black px-1.5 py-0.5 border border-foreground text-[8px] font-black uppercase">REVISÃO</span>;
            case 'approved': return <span className="bg-green-500 text-white px-1.5 py-0.5 border border-foreground text-[8px] font-black uppercase">APROVADO</span>;
            case 'rejected': return <span className="bg-red-500 text-white px-1.5 py-0.5 border border-foreground text-[8px] font-black uppercase">REJEITADO</span>;
            case 'published': return <span className="bg-foreground text-white px-1.5 py-0.5 border border-foreground text-[8px] font-black uppercase">PUBLICADO</span>;
            default: return <span className="bg-muted text-foreground px-1.5 py-0.5 border border-foreground text-[8px] font-black uppercase">DRAFT</span>;
        }
    };

    if (loading && cells.length === 0) return <LoadingBlock text="Carregando fila editorial..." />;

    return (
        <div className="animate-slide-up pb-20">
            {/* A56 Breadcrumb */}
            <Link href="/admin" className="text-[10px] font-black uppercase text-muted underline mb-4 flex w-fit">
                &lt; VOLTAR PARA O PAINEL ADMIN
            </Link>

            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div className="flex items-center gap-3">
                    <LayoutList className="text-secondary" size={40} />
                    <h1 className="stencil-text text-4xl">HUB EDITORIAL</h1>
                </div>

                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <Filter className="opacity-40" size={16} />
                        <select
                            className="field min-w-[200px]"
                            value={selectedCellId}
                            onChange={(e) => {
                                setSelectedCellId(e.target.value);
                                loadQueue(e.target.value);
                            }}
                        >
                            {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-4">
                {queue.map(item => (
                    <Link
                        key={item.id}
                        href={`/admin/editorial/${item.id}`}
                        className="card group bg-white border-2 border-foreground hover:translate-x-1 transition-all flex items-center p-4 gap-6"
                    >
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-muted/10 border border-foreground/10 group-hover:bg-primary transition-colors">
                                    {getSourceIcon(item.source_kind)}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase opacity-50">{item.source_kind.replace('_', ' ')}</span>
                                    <h3 className="stencil-text text-lg uppercase truncate max-w-[400px]">ID: {item.source_id.split('-')[0]}...</h3>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 text-[9px] font-bold uppercase opacity-60">
                                <div className="flex items-center gap-1"><Clock size={12} /> Solicidado em {new Date(item.created_at).toLocaleDateString()}</div>
                                <div className="flex items-center gap-1"><UserCircle size={12} /> Por Operador {item.requested_by?.split('-')[0]}</div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                            {getStatusBadge(item.status)}
                            {item.lint_summary?.blockers > 0 && (
                                <span className="bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 text-[8px] font-black uppercase flex items-center gap-1">
                                    <ShieldAlert size={10} /> {item.lint_summary.blockers} BLOCKERS
                                </span>
                            )}
                        </div>

                        <ChevronRight className="opacity-20 group-hover:opacity-100 transition-opacity" size={20} />
                    </Link>
                ))}

                {queue.length === 0 && !loading && (
                    <div className="py-24 text-center border-4 border-dashed border-foreground/10">
                        <LayoutList className="mx-auto mb-4 opacity-10" size={64} />
                        <p className="stencil-text text-2xl opacity-20">FILA EDITORIAL VAZIA</p>
                        <p className="text-[10px] font-black uppercase opacity-20 tracking-widest mt-2">AUTONOMIA LOCAL EM EQUILÍBRIO</p>
                    </div>
                )}

                {loading && (
                    <div className="py-12 flex justify-center">
                        <span className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
                    </div>
                )}
            </div>

            <style jsx>{`
                .card { border-radius: 0; }
            `}</style>
        </div>
    );
}
