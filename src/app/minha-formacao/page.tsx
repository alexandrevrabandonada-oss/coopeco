"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    Award,
    Share2,
    Eye,
    EyeOff,
    FileText,
    Download,
    CheckCircle2,
    History,
    ChevronRight,
    GraduationCap
} from "lucide-react";
import Link from "next/link";

export default function MinhaFormacaoPage() {
    const [certificates, setCertificates] = useState<any[]>([]);
    const [progress, setProgress] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        async function loadUserData() {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [{ data: cData }, { data: pData }] = await Promise.all([
                supabase.from("eco_training_certificates").select("*, track:eco_training_tracks(*)").eq("user_id", user.id).order("issued_at", { ascending: false }),
                supabase.from("eco_training_progress").select("*, track:eco_training_tracks(*)").eq("user_id", user.id)
            ]);

            setCertificates(cData || []);
            setProgress(pData || []);
            setLoading(false);
        }
        loadUserData();
    }, [supabase]);

    const togglePublic = async (certId: string, current: boolean) => {
        setUpdating(certId);
        const { error } = await supabase
            .from("eco_training_certificates")
            .update({ is_public: !current })
            .eq("id", certId);

        if (!error) {
            setCertificates(certificates.map(c => c.id === certId ? { ...c, is_public: !current } : c));
        }
        setUpdating(null);
    };

    if (loading) return <LoadingBlock text="Carregando suas conquistas..." />;

    const completedCount = certificates.length;
    const inProgressCount = progress.filter(p => p.status === 'in_progress').length;

    return (
        <div className="animate-slide-up pb-20">
            <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Award className="text-secondary" size={32} />
                        <h1 className="stencil-text text-3xl">MINHA FORMAÇÃO</h1>
                    </div>
                    <p className="text-sm font-bold opacity-60 uppercase">
                        Gerencie seu progresso e reconhecimento na rede ECO.
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-foreground text-white p-4 border-2 border-foreground flex flex-col items-center min-w-[100px]">
                        <span className="text-2xl font-black">{completedCount}</span>
                        <span className="text-[8px] font-black uppercase">Concluídas</span>
                    </div>
                    <div className="bg-white text-foreground p-4 border-2 border-foreground flex flex-col items-center min-w-[100px]">
                        <span className="text-2xl font-black">{inProgressCount}</span>
                        <span className="text-[8px] font-black uppercase">Cursando</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Certificados */}
                <section>
                    <h2 className="stencil-text text-xl mb-6 flex items-center gap-2 border-b-2 border-foreground pb-2">
                        CERTIFICADOS EMITIDOS
                    </h2>
                    <div className="flex flex-col gap-4">
                        {certificates.map(cert => (
                            <div key={cert.id} className="card bg-white border-2 border-foreground p-6 hover:translate-x-1 transition-transform">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-black text-sm uppercase mb-1">{cert.track?.title}</h3>
                                        <p className="text-[10px] font-bold opacity-50 uppercase">Código: {cert.code} • {new Date(cert.issued_at).toLocaleDateString()}</p>
                                    </div>
                                    <button
                                        onClick={() => togglePublic(cert.id, cert.is_public)}
                                        disabled={updating === cert.id}
                                        className={`flex items-center gap-2 px-2 py-1 text-[8px] font-black uppercase border-2 border-foreground transition-colors ${cert.is_public ? 'bg-secondary text-white' : 'bg-white text-foreground opacity-60'}`}
                                        title={cert.is_public ? 'Todos podem ver este certificado' : 'Somente você vê este certificado'}
                                    >
                                        {cert.is_public ? <Eye size={12} /> : <EyeOff size={12} />}
                                        {cert.is_public ? 'PÚBLICO' : 'PRIVADO'}
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button className="cta-button tiny flex-1 justify-center bg-foreground text-white">
                                        <FileText size={12} /> VER DIGITAL
                                    </button>
                                    <button className="cta-button tiny px-3 bg-white" title="Download">
                                        <Download size={12} />
                                    </button>
                                    {cert.is_public && (
                                        <button className="cta-button tiny px-3 bg-accent text-white" title="Compartilhar">
                                            <Share2 size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {certificates.length === 0 && (
                            <div className="py-12 text-center bg-muted/5 border-2 border-dashed border-foreground/10">
                                <p className="font-black text-[10px] uppercase opacity-40">Nenhum certificado emitido ainda.</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Trilhas em andamento */}
                <section>
                    <h2 className="stencil-text text-xl mb-6 flex items-center gap-2 border-b-2 border-foreground pb-2">
                        PRÓXIMOS PASSOS
                    </h2>
                    <div className="flex flex-col gap-4">
                        {progress.filter(p => p.status !== 'completed').map(p => (
                            <div key={p.id} className="card bg-muted/5 border-2 border-foreground border-dashed p-6 flex items-center justify-between">
                                <div className="flex-1">
                                    <h3 className="font-black text-sm uppercase mb-1">{p.track?.title}</h3>
                                    <div className="w-full bg-white border border-foreground h-1.5 mt-2 overflow-hidden">
                                        <div
                                            className="h-full bg-primary"
                                            style={{ width: `${(p.current_lesson_index / 5) * 100}%` }}
                                        />
                                    </div>
                                </div>
                                <Link href={`/toolbox/${p.track?.slug}`} className="ml-6 p-2 bg-foreground text-white hover:bg-primary transition-colors">
                                    <ChevronRight size={20} />
                                </Link>
                            </div>
                        ))}
                        <Link href="/toolbox" className="cta-button w-full justify-between items-center bg-white py-6 border-2 border-foreground">
                            <div className="flex items-center gap-3">
                                <GraduationCap size={20} />
                                <span className="font-black text-xs uppercase">Explorar novas trilhas</span>
                            </div>
                            <ChevronRight size={20} />
                        </Link>
                    </div>
                </section>
            </div>

            <style jsx>{`
                .card { border-radius: 0; }
            `}</style>
        </div>
    );
}
