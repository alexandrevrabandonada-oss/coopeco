"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    Layout,
    Smartphone,
    Copy,
    Save,
    Trash2,
    Eye,
    AlertTriangle,
    CheckCircle2,
    Globe,
    Users,
    MapPin,
    ArrowRight,
    Sparkles,
    Search
} from "lucide-react";
import { lintCopy, autofixCopy } from "@/lib/copy/lint";

const KINDS = [
    { value: 'invite_text', label: 'Convite / Cadastro' },
    { value: 'next_window_text', label: 'Próxima Janela' },
    { value: 'recommended_point_text', label: 'Ponto Recomendado' },
    { value: 'weekly_bulletin_text', label: 'Boletim Semanal' },
    { value: 'top_flags_text', label: 'Top Contaminações' },
    { value: 'missions_text', label: 'Missões Coletivas' },
    { value: 'learning_focus_week_text', label: 'Foco da Semana' },
    { value: 'runbook_notice_text', label: 'Aviso Operacional' }
];

const FAKE_DATA: Record<string, string> = {
    NEIGHBORHOOD_NAME: "Bairro do Sol",
    NEXT_WINDOW_TIME: "Terça-feira, 14h-16h",
    DROP_POINT_NAME: "ECO Ponto Central",
    CTA_URL: "eco.org/i/SOL123",
    TOP_FLAGS: "Plástico sujo, Vidro quebrado",
    OK_RATE: "92%",
    MISSION_PROGRESS: "45/50",
    FOCUS_TITLE: "Separação de Orgânicos",
    FOCUS_SUMMARY: "Reduzir o chorume na coleta seletiva",
    STATUS: "NORMAL"
};

