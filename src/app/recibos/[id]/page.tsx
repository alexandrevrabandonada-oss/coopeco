"use client"

import { useEffect, useState, use, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { Loader2, ArrowLeft, Shield, Calendar, User, MapPin } from "lucide-react"
import { useRouter } from "next/navigation"
import { MediaPreview } from "@/components/media-preview"
import { EduTip, MediaObject, Receipt, ReceiptTip } from "@/types/eco"
import { getSignedUrlsForEntity } from "@/lib/storage-helpers"
import { NeighborhoodErrorsWidget } from "@/components/neighborhood-errors-widget"

export default function ReciboDetalhes({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [receipt, setReceipt] = useState<Receipt | null>(null)
    const [receiptMedia, setReceiptMedia] = useState<MediaObject[]>([])
    const [signedUrlsByMediaId, setSignedUrlsByMediaId] = useState<Record<string, string>>({})
    const [isLoading, setIsLoading] = useState(true)
    const supabase = useMemo(() => createClient(), [])

    const loadReceipt = useCallback(async () => {
        setIsLoading(true)
        const { data } = await supabase
            .from("receipts")
            .select(`
        *,
        receipt_tip(
          receipt_id,
          tip_id,
          created_at,
          tip:edu_tips(id, slug, title, body, locale, active)
        ),
        request:pickup_requests(
          *,
          resident:profiles!pickup_requests_created_by_fkey(display_name),
          neighborhood:neighborhoods(name),
          items:pickup_request_items(*)
        ),
        cooperado:profiles!receipts_cooperado_id_fkey(display_name)
      `)
            .eq("id", id)
            .single()

        if (data) setReceipt(data)

        const { data: mediaData } = await supabase
            .from("media_objects")
            .select("*")
            .eq("entity_type", "receipt")
            .eq("entity_id", id)
            .order("created_at", { ascending: true })

        const safeMedia = (mediaData || []) as MediaObject[]
        setReceiptMedia(safeMedia)

        if (safeMedia.length === 0) {
            setSignedUrlsByMediaId({})
            setIsLoading(false)
            return
        }

        const signedItems = await getSignedUrlsForEntity("receipt", id, 180)
        const signedMap: Record<string, string> = {}
        for (const item of signedItems) {
            signedMap[item.media_id] = item.signed_url
        }
        setSignedUrlsByMediaId(signedMap)
        setIsLoading(false)
    }, [id, supabase])

    useEffect(() => {
        const timer = setTimeout(() => {
            loadReceipt()
        }, 0)
        return () => clearTimeout(timer)
    }, [loadReceipt])

    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={48} /></div>
    if (!receipt) return <div className="p-8 text-center font-black">RECIBO NÃO ENCONTRADO</div>

    const qualityLabelMap = {
        ok: "OK",
        attention: "ATENCAO",
        contaminated: "CONTAMINADO",
    } as const

    const qualityColorMap = {
        ok: "var(--accent)",
        attention: "var(--secondary)",
        contaminated: "#b91c1c",
    } as const

    const qualityStatus = receipt.quality_status || "ok"
    const tipSource = receipt.receipt_tip
    const tipRow = Array.isArray(tipSource) ? tipSource[0] : tipSource
    const tip = (tipRow as ReceiptTip | null)?.tip as EduTip | null
    const isLearnEnabled = (process.env.NEXT_PUBLIC_ECO_FEATURES_LEARN ?? process.env.ECO_FEATURES_LEARN ?? "false").toLowerCase() === "true"

    return (
        <div className="animate-slide-up pb-12">
            <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 font-black text-xs uppercase">
                <ArrowLeft size={16} /> VOLTAR
            </button>

            <div className="card p-0 overflow-hidden" style={{ borderStyle: 'double', borderWidth: '6px' }}>
                <div className="p-6 bg-primary text-foreground text-center border-b-4 border-foreground">
                    <Shield size={48} className="mx-auto mb-2" />
                    <h1 className="stencil-text" style={{ fontSize: '2rem', lineHeight: '1' }}>RECIBO ECO</h1>
                    <p className="font-black text-xl mt-1">#{receipt.receipt_code}</p>
                </div>

                <div className="p-6">
                    <div className="flex flex-col gap-6 mb-8">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-[10px] font-black uppercase text-muted">DATA DA COLETA</span>
                                <p className="font-extrabold flex items-center gap-1"><Calendar size={14} /> {new Date(receipt.created_at).toLocaleDateString('pt-BR')}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black uppercase text-muted">LOCAL</span>
                                <p className="font-extrabold flex items-center gap-1 justify-end"><MapPin size={14} /> {receipt.request?.neighborhood?.name}</p>
                            </div>
                        </div>

                        <div className="border-t-2 border-dashed border-foreground/20 pt-4">
                            <span className="text-[10px] font-black uppercase text-muted">PARTICIPANTES</span>
                            <div className="flex flex-col gap-2 mt-2">
                                <div className="flex items-center gap-2">
                                    <User size={16} className="text-secondary" />
                                    <span className="text-xs">MORADOR: <strong>{receipt.request?.resident?.display_name}</strong></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <User size={16} className="text-primary-dark" />
                                    <span className="text-xs">COOPERADO: <strong>{receipt.cooperado?.display_name}</strong></span>
                                </div>
                            </div>
                        </div>

                        <div className="border-t-2 border-dashed border-foreground/20 pt-4">
                            <span className="text-[10px] font-black uppercase text-muted">MATERIAIS COLETADOS</span>
                            <ul className="list-none p-0 mt-2 flex flex-col gap-1">
                                {receipt.request?.items?.map((item) => (
                                    <li key={item.id} className="text-sm font-black uppercase flex justify-between">
                                        <span>{item.material}</span>
                                        <span>{item.qty} {item.unit}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="border-t-2 border-dashed border-foreground/20 pt-4">
                            <span className="text-[10px] font-black uppercase text-muted">QUALIDADE</span>
                            <div className="mt-2 inline-flex items-center px-3 py-2 border-2 border-foreground">
                                <span className="font-black text-xs uppercase" style={{ color: qualityColorMap[qualityStatus] }}>
                                    {qualityLabelMap[qualityStatus]}
                                </span>
                            </div>
                            {receipt.contamination_flags && receipt.contamination_flags.length > 0 && (
                                <p className="text-xs font-bold mt-2 uppercase">
                                    FLAGS: {receipt.contamination_flags.join(", ")}
                                </p>
                            )}
                            {receipt.quality_notes && (
                                <p className="text-xs font-bold mt-2 uppercase">
                                    NOTA: {receipt.quality_notes}
                                </p>
                            )}
                        </div>

                        <div className="border-t-2 border-dashed border-foreground/20 pt-4">
                            <span className="text-[10px] font-black uppercase text-muted">PROVA VISUAL</span>
                            <div className="mt-2">
                                {receiptMedia.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {receiptMedia.map((item) => (
                                            <MediaPreview
                                                key={item.id}
                                                mediaId={item.id}
                                                signedUrl={signedUrlsByMediaId[item.id] ?? null}
                                                className="border-2 border-foreground shadow-none"
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs font-bold">Sem provas de midia disponiveis para este recibo.</p>
                                )}
                            </div>
                        </div>

                        {tip && (
                            <div className="border-t-2 border-dashed border-foreground/20 pt-4">
                                <span className="text-[10px] font-black uppercase text-muted">DICA DO DIA</span>
                                <div className="mt-2 border-2 border-primary bg-primary/10 p-4">
                                    <p className="stencil-text text-xs">{tip.title}</p>
                                    <p className="font-bold text-xs mt-2">{tip.body}</p>
                                </div>
                            </div>
                        )}

                        {isLearnEnabled && (
                            <div className="border-t-2 border-dashed border-foreground/20 pt-4">
                                <NeighborhoodErrorsWidget neighborhoodId={receipt.request?.neighborhood_id} compact />
                            </div>
                        )}
                    </div>

                    <div className="bg-muted/10 p-4 text-center border-2 border-foreground">
                        <p className="text-[10px] font-black uppercase mb-1">VALIDAÇÃO ECO</p>
                        <p className="text-[8px] font-mono break-all text-muted">{receipt.id}</p>
                    </div>
                </div>
            </div>

            <style jsx>{`
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .items-center { align-items: center; }
        .justify-center { justify-content: center; }
        .justify-between { justify-content: space-between; }
        .justify-end { justify-content: flex-end; }
        .gap-1 { gap: 0.25rem; }
        .gap-2 { gap: 0.5rem; }
        .gap-6 { gap: 1.5rem; }
        .p-0 { padding: 0; }
        .p-4 { padding: 1rem; }
        .p-6 { padding: 1.5rem; }
        .py-20 { padding-top: 5rem; padding-bottom: 5rem; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .text-xs { font-size: 0.75rem; }
        .text-sm { font-size: 0.875rem; }
        .text-xl { font-size: 1.25rem; }
        .text-muted { color: #737373; }
        .overflow-hidden { overflow: hidden; }
        .mt-1 { margin-top: 0.25rem; }
        .mt-2 { margin-top: 0.5rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mb-8 { margin-bottom: 2rem; }
        .border-b-4 { border-bottom-width: 4px; }
        .grid { display: grid; }
        .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
        @media (min-width: 768px) {
          .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        .gap-3 { gap: 0.75rem; }
      `}</style>
        </div>
    )
}
