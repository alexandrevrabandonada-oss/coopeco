"use client";

import { useState, useEffect } from "react";
import { Play, Pause, Volume2, Video, Loader2, AlertCircle } from "lucide-react";

interface MultimediaPlayerProps {
    mediaId: string;
    title?: string;
}

export function MultimediaPlayer({ mediaId, title }: MultimediaPlayerProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mediaData, setMediaData] = useState<{ url: string; kind: string; transcript_md?: string; variant?: string } | null>(null);
    const [showPlayer, setShowPlayer] = useState(false);

    const fetchSignedUrl = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/edu/media/signed-url?media_id=${mediaId}`);
            if (!res.ok) throw new Error("Falha ao carregar mídia");
            const data = await res.json();
            setMediaData(data);
            setShowPlayer(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (error) {
        return (
            <div className="flex items-center gap-2 text-red-600 font-black text-[10px] uppercase mt-2">
                <AlertCircle size={14} /> {error}
            </div>
        );
    }

    if (!showPlayer) {
        return (
            <button
                onClick={fetchSignedUrl}
                disabled={loading}
                className="mt-3 flex items-center gap-2 px-3 py-1.5 border-2 border-foreground bg-white hover:bg-muted/5 transition-colors font-black text-[10px] uppercase"
            >
                {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                ) : (
                    <>
                        <Play size={14} /> assistir vídeo/áudio
                    </>
                )}
            </button>
        );
    }

    return (
        <>
            <div className="mt-4 border-2 border-foreground overflow-hidden bg-black aspect-video relative flex items-center justify-center">
                {mediaData?.variant === 'compressed' && (
                    <div className="absolute top-2 left-2 z-10 bg-primary text-foreground px-2 py-0.5 font-black text-[8px] uppercase border border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        LEVE
                    </div>
                )}
                {mediaData?.kind === 'video' ? (
                    <video
                        src={mediaData.url}
                        controls
                        className="w-full h-full"
                        autoPlay={false}
                        playsInline
                        aria-label={title || "Vídeo educativo"}
                    />
                ) : mediaData?.kind === 'audio' ? (
                    <div className="bg-foreground w-full p-8 flex flex-col items-center gap-4 text-white" role="region" aria-label="Player de áudio">
                        <Volume2 size={48} className="text-primary" aria-hidden="true" />
                        <p className="font-black text-xs uppercase text-center">{title || 'Áudio Educativo'}</p>
                        <audio src={mediaData.url} controls className="w-full" aria-label={title || "Áudio educativo"} />
                    </div>
                ) : (
                    <div className="text-white text-[10px] font-black uppercase" role="alert">Formato não suportado</div>
                )}

                <button
                    onClick={() => setShowPlayer(false)}
                    className="absolute top-2 right-2 bg-white text-black p-1 border border-black hover:bg-muted"
                    aria-label="Fechar player"
                >
                    <Pause size={12} aria-hidden="true" />
                </button>
            </div>
            {mediaData?.transcript_md && (
                <div className="mt-2 p-4 bg-muted/5 border-2 border-dashed border-foreground/10">
                    <h4 className="font-black text-[10px] uppercase text-muted mb-2">Transcrição / Acessibilidade</h4>
                    <p className="text-xs italic opacity-70 leading-relaxed">{mediaData.transcript_md}</p>
                </div>
            )}
        </>
    );
}
