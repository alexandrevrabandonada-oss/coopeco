"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { MediaObject, Post, Profile } from "@/types/eco"
import { Loader2, Heart, MessageCircle, Share2, Shield, User, MapPin, ExternalLink } from "lucide-react"
import Link from "next/link"
import { MediaPreview } from "@/components/media-preview"
import { getSignedUrlsForEntity, type MediaEntityType } from "@/lib/storage-helpers"
import { NeighborhoodErrorsWidget } from "@/components/neighborhood-errors-widget"

export default function Mural() {
    const { profile } = useAuth()
    const [posts, setPosts] = useState<Post[]>([])
    const [mediaByEntity, setMediaByEntity] = useState<Record<string, MediaObject[]>>({})
    const [signedUrlsByMediaId, setSignedUrlsByMediaId] = useState<Record<string, string>>({})
    const [isLoading, setIsLoading] = useState(true)
    const supabase = useMemo(() => createClient(), [])

    const p = profile as Profile
    const isLearnEnabled = (process.env.NEXT_PUBLIC_ECO_FEATURES_LEARN ?? process.env.ECO_FEATURES_LEARN ?? "false").toLowerCase() === "true"

    const loadMural = useCallback(async () => {
        setIsLoading(true)
        const query = supabase
            .from("posts")
            .select(`
        *,
        author:profiles!posts_created_by_fkey(display_name),
        neighborhood:neighborhoods(name),
        receipt:receipts(
          *,
          request:pickup_requests(
            *,
            resident:profiles!pickup_requests_created_by_fkey(display_name)
          )
        )
      `)
            .order("created_at", { ascending: false })

        if (p?.neighborhood_id) {
            query.eq("neighborhood_id", p.neighborhood_id)
        }

        const { data } = await query

        const safePosts = (data || []) as Post[]
        setPosts(safePosts)

        const receiptIds = safePosts
            .filter((entry) => entry.receipt?.id)
            .map((entry) => entry.receipt!.id)

        const postIds = safePosts
            .filter((entry) => entry.kind === "mutirao")
            .map((entry) => entry.id)

        const lookups: MediaObject[] = []
        if (receiptIds.length > 0) {
            const { data: receiptMedia } = await supabase
                .from("media_objects")
                .select("*")
                .eq("entity_type", "receipt")
                .in("entity_id", receiptIds)
            lookups.push(...((receiptMedia || []) as MediaObject[]))
        }

        if (postIds.length > 0) {
            const { data: postMedia } = await supabase
                .from("media_objects")
                .select("*")
                .eq("entity_type", "post")
                .in("entity_id", postIds)
            lookups.push(...((postMedia || []) as MediaObject[]))
        }

        const map: Record<string, MediaObject[]> = {}
        for (const media of lookups) {
            const key = `${media.entity_type}:${media.entity_id}`
            if (!map[key]) map[key] = []
            map[key].push(media)
        }
        setMediaByEntity(map)

        const entityKeys = Object.keys(map)
        if (entityKeys.length === 0) {
            setSignedUrlsByMediaId({})
            setIsLoading(false)
            return
        }

        const signedPayloads = await Promise.all(
            entityKeys.map(async (key) => {
                const [entityType, entityId] = key.split(":")
                if (!entityType || !entityId) return []
                return getSignedUrlsForEntity(entityType as MediaEntityType, entityId, 180)
            }),
        )

        const signedMap: Record<string, string> = {}
        for (const payload of signedPayloads) {
            for (const item of payload) {
                signedMap[item.media_id] = item.signed_url
            }
        }
        setSignedUrlsByMediaId(signedMap)
        setIsLoading(false)
    }, [p, supabase])

    useEffect(() => {
        const timer = setTimeout(() => {
            loadMural()
        }, 0)
        return () => clearTimeout(timer)
    }, [loadMural])

    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={48} /></div>

    const qualityLabelMap = {
        ok: "OK",
        attention: "ATENCAO",
        contaminated: "CONTAMINADO",
    } as const

    return (
        <div className="animate-slide-up pb-12">
            <div className="flex justify-between items-end mb-8">
                <h1 className="stencil-text" style={{ fontSize: '2.5rem', background: 'var(--primary)', padding: '0 8px', border: '2px solid var(--foreground)' }}>
                    MURAL ECO
                </h1>
                {p?.neighborhood && (
                    <div className="text-[10px] font-black uppercase text-right">
                        BAIRRO: {p.neighborhood.name}
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-8">
                {isLearnEnabled && (
                    <NeighborhoodErrorsWidget neighborhoodId={p?.neighborhood_id} compact />
                )}
                {posts.map((post) => (
                    <div key={post.id} className="card p-0 overflow-hidden">
                        {/* Header */}
                        <div className="p-4 flex items-center gap-3 border-b-2 border-foreground/5 bg-muted/5">
                            <div className="bg-primary p-2 border border-foreground">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="font-extrabold text-sm">{post.author?.display_name || 'COLABORADOR'}</p>
                                <div className="flex items-center gap-1 text-[10px] font-black uppercase text-muted">
                                    <MapPin size={10} /> {post.neighborhood?.name} • {new Date(post.created_at).toLocaleDateString('pt-BR')}
                                </div>
                            </div>
                        </div>

                        <div className="p-4">
                            {(post.kind === 'receipt' || post.kind === 'recibo') && post.receipt && (
                                <div className="flex flex-col gap-4">
                                    <div className="bg-primary/10 border-2 border-primary border-dashed p-4 flex items-center justify-between">
                                        <div>
                                            <h4 className="stencil-text text-sm">COLETA RECOMPENSADA</h4>
                                            <p className="text-xs font-bold uppercase">RECIBO #{post.receipt.receipt_code}</p>
                                        </div>
                                        <Shield className="text-primary-dark" size={32} />
                                    </div>

                                    <div className="grid-media">
                                        {(mediaByEntity[`receipt:${post.receipt.id}`] || []).map((item) => (
                                            <MediaPreview
                                                key={item.id}
                                                mediaId={item.id}
                                                signedUrl={signedUrlsByMediaId[item.id] ?? null}
                                                className="border-2 border-foreground shadow-none"
                                            />
                                        ))}
                                    </div>

                                    <p className="font-bold text-sm">
                                        {post.receipt.request?.resident?.display_name} e {post.author?.display_name} geraram impacto real!
                                    </p>

                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase text-muted">QUALIDADE:</span>
                                        <span className="text-[10px] font-black uppercase border border-foreground px-2 py-1">
                                            {qualityLabelMap[(post.receipt.quality_status || "ok") as keyof typeof qualityLabelMap]}
                                        </span>
                                    </div>

                                    <p className="text-xs font-bold uppercase text-muted">
                                        COMO MELHORAR: LIMPE E SEPARE POR MATERIAL PARA AUMENTAR O VALOR DO RECICLAVEL.
                                    </p>

                                    <Link href={`/recibos/${post.receipt.id}`} className="flex items-center gap-2 text-[10px] font-black uppercase underline">
                                        VER RECIBO COMPLETO <ExternalLink size={12} />
                                    </Link>
                                </div>
                            )}

                            {post.kind === 'mutirao' && (
                                <div className="flex flex-col gap-4">
                                    <div className="bg-secondary/10 border-2 border-secondary border-dashed p-4">
                                        <h4 className="stencil-text text-sm">MUTIRAO</h4>
                                        <p className="text-xs font-bold uppercase">{post.title || "Ação comunitária"}</p>
                                    </div>

                                    {post.body && <p className="font-bold text-sm">{post.body}</p>}

                                    <div className="grid-media">
                                        {(mediaByEntity[`post:${post.id}`] || []).map((item) => (
                                            <MediaPreview
                                                key={item.id}
                                                mediaId={item.id}
                                                signedUrl={signedUrlsByMediaId[item.id] ?? null}
                                                className="border-2 border-foreground shadow-none"
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="p-4 border-t-2 border-foreground/5 flex justify-between bg-white">
                            <button className="flex items-center gap-1 font-black text-[10px] uppercase hover:text-accent transition-colors">
                                <Heart size={18} /> APOIAR
                            </button>
                            <button className="flex items-center gap-1 font-black text-[10px] uppercase hover:text-secondary transition-colors">
                                <MessageCircle size={18} /> REPLICAR
                            </button>
                            <button className="flex items-center gap-1 font-black text-[10px] uppercase hover:text-primary transition-colors">
                                <Share2 size={18} /> CHAMADO
                            </button>
                        </div>
                    </div>
                ))}

                {posts.length === 0 && (
                    <div className="card text-center py-12">
                        <Shield size={48} className="mx-auto mb-4 text-muted/30" />
                        <p className="font-bold text-muted uppercase">AINDA NÃO HÁ MOVIMENTAÇÕES NESTES TERRITÓRIO.</p>
                    </div>
                )}
            </div>

            <style jsx>{`
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .items-center { align-items: center; }
        .justify-center { justify-content: center; }
        .justify-between { justify-content: space-between; }
        .items-end { align-items: flex-end; }
        .gap-1 { gap: 0.25rem; }
        .gap-3 { gap: 0.75rem; }
        .gap-4 { gap: 1rem; }
        .gap-8 { gap: 2rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-8 { margin-bottom: 2rem; }
        .p-0 { padding: 0; }
        .p-2 { padding: 0.5rem; }
        .p-4 { padding: 1rem; }
        .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
        .py-20 { padding-top: 5rem; padding-bottom: 5rem; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .text-xs { font-size: 0.75rem; }
        .text-sm { font-size: 0.875rem; }
        .text-muted { color: #737373; }
        .bg-muted\/5 { background-color: rgba(115, 115, 115, 0.05); }
        .bg-primary\/10 { background-color: rgba(251, 191, 36, 0.1); }
        .border-b-2 { border-bottom-width: 2px; }
        .border-t-2 { border-top-width: 2px; }
        .border-foreground\/5 { border-color: rgba(0, 0, 0, 0.05); }
        .border-dashed { border-style: dashed; }
        .overflow-hidden { overflow: hidden; }
        .grid-media {
          display: grid;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 0.75rem;
        }
        @media (min-width: 768px) {
          .grid-media {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
        </div>
    )
}