export default function AdminTemplatesPage() {
    const [loading, setLoading] = useState(true);
    const [cells, setCells] = useState<any[]>([]);
    const [neighborhoods, setNeighborhoods] = useState<any[]>([]);

    // Selection state
    const [selectedScope, setSelectedScope] = useState<'global' | 'cell' | 'neighborhood'>('global');
    const [selectedCellId, setSelectedCellId] = useState<string>("");
    const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string>("");

    // Templates state
    const [templates, setTemplates] = useState<any[]>([]);
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
    const [editData, setEditData] = useState({ kind: 'invite_text', title: '', body_md: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        loadBaseData();
    }, []);

    useEffect(() => {
        loadTemplates();
    }, [selectedScope, selectedCellId, selectedNeighborhoodId]);

    const loadBaseData = async () => {
        const { data: cData } = await supabase.from("eco_cells").select("id, name").order("name");
        const { data: nData } = await supabase.from("neighborhoods").select("id, name, cell_id").order("name");
        setCells(cData || []);
        setNeighborhoods(nData || []);
    };

    const loadTemplates = async () => {
        setLoading(true);
        let query = supabase.from("eco_comms_templates").select("*").eq("scope", selectedScope);

        if (selectedScope === 'cell') query = query.eq("cell_id", selectedCellId);
        if (selectedScope === 'neighborhood') query = query.eq("neighborhood_id", selectedNeighborhoodId);

        const { data } = await query.order("kind");
        setTemplates(data || []);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!editData.title || !editData.body_md) return;
        setIsSaving(true);

        // A43: Copy Anti-Culpa Linting
        const lintResult = await lintCopy(editData.body_md, { source_kind: 'template' });
        if (!lintResult.ok) {
            const blockers = lintResult.findings.filter(f => f.severity === 'blocker');
            alert(`BLOQUEIO DE LINGUAGEM (Anti-Culpa):\n\n${blockers.map(b => `- ${b.excerpt}: ${b.hint}`).join('\n')}\n\nAjuste o template antes de salvar.`);
            setIsSaving(false);
            return;
        }

        const payload: any = {
            scope: selectedScope,
            kind: editData.kind,
            title: editData.title,
            body_md: editData.body_md,
            cell_id: selectedScope === 'cell' ? selectedCellId : null,
            neighborhood_id: selectedScope === 'neighborhood' ? selectedNeighborhoodId : null
        };

        // A48: Editorial Review Integration
        let shouldGoToReview = false;
        if (selectedScope === 'cell' && selectedCellId) {
            const { data: cellData } = await supabase.from("eco_cells").select("editorial_mode").eq("id", selectedCellId).single();
            const mode = cellData?.editorial_mode || 'lint_only';

            if (mode === 'review_required') shouldGoToReview = true;
            if (mode === 'lint_only' && !lintResult.ok) shouldGoToReview = true;
        }

        if (shouldGoToReview) {
            const { data: qId, error: qError } = await supabase.rpc('rpc_request_editorial_review', {
                p_cell_id: selectedCellId,
                p_source_kind: 'template',
                p_source_id: editingTemplateId === 'new' ? crypto.randomUUID() : editingTemplateId, // Assign ID if new
                p_lint_summary: { blockers: lintResult.findings.filter(f => f.severity === 'blocker').length, warns: lintResult.findings.filter(f => f.severity === 'warn').length }
            });

            if (!qError) {
                await supabase.rpc('rpc_save_editorial_version', {
                    p_queue_id: qId,
                    p_new_text: editData.body_md,
                    p_reason: 'Alteração de template via admin'
                });
                alert("CONTEÚDO EM REVISÃO: Este template foi enviado para o Hub Editorial devido às políticas da célula ou alertas do linter.");
                setEditingTemplateId(null);
                loadTemplates();
            } else {
                alert("Erro ao solicitar revisão: " + qError.message);
            }
        } else {
            const { error } = await supabase.from("eco_comms_templates").upsert(payload, {
                onConflict: 'scope, cell_id, neighborhood_id, kind'
            });

            if (error) alert(error.message);
            else {
                setEditingTemplateId(null);
                loadTemplates();
            }
        }
        setIsSaving(false);
    };

    const renderPreview = (text: string) => {
        let preview = text;
        Object.keys(FAKE_DATA).forEach(key => {
            preview = preview.replace(new RegExp(`{{${key}}}`, "g"), FAKE_DATA[key]);
        });
        return preview;
    };

    const handleAutofix = async () => {
        const { text } = await autofixCopy(editData.body_md);
        setEditData(prev => ({ ...prev, body_md: text }));
    };

    const handleDuplicateFromGlobal = async (kind: string) => {
        const globalTpl = templates.find(t => t.kind === kind && t.scope === 'global');
        if (!globalTpl) {
            // Fetch global if not in current view
            const { data } = await supabase.from("eco_comms_templates").select("*").eq("scope", 'global').eq("kind", kind).single();
            if (data) {
                setEditData({ kind: data.kind, title: data.title + " (Cópia)", body_md: data.body_md });
                setEditingTemplateId('new');
            }
        }
    };

    return (
        <div className="animate-slide-up pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <Layout className="text-secondary" size={32} />
                    <h1 className="stencil-text text-3xl">TEMPLATES DE COMUNICAÇÃO</h1>
                </div>

                <div className="flex bg-white border-2 border-foreground p-1">
                    <button
                        onClick={() => setSelectedScope('global')}
                        className={`px-3 py-1 font-black text-[10px] uppercase flex items-center gap-1 ${selectedScope === 'global' ? 'bg-foreground text-white' : ''}`}
                    >
                        <Globe size={12} /> GLOBAL
                    </button>
                    <button
                        onClick={() => setSelectedScope('cell')}
                        className={`px-3 py-1 font-black text-[10px] uppercase flex items-center gap-1 ${selectedScope === 'cell' ? 'bg-foreground text-white' : ''}`}
                    >
                        <Users size={12} /> CÉLULA
                    </button>
                    <button
                        onClick={() => setSelectedScope('neighborhood')}
                        className={`px-3 py-1 font-black text-[10px] uppercase flex items-center gap-1 ${selectedScope === 'neighborhood' ? 'bg-foreground text-white' : ''}`}
                    >
                        <MapPin size={12} /> BAIRRO
                    </button>
                </div>
            </header>

            <div className="flex flex-col md:flex-row gap-4 mb-8">
                {selectedScope === 'cell' && (
                    <select
                        className="field font-bold uppercase text-xs"
                        value={selectedCellId}
                        onChange={e => setSelectedCellId(e.target.value)}
                    >
                        <option value="">Selecione a Célula...</option>
                        {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                )}
                {selectedScope === 'neighborhood' && (
                    <select
                        className="field font-bold uppercase text-xs"
                        value={selectedNeighborhoodId}
                        onChange={e => setSelectedNeighborhoodId(e.target.value)}
                    >
                        <option value="">Selecione o Bairro...</option>
                        {neighborhoods.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                )}
            </div>

            {(selectedScope !== 'global' && !selectedCellId && !selectedNeighborhoodId) ? (
                <div className="card text-center py-20 opacity-30 italic font-black uppercase">
                    Selecione um escopo local para gerenciar templates específicos.
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 flex flex-col gap-4">
                        <h2 className="stencil-text text-lg flex justify-between items-center">
                            LISTA DE KINDS
                            <button
                                onClick={() => {
                                    setEditData({ kind: 'invite_text', title: '', body_md: '' });
                                    setEditingTemplateId('new');
                                }}
                                className="cta-button tiny"
                            >Novo</button>
                        </h2>
                        <div className="flex flex-col gap-2">
                            {KINDS.map(kind => {
                                const tpl = templates.find(t => t.kind === kind.value);
                                return (
                                    <button
                                        key={kind.value}
                                        onClick={() => {
                                            if (tpl) {
                                                setEditData({ kind: tpl.kind, title: tpl.title, body_md: tpl.body_md });
                                                setEditingTemplateId(tpl.id);
                                            } else {
                                                setEditData({ kind: kind.value, title: '', body_md: '' });
                                                setEditingTemplateId('new');
                                            }
                                        }}
                                        className={`card text-left p-3 hover:border-primary transition-all flex justify-between items-center ${editData.kind === kind.value ? 'border-primary bg-primary/5' : ''
                                            }`}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-black text-[10px] uppercase truncate">{kind.label}</span>
                                            <span className="text-[8px] font-bold opacity-50 uppercase">{kind.value}</span>
                                        </div>
                                        {tpl ? <CheckCircle2 size={14} className="text-green-600" /> : <div className="w-2 h-2 rounded-full bg-muted" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        {editingTemplateId ? (
                            <div className="animate-slide-up flex flex-col gap-4">
                                <div className="card bg-white border-4 border-foreground shadow-[8px_8px_0_0_rgba(0,0,0,1)] flex flex-col gap-4 p-6">
                                    <h3 className="stencil-text text-xl border-b-2 border-foreground pb-2 flex justify-between items-center">
                                        EDITOR DE TEMPLATE
                                        <span className="text-[10px] bg-secondary text-white px-2 py-0.5">{editData.kind}</span>
                                    </h3>

                                    <div className="flex flex-col gap-1">
                                        <label className="font-black text-[10px] uppercase">Título do Template</label>
                                        <input
                                            className="field text-lg font-bold"
                                            value={editData.title}
                                            onChange={e => setEditData(prev => ({ ...prev, title: e.target.value }))}
                                            placeholder="Título curto..."
                                            maxLength={80}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <div className="flex justify-between items-center">
                                            <label className="font-black text-[10px] uppercase">Corpo do Texto (Markdown)</label>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleAutofix}
                                                    className="px-2 py-0.5 bg-primary/10 text-primary font-black text-[8px] uppercase flex items-center gap-1 hover:bg-primary/20"
                                                >
                                                    <Sparkles size={10} /> Autofix Anti-Culpa
                                                </button>
                                                <button
                                                    onClick={() => setPreviewMode(!previewMode)}
                                                    className={`px-2 py-0.5 font-black text-[8px] uppercase flex items-center gap-1 border border-foreground/20 hover:bg-muted/10 ${previewMode ? 'bg-foreground text-white border-foreground' : ''}`}
                                                >
                                                    <Eye size={10} /> Preview
                                                </button>
                                            </div>
                                        </div>
                                        {previewMode ? (
                                            <div className="w-full p-4 h-64 bg-muted/5 border-2 border-dashed border-foreground/20 font-bold text-lg leading-relaxed whitespace-pre-wrap">
                                                {renderPreview(editData.body_md)}
                                            </div>
                                        ) : (
                                            <textarea
                                                className="w-full p-4 h-64 field resize-none font-bold text-lg"
                                                value={editData.body_md}
                                                onChange={e => setEditData(prev => ({ ...prev, body_md: e.target.value }))}
                                                placeholder="Use {{PLACEHOLDERS}} como {{NEIGHBORHOOD_NAME}}..."
                                                maxLength={800}
                                            />
                                        )}
                                        <p className="text-[9px] font-bold opacity-50 uppercase text-right">{editData.body_md.length} / 800 caracteres</p>
                                    </div>

                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => setEditingTemplateId(null)}
                                            className="cta-button small bg-white"
                                        >Cancelar</button>
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="cta-button small"
                                        >
                                            {isSaving ? "Salvando..." : "Salvar Template"}
                                        </button>
                                    </div>
                                </div>

                                <div className="card border-dashed border-2 border-foreground/30 p-4">
                                    <h4 className="font-black text-[10px] uppercase mb-2 flex items-center gap-2">
                                        <AlertTriangle size={14} className="text-accent" /> DICIONÁRIO DE PLACEHOLDERS
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {Object.keys(FAKE_DATA).map(key => (
                                            <code key={key} className="p-1 bg-muted/20 text-[8px] font-bold cursor-help" title={FAKE_DATA[key]}>
                                                {"{{" + key + "}}"}
                                            </code>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="card h-full flex flex-col items-center justify-center py-40 text-muted border-dashed border-2">
                                <Search size={48} className="opacity-20 mb-4" />
                                <p className="font-black text-xs uppercase italic">Selecione um tipo de template à esquerda para editar</p>
                                {selectedScope !== 'global' && (
                                    <button
                                        className="mt-6 cta-button tiny bg-white"
                                        onClick={() => handleDuplicateFromGlobal('invite_text')}
                                    >DUPLICAR TODOS DO GLOBAL</button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style jsx>{`
                .card { border-radius: 0; }
                .field { border-radius: 0; }
            `}</style>
        </div>
    );
}
