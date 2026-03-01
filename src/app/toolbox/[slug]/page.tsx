"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    ChevronLeft,
    ChevronRight,
    Play,
    CheckCircle2,
    Trophy,
    ExternalLink,
    ArrowLeft,
    Monitor
} from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

export default function TrackRenderer({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const [track, setTrack] = useState<any>(null);
    const [lessons, setLessons] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [progress, setProgress] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [completed, setCompleted] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        async function loadTrackData() {
            setLoading(true);
            const { data: tData } = await supabase
                .from("eco_training_tracks")
                .select("*, lessons:eco_training_lessons(*)")
                .eq("slug", slug)
                .single();

            if (tData) {
                setTrack(tData);
                const sortedLessons = (tData.lessons || []).sort((a: any, b: any) => a.order_index - b.order_index);
                setLessons(sortedLessons);

                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: pData } = await supabase
                        .from("eco_training_progress")
                        .select("*")
                        .eq("user_id", user.id)
                        .eq("track_id", tData.id)
                        .maybeSingle();

                    if (pData) {
                        setProgress(pData);
                        setCurrentIndex(pData.current_lesson_index);
                        if (pData.status === 'completed') setCompleted(true);
                    } else {
                        // Create initial progress
                        const { data: newP } = await supabase
                            .from("eco_training_progress")
                            .insert({
                                user_id: user.id,
                                track_id: tData.id,
                                status: 'in_progress',
                                started_at: new Date().toISOString(),
                                current_lesson_index: 0
                            })
                            .select()
                            .single();
                        setProgress(newP);
                    }
                }
            }
            setLoading(false);
        }
        loadTrackData();
    }, [slug, supabase]);

    const handleNext = async () => {
        if (!progress) return;
        setSaving(true);
        const nextIdx = currentIndex + 1;
        const isDone = nextIdx >= lessons.length;

        try {
            if (isDone) {
                // Finalize track
                await supabase
                    .from("eco_training_progress")
                    .update({
                        status: 'completed',
                        completed_at: new Date().toISOString(),
                        current_lesson_index: lessons.length - 1
                    })
                    .eq("id", progress.id);

                // Issue certificate (internal logic)
                const code = Math.random().toString(36).substring(2, 10).toUpperCase();
                await supabase
                    .from("eco_training_certificates")
                    .insert({
                        user_id: progress.user_id,
                        track_id: track.id,
                        code
                    });

                setCompleted(true);
            } else {
                await supabase
                    .from("eco_training_progress")
                    .update({
                        current_lesson_index: nextIdx
                    })
                    .eq("id", progress.id);
                setCurrentIndex(nextIdx);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <LoadingBlock text="Preparando material didático..." />;
    if (!track) return <div className="p-20 text-center font-black uppercase">Trilha não encontrada.</div>;

    const lesson = lessons[currentIndex];

    if (completed) {
        return (
            <div className="max-w-2xl mx-auto py-20 text-center animate-scale-in">
                <Trophy className="text-primary mx-auto mb-6" size={80} />
                <h1 className="stencil-text text-4xl mb-4 uppercase">TRILHA CONCLUÍDA!</h1>
                <p className="text-lg font-bold opacity-70 mb-10">
                    Você completou a formação em <strong>{track.title}</strong>.
                    Seu certificado foi emitido e está disponível no seu painel.
                </p>
                <div className="flex flex-col gap-4">
                    <Link href="/minha-formacao" className="cta-button py-6 justify-center">VER MEUS CERTIFICADOS</Link>
                    <Link href="/toolbox" className="cta-button py-6 justify-center bg-white">VOLTAR PARA TOOLBOX</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto animate-slide-up pb-20">
            <header className="flex items-center justify-between mb-8 border-b-2 border-foreground pb-4">
                <div className="flex items-center gap-4">
                    <Link href="/toolbox" className="p-2 border-2 border-foreground hover:bg-muted/10 transition-colors">
                        <ChevronLeft size={20} />
                    </Link>
                    <div>
                        <span className="text-[10px] font-black uppercase opacity-50">{track.title}</span>
                        <h1 className="stencil-text text-xl">LIÇÃO {currentIndex + 1}: {lesson?.title}</h1>
                    </div>
                </div>
                <div className="text-[10px] font-black uppercase text-right">
                    PROGRESSO: {Math.round(((currentIndex) / lessons.length) * 100)}%
                    <div className="w-32 h-2 bg-muted border border-foreground mt-1 overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${((currentIndex) / lessons.length) * 100}%` }}
                        />
                    </div>
                </div>
            </header>

            <main className="bg-white border-2 border-foreground p-8 min-h-[400px] shadow-[8px_8px_0_0_rgba(0,0,0,1)] flex flex-col">
                <div className="prose prose-sm max-w-none font-bold flex-1">
                    <ReactMarkdown>{lesson?.body_md}</ReactMarkdown>
                </div>

                {lesson?.link_url && (
                    <div className="mt-12 p-6 bg-primary/5 border-2 border-primary border-dashed flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <h3 className="font-black text-sm uppercase flex items-center gap-2">
                                <Monitor size={16} /> LABORATÓRIO PRÁTICO
                            </h3>
                            <p className="text-[10px] font-bold uppercase opacity-60">
                                Explore a ferramenta real agora. Sua trilha continuará aqui.
                            </p>
                        </div>
                        <a
                            href={lesson.link_url}
                            target="_blank"
                            className="cta-button small bg-primary text-black flex items-center gap-2"
                        >
                            ABRIR FERRAMENTA <ExternalLink size={14} />
                        </a>
                    </div>
                )}
            </main>

            <footer className="mt-12 flex justify-between items-center">
                <button
                    className="cta-button small bg-white disabled:opacity-30"
                    disabled={currentIndex === 0 || saving}
                    onClick={() => setCurrentIndex(currentIndex - 1)}
                >
                    <ChevronLeft size={16} /> ANTERIOR
                </button>

                <button
                    className="cta-button"
                    disabled={saving}
                    onClick={handleNext}
                >
                    {saving ? 'SALVANDO...' : currentIndex === lessons.length - 1 ? 'CONCLUIR TRILHA' : 'PRÓXIMA LIÇÃO'}
                    {currentIndex < lessons.length - 1 && <ChevronRight size={16} />}
                </button>
            </footer>

            <style jsx>{`
                .prose strong { color: var(--primary); }
                .prose h1, .prose h2, .prose h3 { font-family: 'Stencil', sans-serif; text-transform: uppercase; border-bottom: 2px solid var(--foreground); padding-bottom: 4px; }
            `}</style>
        </div>
    );
}
