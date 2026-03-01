"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    Heart,
    ShieldCheck,
    Zap,
    CheckCircle2,
    Save,
    MessageSquare,
    Clock,
    Users,
    AlertCircle
} from "lucide-react";

export default function VolunteerProfilePage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [skills, setSkills] = useState<any[]>([]);
    const [profile, setProfile] = useState<any>(null);
    const [userSkills, setUserSkills] = useState<string[]>([]);
    const [cells, setCells] = useState<any[]>([]);
    const supabase = createClient();

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [
                { data: sData },
                { data: pData },
                { data: usData },
                { data: cData }
            ] = await Promise.all([
                supabase.from("eco_skills_catalog").select("*").order("name"),
                supabase.from("eco_volunteer_profiles").select("*").eq("user_id", user.id).maybeSingle(),
                supabase.from("eco_volunteer_skills").select("skill_id").eq("user_id", user.id),
                supabase.from("eco_cells").select("id, name").order("name")
            ]);

            setSkills(sData || []);
            setProfile(pData || {
                user_id: user.id,
                is_opt_in: false,
                availability: 'medium',
                cell_id: cData?.[0]?.id || null,
                display_name: '',
                notes: ''
            });
            setUserSkills(usData?.map(us => us.skill_id) || []);
            setCells(cData || []);
            setLoading(false);
        }
        loadData();
    }, [supabase]);

    const handleSave = async () => {
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Save Profile
        const { error: pError } = await supabase.from("eco_volunteer_profiles").upsert({
            ...profile,
            user_id: user.id,
            updated_at: new Date().toISOString()
        });

        if (pError) {
            alert("Erro ao salvar perfil: " + pError.message);
            setSaving(false);
            return;
        }

        // Save Skills (Delete then Insert)
        await supabase.from("eco_volunteer_skills").delete().eq("user_id", user.id);
        if (userSkills.length > 0) {
            const skillPayload = userSkills.map(sid => ({ user_id: user.id, skill_id: sid }));
            await supabase.from("eco_volunteer_skills").insert(skillPayload);
        }

        alert("Perfil de Voluntário atualizado com sucesso!");
        setSaving(false);
    };

    const toggleSkill = (skillId: string) => {
        setUserSkills(prev =>
            prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]
        );
    };

    if (loading) return <LoadingBlock text="Preparando banco de talentos..." />;

    return (
        <div className="max-w-4xl mx-auto animate-slide-up pb-20">
            <header className="flex items-center gap-4 mb-12">
                <div className="p-3 bg-secondary text-white rounded-sm">
                    <Heart size={32} />
                </div>
                <div>
                    <h1 className="stencil-text text-4xl">EU QUERO AJUDAR</h1>
                    <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">BANCO DE TALENTOS E AJUDA MÚTUA</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-12">
                    {/* Opt-in Section */}
                    <section className={`card p-8 border-4 transition-all ${profile.is_opt_in ? 'border-primary bg-primary/5' : 'border-foreground/10 bg-muted/5 opacity-60'}`}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="stencil-text text-xl">STATUS NO BANCO</h2>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={profile.is_opt_in}
                                    onChange={e => setProfile({ ...profile, is_opt_in: e.target.checked })}
                                />
                                <div className="w-14 h-7 bg-muted border-2 border-foreground peer-focus:outline-none peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-foreground after:border-foreground after:border after:h-5 after:w-6 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>
                        <p className="text-xs font-bold leading-relaxed mb-4">
                            Ao ativar o opt-in, você autoriza que os coordenadores da sua célula vejam suas competências e disponibilidade para chamados operacionais e projetos do comum.
                        </p>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-secondary">
                            <ShieldCheck size={14} /> Seus dados pessoais (tel/email) nunca são públicos.
                        </div>
                    </section>

                    {/* Basic Info */}
                    <section className="space-y-6">
                        <h2 className="stencil-text text-lg border-b-2 border-foreground pb-2 flex items-center gap-2">
                            <Users size={20} /> INFORMAÇÕES BÁSICAS
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase">Apelido (Como quer ser chamado)</label>
                                <input
                                    className="field"
                                    value={profile.display_name}
                                    onChange={e => setProfile({ ...profile, display_name: e.target.value })}
                                    placeholder="Ex: Alexandre do Sol"
                                    maxLength={40}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase">Sua Célula Territorial</label>
                                <select
                                    className="field"
                                    value={profile.cell_id}
                                    onChange={e => setProfile({ ...profile, cell_id: e.target.value })}
                                >
                                    {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1 md:col-span-2">
                                <label className="text-[10px] font-black uppercase">Qual sua disponibilidade?</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['low', 'medium', 'high'].map(level => (
                                        <button
                                            key={level}
                                            onClick={() => setProfile({ ...profile, availability: level })}
                                            className={`py-2 text-[10px] font-black uppercase border-2 ${profile.availability === level ? 'bg-foreground text-white border-foreground' : 'border-foreground/10'}`}
                                        >
                                            {level === 'low' ? 'Pontual' : level === 'medium' ? 'Regular' : 'Engajado'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Skills Selection */}
                    <section className="space-y-6">
                        <h2 className="stencil-text text-lg border-b-2 border-foreground pb-2 flex items-center gap-2">
                            <Zap size={20} /> COMPETÊNCIAS E INTERESSES
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {skills.map(skill => (
                                <button
                                    key={skill.id}
                                    onClick={() => toggleSkill(skill.id)}
                                    className={`p-4 border-2 text-left transition-all flex items-center gap-3 ${userSkills.includes(skill.id) ? 'border-primary bg-primary/5' : 'border-foreground/5 hover:border-foreground/20'}`}
                                >
                                    <div className={`w-8 h-8 flex items-center justify-center shrink-0 ${userSkills.includes(skill.id) ? 'bg-primary text-foreground' : 'bg-muted'}`}>
                                        {userSkills.includes(skill.id) ? <CheckCircle2 size={16} /> : <div className="w-2 h-2 rounded-full bg-foreground/10" />}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase">{skill.name}</p>
                                        <p className="text-[8px] font-bold opacity-50 leading-tight">{skill.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                <aside className="space-y-8">
                    <div className="card bg-foreground text-white p-6 border-foreground sticky top-8 flex flex-col gap-6">
                        <h3 className="stencil-text text-sm border-b border-primary/30 pb-2 text-primary uppercase">Guia do Voluntariado</h3>

                        <div className="space-y-4">
                            <div className="flex gap-3 text-xs">
                                <AlertCircle className="text-secondary shrink-0" size={18} />
                                <p className="font-bold">Voluntariado não substitui trabalho cooperado profissional.</p>
                            </div>
                            <div className="flex gap-3 text-[10px] opacity-70">
                                <MessageSquare className="shrink-0" size={14} />
                                <p>Os coordenadores da sua célula poderão entrar em contato com você via app.</p>
                            </div>
                            <div className="flex gap-3 text-[10px] opacity-70">
                                <Clock className="shrink-0" size={14} />
                                <p>Você pode desativar seu opt-in ou mudar suas habilidades a qualquer momento.</p>
                            </div>
                        </div>

                        <button
                            className="cta-button w-full justify-center bg-primary text-foreground disabled:opacity-30"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            <Save size={16} /> {saving ? "SALVANDO..." : "SALVAR PERFIL"}
                        </button>
                    </div>
                </aside>
            </div>

            <style jsx>{`
                .card { border-radius: 0; }
                .field { border-radius: 0; }
            `}</style>
        </div>
    );
}
