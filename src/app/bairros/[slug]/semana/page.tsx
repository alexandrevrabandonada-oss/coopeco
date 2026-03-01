"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
    BookOpen,
    Target,
    Share2,
    ArrowRight,
    CheckCircle2,
    Calendar,
    Star,
    Users
} from "lucide-react";
import { LoadingBlock } from "@/components/loading-block";
import { MultimediaPlayer } from "@/components/multimedia-player";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function NeighborhoodRitualPage() {
    const { slug } = useParams();
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [neighborhood, setNeighborhood] = useState<any>(null);
    const [focus, setFocus] = useState<any>(null);
    const [rituals, setRituals] = useState<any[]>([]);
    const [mission, setMission] = useState<any>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const { data: n } = await supabase.from("neighborhoods").select("id, name, slug, cell_id").eq("slug", slug).single();
            if (!n) return setLoading(false);
            setNeighborhood(n);

            const [focusRes, ritualsRes, missionRes] = await Promise.all([
                supabase.from("eco_neighborhood_learning_focus").select("*").eq("neighborhood_id", n.id).maybeSingle(),
                supabase.from("eco_first_week_rituals").select("*").eq("neighborhood_id", n.id).order("ritual_key", { ascending: true }),
                supabase.from("community_missions").select("*, progress:mission_progress(*)").eq("neighborhood_id", n.id).eq("active", true).eq("kind", "quality_push").maybeSingle()
            ]);

            if (focusRes.data) {
                const focusData = focusRes.data;
                if (focusData.focus_tip_ids && focusData.focus_tip_ids.length > 0) {
                    const { data: tips } = await supabase.from("edu_tips").select(`
                        *,
                        media:edu_tip_media(
                            media_id,
                            asset:edu_media_assets(id, cell_id, neighborhood_id, status)
                        )
                    `).in("id", focusData.focus_tip_ids);

                    // Filter and Sort localized media
                    const processedTips = (tips || []).map(tip => ({
                        ...tip,
                        media: (tip.media as any[])?.filter(m => m.asset?.status === 'published')
                            .sort((a, b) => {
                                // Prioritize neighborhood exact match
                                if (a.asset.neighborhood_id === n.id && b.asset.neighborhood_id !== n.id) return -1;
                                if (b.asset.neighborhood_id === n.id && a.asset.neighborhood_id !== n.id) return 1;
                                // Then cell match
                                if (a.asset.cell_id === n.cell_id && b.asset.cell_id !== n.cell_id) return -1;
                                if (b.asset.cell_id === n.cell_id && a.asset.cell_id !== n.cell_id) return 1;
                                // Then global (cell_id null)
                                if (a.asset.cell_id === null && b.asset.cell_id !== null) return -1;
                                if (b.asset.cell_id === null && a.asset.cell_id !== null) return 1;
                                return 0;
                            })
                    }));

                    focusData.tips = processedTips;
                }
                setFocus(focusData);
            }
            if (ritualsRes.data) setRituals(ritualsRes.data);
            if (missionRes.data) setMission(missionRes.data);

            setLoading(false);
        };
        load();
    }, [slug, supabase]);

    if (loading) return <LoadingBlock text="Preparando rituais do bairro..." />;
    if (!neighborhood) return <div className="p-12 text-center font-black uppercase">Bairro não encontrado</div>;

    return (
        <div className="animate-slide-up pb-20 max-w-2xl mx-auto px-4">
            <header className="py-12 text-center flex flex-col items-center gap-4">
                <div className="bg-primary/20 p-4 rounded-full">
                    <BookOpen size={48} className="text-primary" />
                </div>
                <h1 className="stencil-text text-4xl uppercase leading-tight">
                    RITUAL SEMANAL<br />
                    <span className="text-primary">{neighborhood.name}</span>
                </h1>
                <p className="font-bold text-xs uppercase opacity-60 flex items-center gap-2">
                    <Calendar size={14} /> Foco sugerido pelo comportamento do comum
                </p>
            </header>

            {/* Weekly Focus Card */}
            <section className="card border-4 border-foreground p-8 bg-white mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-foreground text-white px-4 py-1 font-black text-[10px] uppercase">
                    FOCO DA SEMANA
                </div>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <Target size={32} className="text-accent" />
                        <div>
                            <h2 className="stencil-text text-2xl uppercase">
                                Reduzir {focus?.focus_flag === 'food' ? 'Comida' : focus?.focus_flag === 'liquids' ? 'Líquidos' : 'Contaminação'}
                            </h2>
                            <p className="text-[10px] font-black uppercase text-muted">Ação coletiva para proteger o trabalho digno</p>
                        </div>
                    </div>

                    {focus?.tips && focus.tips.length > 0 ? (
                        <div className="flex flex-col gap-3 mt-2">
                            {focus.tips.map((tip: any) => (
                                <div key={tip.id} className="bg-muted/10 p-4 border-l-4 border-primary">
                                    <h3 className="font-black text-xs uppercase mb-1">{tip.title}</h3>
                                    <p className="text-xs leading-relaxed opacity-80">{tip.body}</p>

                                    {tip.media?.map((m: any) => (
                                        <MultimediaPlayer key={m.media_id} mediaId={m.media_id} title={tip.title} />
                                    ))}
                                </div>
                            ))}
                        </div>
                    ) : focus?.focus_tip && (
                        <div className="bg-muted/10 p-4 border-l-4 border-primary mt-2">
                            <h3 className="font-black text-xs uppercase mb-2">{focus.focus_tip.title}</h3>
                            <p className="text-xs leading-relaxed opacity-80">{focus.focus_tip.body}</p>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-foreground/5">
                        <div className="flex -space-x-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="w-6 h-6 rounded-full bg-muted border-2 border-white flex items-center justify-center overflow-hidden">
                                    <Users size={12} className="opacity-30" />
                                </div>
                            ))}
                        </div>
                        <span className="text-[10px] font-black uppercase underline flex items-center gap-1 cursor-pointer">
                            <Share2 size={12} /> Compartilhar Card
                        </span>
                    </div>
                </div>
            </section>

            {/* Ritual Steps */}
            <section className="mb-12">
                <h2 className="stencil-text text-xl mb-6 uppercase flex items-center gap-2">
                    <Star className="text-yellow-500" /> Sua Primeira Semana
                </h2>
                <div className="flex flex-col gap-4">
                    {rituals.length > 0 ? rituals.map((r, i) => (
                        <div key={r.id} className="card border-2 border-foreground p-6 bg-white flex gap-6 items-start">
                            <div className="font-black text-3xl opacity-20 stencil-text">0{i + 1}</div>
                            <div className="flex-1">
                                <h3 className="font-black text-sm uppercase mb-2">{r.title}</h3>
                                <p className="text-xs opacity-70 mb-4">{r.body_md}</p>
                                <button className="cta-button tiny flex gap-2">
                                    {r.cta_kind === 'read_tip' ? 'LER DICA' : r.cta_kind === 'do_mission' ? 'VER MISSÃO' : 'PARTICIPAR'}
                                    <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    )) : (
                        <p className="text-center py-8 font-bold text-xs uppercase opacity-30 italic">Ritual em preparação...</p>
                    )}
                </div>
            </section>

            {/* Neighborhood Mission */}
            {mission && (
                <section className="card border-2 border-foreground bg-black text-white p-8 mb-8 text-center flex flex-col items-center gap-4">
                    <CheckCircle2 size={40} className="text-primary" />
                    <h2 className="stencil-text text-2xl uppercase">Missão do Bairro</h2>
                    <p className="opacity-80 text-xs italic">"Bater {focus?.goal_ok_rate || 80}% de qualidade nas coletas desta semana"</p>

                    <div className="w-full bg-white/20 h-4 rounded-full mt-4 relative overflow-hidden">
                        <div
                            className="absolute top-0 left-0 h-full bg-primary"
                            style={{ width: `${Math.min(100, (mission.progress?.[0]?.progress_count || 0) * 10)}%` }}
                        />
                    </div>
                    <span className="font-black text-[10px] uppercase">{mission.progress?.[0]?.progress_count || 0} de {mission.goal_count || 100} coletas OK</span>
                </section>
            )}

            <footer className="text-center pt-8 border-t border-foreground/10 flex flex-col items-center gap-4">
                <Link href={`/bairros/${slug}/transparencia`} className="cta-button small w-full flex gap-2">
                    VER MAIS DADOS DO BAIRRO <ArrowRight size={16} />
                </Link>
                <p className="text-[10px] font-bold uppercase opacity-80 mt-4">
                    Recibo é lei. Cuidado é coletivo. Trabalho digno no centro.
                </p>
                <p className="text-[10px] font-bold uppercase opacity-30 italic">Educação Adaptativa — A36 / Copy Anti-Culpa — A43</p>
            </footer>
        </div>
    );
}
