"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    Megaphone,
    Plus,
    Edit2,
    CheckCircle2,
    XCircle,
    Users,
    Clock,
    Copy,
    ExternalLink,
    AlertTriangle,
    Save,
    Trash2
} from "lucide-react";

import { useSearchParams } from "next/navigation";

export default function AdminChamadosPage() {
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [calls, setCalls] = useState<any[]>([]);
    const [selectedCall, setSelectedCall] = useState<any>(null);
    const [interests, setInterests] = useState<any[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [cells, setCells] = useState<any[]>([]);
    const [neighborhoods, setNeighborhoods] = useState<any[]>([]);
    const [skills, setSkills] = useState<any[]>([]);

    // Form State
    const [form, setForm] = useState({
        cell_id: '',
        neighborhood_id: '',
        kind: 'volunteer',
        title: '',
        body_md: '',
        skill_slugs: [] as string[],
        urgency: 'medium',
        status: 'open'
    });

    const supabase = createClient();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get mandates to see which cells user manages
        const { data: mandates } = await supabase.from("eco_mandates").select("cell_id").eq("user_id", user.id).eq("status", "active");
        const managedCellIds = mandates?.map(m => m.cell_id) || [];

        const [
            { data: cData },
            { data: nData },
            { data: sData },
            { data: callsData }
        ] = await Promise.all([
            supabase.from("eco_cells").select("*").in("id", managedCellIds).order("name"),
            supabase.from("neighborhoods").select("*").in("cell_id", managedCellIds).order("name"),
            supabase.from("eco_skills_catalog").select("*").order("name"),
            supabase.from("eco_calls").select("*, cell:eco_cells(name), neighborhood:neighborhoods(name)").in("cell_id", managedCellIds).order("created_at", { ascending: false })
        ]);

        setCells(cData || []);
        setNeighborhoods(nData || []);
        setSkills(sData || []);
        setCalls(callsData || []);

        // Handle pre-fill from improvements
        const fromTitle = searchParams.get('title');
        if (fromTitle) {
            setForm(prev => ({
                ...prev,
                title: fromTitle,
                body_md: `Chamado originado da melhoria contínua #${searchParams.get('from_improvement')}`,
                cell_id: managedCellIds[0] || ''
            }));
            setIsEditing(true);
        } else if (cData?.[0]) {
            setForm(prev => ({ ...prev, cell_id: cData[0].id }));
        }

        setLoading(false);
    };

    const loadInterests = async (callId: string) => {
        const { data } = await supabase
            .from("eco_call_interests")
            .select(`
                *,
                profile:eco_volunteer_profiles(display_name, availability, notes),
                skills:eco_volunteer_skills(skill:eco_skills_catalog(name))
            `)
            .eq("call_id", callId)
            .order("created_at", { ascending: false });
        setInterests(data || []);
    };

    const handleSaveCall = async () => {
        if (!form.title || !form.cell_id) return;
        const { data: { user } } = await supabase.auth.getUser();

        const payload = {
            ...form,
            created_by: user?.id,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from("eco_calls").upsert(
            selectedCall?.id ? { id: selectedCall.id, ...payload } : payload
        );

        if (!error) {
            alert("Chamado salvo com sucesso!");
            setIsEditing(false);
            setSelectedCall(null);
            loadData();
        } else {
            alert("Erro ao salvar: " + error.message);
        }
    };

    const handleInterestStatus = async (id: string, status: 'accepted' | 'declined') => {
        const { error } = await supabase.from("eco_call_interests").update({ status }).eq("id", id);
        if (!error && selectedCall) loadInterests(selectedCall.id);
    };

    if (loading) return <LoadingBlock text="Acessando mural de chamados..." />;

    return (
        <div className="animate-slide-up pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-secondary text-white rounded-sm">
                        <Megaphone size={24} />
                    </div>
                    <div>
                        <h1 className="stencil-text text-3xl uppercase tracking-tighter">GESTÃO DE CHAMADOS</h1>
                        <p className="text-[10px] font-black uppercase opacity-60">ADMINISTRAÇÃO DE AJUDA MÚTUA</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setSelectedCall(null);
                        setForm({ cell_id: cells[0]?.id || '', neighborhood_id: '', kind: 'volunteer', title: '', body_md: '', skill_slugs: [], urgency: 'medium', status: 'open' });
                        setIsEditing(true);
                    }}
                    className="cta-button small"
                >
                    <Plus size={16} /> NOVO CHAMADO
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Calls List */}
                <div className="lg:col-span-1 border-r-2 border-foreground/5 pr-8 space-y-4">
                    <h2 className="stencil-text text-xs uppercase opacity-50 mb-4 tracking-widest flex items-center gap-2">
                        <Clock size={14} /> CHAMADOS RECENTES
                    </h2>
                    {calls.map(call => (
                        <button
                            key={call.id}
                            onClick={() => {
                                setSelectedCall(call);
                                setIsEditing(false);
                                loadInterests(call.id);
                            }}
                            className={`w-full text-left p-4 border-2 transition-all flex flex-col gap-2 ${selectedCall?.id === call.id ? 'border-primary bg-primary/5' : 'border-foreground/5 hover:border-foreground/20'}`}
                        >
                            <div className="flex justify-between items-center text-[8px] font-black uppercase">
                                <span className="opacity-40">{call.cell?.name}</span>
                                <span className={call.status === 'open' ? 'text-green-600' : 'opacity-40'}>{call.status}</span>
                            </div>
                            <h3 className="font-black text-xs uppercase leading-tight line-clamp-1">{call.title}</h3>
                            <div className="flex gap-2">
                                <span className="px-1.5 py-0.5 bg-muted text-[8px] font-black uppercase tracking-widest">{call.kind}</span>
                                {call.urgency === 'high' && <span className="text-red-600 font-extrabold text-[8px] uppercase">Urgent</span>}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Detail/Editor Area */}
                <div className="lg:col-span-2">
                    {isEditing ? (
                        <div className="card border-4 border-foreground p-8 bg-white shadow-[8px_8px_0_0_rgba(0,0,0,1)] space-y-8 animate-slide-up">
                            <h2 className="stencil-text text-2xl uppercase border-b-2 border-foreground pb-4">
                                {selectedCall ? 'EDITAR CHAMADO' : 'CRIAR CHAMADO'}
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black uppercase">Título Curto e Direto</label>
                                    <input className="field" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={120} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black uppercase">Tipo de Demanda</label>
                                    <select className="field" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
                                        <option value="volunteer">Voluntariado</option>
                                        <option value="cooperado_extra">Cooperado Extra</option>
                                        <option value="mutirao">Mutirão</option>
                                        <option value="comms">Comunicação</option>
                                        <option value="logistics">Logística</option>
                                        <option value="dev">Tecnologia</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black uppercase">Célula</label>
                                    <select className="field" value={form.cell_id} onChange={e => setForm({ ...form, cell_id: e.target.value })}>
                                        {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black uppercase">Bairro (Opcional)</label>
                                    <select className="field" value={form.neighborhood_id} onChange={e => setForm({ ...form, neighborhood_id: e.target.value })}>
                                        <option value="">Toda a Célula</option>
                                        {neighborhoods.filter(n => n.cell_id === form.cell_id).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-2 flex flex-col gap-1">
                                    <label className="text-[10px] font-black uppercase">Descrição (Markdown)</label>
                                    <textarea className="field h-32 resize-none" value={form.body_md} onChange={e => setForm({ ...form, body_md: e.target.value })} maxLength={1200} />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-[10px] font-black uppercase">Competências Necessárias</label>
                                    <div className="flex flex-wrap gap-2">
                                        {skills.map(skill => (
                                            <button
                                                key={skill.slug}
                                                onClick={() => {
                                                    const exists = form.skill_slugs.includes(skill.slug);
                                                    setForm({ ...form, skill_slugs: exists ? form.skill_slugs.filter(s => s !== skill.slug) : [...form.skill_slugs, skill.slug] });
                                                }}
                                                className={`px-3 py-1 text-[8px] font-black uppercase border-2 transition-all ${form.skill_slugs.includes(skill.slug) ? 'bg-foreground text-white border-foreground' : 'border-foreground/5'}`}
                                            >
                                                {skill.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black uppercase">Urgência</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['low', 'medium', 'high'].map(u => (
                                            <button key={u} onClick={() => setForm({ ...form, urgency: u })} className={`py-2 text-[8px] font-black uppercase border-2 ${form.urgency === u ? 'bg-secondary text-white border-secondary' : 'border-foreground/5'}`}>{u}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black uppercase">Status</label>
                                    <select className="field" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                        <option value="open">Aberto</option>
                                        <option value="filled">Preenchido</option>
                                        <option value="closed">Fechado</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-4 justify-end pt-8 border-t border-foreground/5">
                                <button onClick={() => setIsEditing(false)} className="cta-button small bg-white">CANCELAR</button>
                                <button onClick={handleSaveCall} className="cta-button small"><Save size={16} /> SALVAR</button>
                            </div>
                        </div>
                    ) : selectedCall ? (
                        <div className="space-y-12 animate-slide-up">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="stencil-text text-3xl uppercase leading-tight mb-2">{selectedCall.title}</h2>
                                    <div className="flex gap-2">
                                        <span className="px-2 py-0.5 bg-foreground text-white text-[8px] font-black uppercase">{selectedCall.kind}</span>
                                        <span className="px-2 py-0.5 bg-muted text-[8px] font-black uppercase">{selectedCall.urgency}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setForm({ ...selectedCall });
                                        setIsEditing(true);
                                    }}
                                    className="p-2 border-2 border-foreground/10 hover:border-foreground"
                                >
                                    <Edit2 size={16} />
                                </button>
                            </div>

                            <section className="space-y-6">
                                <h3 className="stencil-text text-lg border-b-2 border-foreground pb-2 flex items-center gap-2">
                                    <Users size={20} /> INTERESSADOS ({interests.length})
                                </h3>
                                <div className="space-y-4">
                                    {interests.map(i => (
                                        <div key={i.id} className="card p-5 border-2 border-foreground/5 bg-white flex flex-col md:flex-row justify-between gap-6 hover:border-foreground/20 transition-all">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-black text-xs uppercase tracking-tighter">{i.profile?.display_name || 'Usuário Anônimo'}</span>
                                                    <span className={`text-[8px] font-black uppercase px-1.5 border-2 ${i.profile?.availability === 'high' ? 'border-red-600 text-red-600' : 'border-foreground/20 opacity-40'}`}>
                                                        {i.profile?.availability}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] font-bold opacity-60 italic">{i.message || 'Nenhuma mensagem adicional.'}</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {i.skills?.map((s: any) => (
                                                        <span key={s.skill.name} className="px-1.5 py-0.5 bg-muted/30 text-[8px] font-bold uppercase">{s.skill.name}</span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {i.status === 'pending' ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleInterestStatus(i.id, 'accepted')}
                                                            className="p-2 bg-green-600 text-white rounded-sm hover:bg-green-700" title="Aceitar"
                                                        ><CheckCircle2 size={16} /></button>
                                                        <button
                                                            onClick={() => handleInterestStatus(i.id, 'declined')}
                                                            className="p-2 bg-red-600 text-white rounded-sm hover:bg-red-700" title="Recusar"
                                                        ><XCircle size={16} /></button>
                                                    </>
                                                ) : (
                                                    <div className={`px-3 py-1 text-[10px] font-black uppercase border-2 ${i.status === 'accepted' ? 'border-green-600 text-green-600' : 'border-red-600 text-red-600 opacity-40'}`}>
                                                        {i.status}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {interests.length === 0 && (
                                        <div className="py-20 text-center border-2 border-dashed border-foreground/5 opacity-40 italic font-bold">
                                            Aguardando mobillização da comunidade...
                                        </div>
                                    )}
                                </div>
                            </section>

                            {interests.some(i => i.status === 'accepted') && (
                                <section className="p-6 bg-primary/5 border-2 border-primary border-dashed">
                                    <h4 className="stencil-text text-sm mb-4 flex items-center gap-2">
                                        <ExternalLink size={16} /> PRÓXIMO PASSO (Apoio Aceito)
                                    </h4>
                                    <p className="text-xs font-bold mb-4 opacity-70">Copie a mensagem padrão para enviar no canal interno da célula:</p>
                                    <div className="bg-white p-4 border border-foreground/10 flex gap-4 items-start">
                                        <p className="text-xs font-mono leading-relaxed flex-1">
                                            Oi! Seu interesse no chamado {selectedCall.title} foi aceito. Vamos combinar os detalhes aqui no canal da célula ou em nosso próximo ritual presenciai. Obrigado pela ajuda mútua!
                                        </p>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(`Oi! Seu interesse no chamado ${selectedCall.title} foi aceito...`);
                                                alert("Mensagem copiada para o clipboard!");
                                            }}
                                            className="p-2 bg-foreground text-white hover:bg-primary hover:text-foreground transition-all shrink-0"
                                        >
                                            <Copy size={14} />
                                        </button>
                                    </div>
                                </section>
                            )}
                        </div>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center border-4 border-dashed border-foreground/5 opacity-40 grayscale">
                            <Megaphone size={48} className="mb-4" />
                            <p className="stencil-text text-lg">SELECIONE UM CHAMADO PARA GERENCIAR</p>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .card { border-radius: 0; }
                .field { border-radius: 0; }
            `}</style>
        </div>
    );
}
