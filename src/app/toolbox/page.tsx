"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    BookOpen,
    Clock,
    ChevronRight,
    CheckCircle2,
    GraduationCap,
    Lock,
    Globe,
    MapPin
} from "lucide-react";
import Link from "next/link";

export default function ToolboxPage() {
    const [tracks, setTracks] = useState<any[]>([]);
    const [userProgress, setUserProgress] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function loadTracks() {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            const [{ data: tData }, { data: pData }] = await Promise.all([
                supabase.from("eco_training_tracks").select("*").order("created_at"),
                user ? supabase.from("eco_training_progress").select("*").eq("user_id", user.id) : Promise.resolve({ data: [] })
            ]);

            setTracks(tData || []);
            setUserProgress(pData || []);
            setLoading(false);
        }
        loadTracks();
    }, [supabase]);

    if (loading) return <LoadingBlock text="Carregando Toolbox de Formação..." />;

    return (
        <div className="animate-slide-up pb-20">
            <header className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                    <GraduationCap className="text-primary" size={40} />
                    <h1 className="stencil-text text-4xl">TOOLBOX ECO</h1>
                </div>
                <p className="text-lg font-bold opacity-70 max-w-2xl">
                    Trilhas curtas para autonomia técnica e social. Capacite-se para operar,
                    comunicar e governar o que é comum.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {tracks.map(track => {
                    const progress = userProgress.find(p => p.track_id === track.id);
                    const isCompleted = progress?.status === 'completed';
                    const isInProgress = progress?.status === 'in_progress';

                    return (
                        <div key={track.id} className="card group hover:border-primary transition-all flex flex-col h-full bg-white border-2 border-foreground shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                            <div className="p-6 flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-2">
                                        {track.scope === 'global' ? (
                                            <span className="bg-foreground text-white text-[8px] font-black uppercase px-1.5 py-0.5 border border-foreground flex items-center gap-1">
                                                <Globe size={10} /> GLOBAL
                                            </span>
                                        ) : (
                                            <span className="bg-secondary text-white text-[8px] font-black uppercase px-1.5 py-0.5 border border-foreground flex items-center gap-1">
                                                <MapPin size={10} /> LOCAL
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] font-black opacity-50 uppercase">
                                        <Clock size={12} /> {track.duration_minutes} MIN
                                    </div>
                                </div>

                                <h2 className="stencil-text text-xl mb-3 group-hover:text-primary transition-colors uppercase leading-tight">
                                    {track.title}
                                </h2>
                                <p className="text-xs font-bold opacity-70 line-clamp-3 mb-6">
                                    {track.description}
                                </p>

                                {isCompleted && (
                                    <div className="flex items-center gap-2 text-green-600 font-black text-[10px] uppercase mb-4">
                                        <CheckCircle2 size={14} /> Trilha Concluída
                                    </div>
                                )}
                                {isInProgress && !isCompleted && (
                                    <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase mb-4">
                                        <BookOpen size={14} /> Em andamento
                                    </div>
                                )}
                            </div>

                            <Link
                                href={`/toolbox/${track.slug}`}
                                className={`flex items-center justify-between p-4 border-t-2 border-foreground font-black text-xs uppercase hover:bg-muted/5 transition-colors ${isCompleted ? 'bg-green-50' : isInProgress ? 'bg-primary/5' : ''}`}
                            >
                                <span>{isCompleted ? 'REVER TRILHA' : isInProgress ? 'CONTINUAR' : 'COMEÇAR AGORA'}</span>
                                <ChevronRight size={16} />
                            </Link>
                        </div>
                    );
                })}

                {tracks.length === 0 && (
                    <div className="col-span-full py-20 text-center border-4 border-dashed border-foreground/10">
                        <p className="stencil-text text-2xl opacity-20">NENHUMA TRILHA DISPONÍVEL</p>
                    </div>
                )}
            </div>

            <footer className="mt-20 p-10 bg-muted/5 border-2 border-foreground border-dashed text-center">
                <h3 className="stencil-text text-xl mb-2">AUTONOMIA SEM HIERARQUIA</h3>
                <p className="text-xs font-bold opacity-60 max-w-md mx-auto">
                    Nossas trilhas são baseadas na pedagogia do comum. O aprendizado serve para
                    fortalecer o coletivo e garantir o trabalho digno.
                </p>
            </footer>

            <style jsx>{`
                .card { border-radius: 0; }
            `}</style>
        </div>
    );
}
