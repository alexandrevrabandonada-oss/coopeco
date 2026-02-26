"use client"

import { useEffect, useState, use, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { Loader2, ArrowLeft, Truck, CheckCircle2, User, Phone, MapPin } from "lucide-react"
import { MediaUpload } from "@/components/media-upload"
import { PickupRequest } from "@/types/eco"
import { uploadMediaFiles } from "@/lib/storage-helpers"

const QUALITY_FLAGS = [
    { value: "food", label: "RESIDUO ORGANICO" },
    { value: "liquids", label: "LIQUIDOS" },
    { value: "mixed", label: "MISTURA DE MATERIAIS" },
    { value: "sharp", label: "MATERIAL CORTANTE" },
] as const

export default function GerenciarColeta({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const { user } = useAuth()
    const [request, setRequest] = useState<PickupRequest | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isUpdating, setIsUpdating] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [receiptNotes, setReceiptNotes] = useState("")
    const [qualityStatus, setQualityStatus] = useState<"ok" | "attention" | "contaminated">("ok")
    const [qualityNotes, setQualityNotes] = useState("")
    const [contaminationFlags, setContaminationFlags] = useState<string[]>([])
    const supabase = useMemo(() => createClient(), [])

    const makeReceiptCode = () =>
        `RC${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    const loadRequest = useCallback(async () => {
        setIsLoading(true)
        const { data } = await supabase
            .from("pickup_requests")
            .select(`
        *,
        resident:profiles!pickup_requests_created_by_fkey(display_name),
        items:pickup_request_items(*),
        private:pickup_request_private(*)
      `)
            .eq("id", id)
            .single()

        if (data) setRequest(data)
        setIsLoading(false)
    }, [id, supabase])

    useEffect(() => {
        loadRequest()
    }, [loadRequest])

    const updateStatus = async (status: 'en_route' | 'collected') => {
        setIsUpdating(true)
        try {
            const { error } = await supabase
                .from("pickup_requests")
                .update({ status })
                .eq("id", id)

            if (error) throw error
            loadRequest()
        } catch (err) {
            console.error(err)
            alert("Erro ao atualizar status.")
        } finally {
            setIsUpdating(false)
        }
    }

    const finishCollection = async () => {
        if (selectedFiles.length === 0) {
            alert("Envie pelo menos uma foto da coleta para gerar o recibo.")
            return
        }

        setIsUpdating(true)
        try {
            // 1) Cria recibo
            const { data: receipt, error: receiptError } = await supabase
                .from("receipts")
                .insert({
                    request_id: id,
                    cooperado_id: user?.id,
                    receipt_code: makeReceiptCode(),
                    final_notes: receiptNotes,
                    quality_status: qualityStatus,
                    quality_notes: qualityNotes || null,
                    contamination_flags: contaminationFlags.length > 0 ? contaminationFlags : null,
                })
                .select()
                .single()

            if (receiptError) throw receiptError

            // 2) Sobe provas de midia e registra metadados
            const uploadedMedia = await uploadMediaFiles(selectedFiles, "receipt", receipt.id)

            if (uploadedMedia.length > 0) {
                const { error: updateReceiptMediaError } = await supabase
                    .from("receipts")
                        .update({
                        proof_photo_path: uploadedMedia[0].path,
                        final_notes: receiptNotes,
                        quality_status: qualityStatus,
                        quality_notes: qualityNotes || null,
                        contamination_flags: contaminationFlags.length > 0 ? contaminationFlags : null,
                    })
                    .eq("id", receipt.id)

                if (updateReceiptMediaError) throw updateReceiptMediaError
            }

            // 3) Atualiza status da request
            const { error: updateError } = await supabase
                .from("pickup_requests")
                .update({ status: 'collected' })
                .eq("id", id)

            if (updateError) throw updateError

            // 4) Automacao social (post de recibo)
            if (request?.neighborhood_id) {
                await supabase.from("posts").insert({
                    receipt_id: receipt.id,
                    created_by: user?.id,
                    neighborhood_id: request.neighborhood_id,
                    kind: "recibo",
                    body: "Recibo de coleta publicado."
                })
            }

            router.push(`/recibos/${receipt.id}`)
        } catch (err) {
            console.error(err)
            alert("Erro ao finalizar coleta e gerar recibo.")
        } finally {
            setIsUpdating(false)
        }
    }

    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={48} /></div>
    if (!request) return <div className="p-8 text-center font-black">PEDIDO NÃO ENCONTRADO</div>

    return (
        <div className="animate-slide-up pb-20">
            <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 font-black text-xs uppercase">
                <ArrowLeft size={16} /> VOLTAR AO PAINEL
            </button>

            <div className="card p-0 overflow-hidden mb-8">
                <div className="p-4 bg-foreground text-background flex justify-between items-center">
                    <span className="stencil-text text-sm">GESTÃO DE COLETA</span>
                    <span className="font-black text-xs uppercase bg-primary text-foreground px-2">{request.status.replace('_', ' ')}</span>
                </div>

                <div className="p-4">
                    <div className="flex flex-col gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <User className="text-muted" size={20} />
                            <div>
                                <span className="text-[10px] font-black uppercase text-muted">MORADOR</span>
                                <span className="text-secondary font-black uppercase">SOLICITANTE: <strong className="text-foreground">{request.resident?.display_name}</strong></span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Phone className="text-muted" size={20} />
                            <div>
                                <p className="font-bold text-sm uppercase mb-1">{request.private?.[0]?.address_full}</p>
                                <p className="font-bold text-accent">{request.private?.[0]?.contact_phone}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <MapPin className="text-muted" size={20} />
                            <div>
                                <span className="text-[10px] font-black uppercase text-muted">LOCALIZAÇÃO</span>
                                <p className="font-extrabold uppercase text-sm">{request.private?.[0]?.address_full}</p>
                            </div>
                        </div>
                    </div>

                    <div className="border-t-2 border-foreground/10 pt-4 mb-6">
                        <h4 className="stencil-text text-xs mb-3">ITENS DECLARADOS:</h4>
                        <ul className="flex flex-col gap-2 list-none p-0">
                            {request.items?.map((item) => (
                                <li key={item.id} className="flex justify-between items-center bg-muted/10 p-2 border border-foreground/10">
                                    <span className="font-black text-xs uppercase">{item.material}</span>
                                    <span className="font-bold text-xs">{item.qty} {item.unit.toUpperCase()}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex flex-col gap-3">
                        {request.status === 'accepted' ? (
                            <button
                                onClick={() => updateStatus('en_route')}
                                disabled={isUpdating}
                                className="cta-button w-full justify-center py-6"
                            >
                                {isUpdating ? <Loader2 className="animate-spin" /> : <><Truck size={24} /> INICIAR DESLOCAMENTO</>}
                            </button>
                        ) : null}

                        {request.status === 'en_route' && (
                            <div className="flex flex-col gap-4">
                                <div className="p-4 border-2 border-primary bg-primary/5">
                                    <h2 className="stencil-text">RESUMO DA COLETA</h2>

                                    <MediaUpload
                                        onFilesSelected={setSelectedFiles}
                                        label="FOTOGRAFAR MATERIAL"
                                        multiple
                                        maxFiles={6}
                                    />

                                    <div className="mt-4">
                                        <label className="text-[10px] font-black uppercase block mb-1">NOTAS DO RECIBO</label>
                                        <textarea
                                            value={receiptNotes}
                                            onChange={(e) => setReceiptNotes(e.target.value)}
                                            className="w-full p-3 border-2 border-foreground bg-white font-bold outline-none text-sm h-20"
                                            placeholder="EX: TUDO SEPARADO CORRETAMENTE."
                                        />
                                    </div>

                                    <div className="mt-4">
                                        <label className="text-[10px] font-black uppercase block mb-1">QUALIDADE</label>
                                        <select
                                            value={qualityStatus}
                                            onChange={(e) => setQualityStatus(e.target.value as "ok" | "attention" | "contaminated")}
                                            className="w-full p-3 border-2 border-foreground bg-white font-black outline-none text-xs uppercase"
                                            aria-label="Qualidade"
                                        >
                                            <option value="ok">OK</option>
                                            <option value="attention">ATENCAO</option>
                                            <option value="contaminated">CONTAMINADO</option>
                                        </select>
                                    </div>

                                    <div className="mt-4">
                                        <label className="text-[10px] font-black uppercase block mb-2">FLAGS RAPIDAS</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {QUALITY_FLAGS.map((flag) => (
                                                <label key={flag.value} className="flex items-center gap-2 text-[10px] font-black uppercase">
                                                    <input
                                                        type="checkbox"
                                                        checked={contaminationFlags.includes(flag.value)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setContaminationFlags((curr) => [...curr, flag.value])
                                                                return
                                                            }
                                                            setContaminationFlags((curr) => curr.filter((item) => item !== flag.value))
                                                        }}
                                                    />
                                                    {flag.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <label className="text-[10px] font-black uppercase block mb-1">NOTA DE QUALIDADE (OPCIONAL)</label>
                                        <textarea
                                            value={qualityNotes}
                                            onChange={(e) => setQualityNotes(e.target.value)}
                                            className="w-full p-3 border-2 border-foreground bg-white font-bold outline-none text-sm h-20"
                                            placeholder="EX: ENXAGUAR EMBALAGENS E SEPARAR VIDRO."
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={finishCollection}
                                    disabled={isUpdating}
                                    className="cta-button w-full justify-center py-6"
                                    style={{ background: 'var(--accent)', color: 'white' }}
                                >
                                    {isUpdating ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={24} /> FINALIZAR E GERAR RECIBO</>}
                                </button>
                            </div>
                        )}

                        {request.status === 'collected' && (
                            <div className="card text-center py-8 bg-green-50 border-green-600">
                                <CheckCircle2 size={48} className="mx-auto mb-2 text-green-600" />
                                <h3 className="stencil-text text-green-600">COLETA CONCLUÍDA</h3>
                                <p className="font-bold text-sm mt-2">RECIBO GERADO E MURAL ATUALIZADO.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .items-center { align-items: center; }
        .justify-center { justify-content: center; }
        .justify-between { justify-content: space-between; }
        .gap-2 { gap: 0.5rem; }
        .gap-3 { gap: 0.75rem; }
        .gap-4 { gap: 1rem; }
        .mb-1 { margin-bottom: 0.25rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-3 { margin-bottom: 0.75rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mb-8 { margin-bottom: 2rem; }
        .p-0 { padding: 0; }
        .p-2 { padding: 0.5rem; }
        .p-3 { padding: 0.75rem; }
        .p-4 { padding: 1rem; }
        .py-20 { padding-top: 5rem; padding-bottom: 5rem; }
        .text-center { text-align: center; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .text-xs { font-size: 0.75rem; }
        .text-sm { font-size: 0.875rem; }
        .text-muted { color: #737373; }
        .text-accent { color: var(--accent); }
        .bg-muted\/10 { background-color: rgba(115, 115, 115, 0.05); }
        .border-t-2 { border-top-width: 2px; }
        .border-2 { border-width: 2px; }
        .overflow-hidden { overflow: hidden; }
        .pb-20 { padding-bottom: 5rem; }
        .block { display: block; }
        .h-20 { height: 5rem; }
      `}</style>
        </div>
    )
}
