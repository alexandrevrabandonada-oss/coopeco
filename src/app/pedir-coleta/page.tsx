"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { Recycle, Plus, Trash2, ArrowRight, ArrowLeft, Loader2, Clock, MapPin } from "lucide-react"
import { Profile } from "@/types/eco"

type Item = {
    material: string
    unit: string
    qty: number
}

export default function PedirColeta() {
    const MAX_ITEMS_PER_REQUEST = 12
    const MAX_QTY_PER_ITEM = 50

    const router = useRouter()
    const { user, profile } = useAuth()
    const [step, setStep] = useState(1)
    const [items, setItems] = useState<Item[]>([{ material: "paper", unit: "bag_m", qty: 1 }])
    const [notes, setNotes] = useState("")
    const [address, setAddress] = useState("")
    const [phone, setPhone] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState("")

    if (!user || !profile || profile.role !== 'resident') {
        return (
            <div className="card text-center py-12">
                <h2 className="stencil-text mb-4">ACESSO NECESSÁRIO</h2>
                <p className="mb-6 font-bold">VOCÊ PRECISA ESTAR LOGADO PARA PEDIR UMA COLETA.</p>
                <button onClick={() => router.push('/perfil')} className="cta-button mx-auto">IR PARA LOGIN</button>
            </div>
        )
    }

    const p = profile as Profile

    const addItem = () => {
        if (items.length >= MAX_ITEMS_PER_REQUEST) {
            setErrorMessage(`Máximo de ${MAX_ITEMS_PER_REQUEST} itens por pedido.`)
            return
        }
        setErrorMessage("")
        setItems([...items, { material: "paper", unit: "bag_m", qty: 1 }])
    }
    const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index))
    const updateItem = (index: number, field: keyof Item, value: string | number) => {
        const newItems = [...items]
        if (field === "qty") {
            const rawQty = Number(value)
            const safeQty = Number.isFinite(rawQty)
                ? Math.min(MAX_QTY_PER_ITEM, Math.max(1, rawQty))
                : 1
            newItems[index] = { ...newItems[index], qty: safeQty }
        } else {
            newItems[index] = { ...newItems[index], [field]: value }
        }
        setItems(newItems)
    }

    const handleSubmit = async () => {
        setErrorMessage("")

        if (items.length > MAX_ITEMS_PER_REQUEST) {
            setErrorMessage(`Máximo de ${MAX_ITEMS_PER_REQUEST} itens por pedido.`)
            return
        }

        setIsSubmitting(true)
        const supabase = createClient()

        try {
            // 1. Create Pickup Request
            const { data: request, error: reqError } = await supabase
                .from("pickup_requests")
                .insert({
                    created_by: user.id,
                    neighborhood_id: p.neighborhood_id!,
                    notes: notes
                })
                .select()
                .single()

            if (reqError) throw reqError

            // 2. Insert Items
            const { error: itemsError } = await supabase
                .from("pickup_request_items")
                .insert(items.map(item => ({
                    request_id: request.id,
                    material: item.material,
                    unit: item.unit,
                    qty: item.qty
                })))

            if (itemsError) throw itemsError

            // 3. Insert Private Data
            const { error: privateError } = await supabase
                .from("pickup_request_private")
                .insert({
                    request_id: request.id,
                    address_full: address,
                    contact_phone: phone
                })

            if (privateError) throw privateError

            router.push('/pedidos')
        } catch (err) {
            console.error(err)
            const maybeError = err as { message?: string } | null
            const errorText = maybeError?.message || ""
            if (errorText.includes("rate_limit")) {
                setErrorMessage("Você atingiu o limite diário de pedidos. Tente amanhã ou junte mais itens em um único pedido.")
            } else if (errorText.includes("item_limit")) {
                setErrorMessage(`Máximo de ${MAX_ITEMS_PER_REQUEST} itens por pedido.`)
            } else if (errorText.includes("item_qty_limit")) {
                setErrorMessage(`A quantidade por item deve ficar entre 1 e ${MAX_QTY_PER_ITEM}.`)
            } else {
                setErrorMessage("Erro ao criar pedido. Verifique os dados e tente novamente.")
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="animate-slide-up pb-12">
            <div className="flex items-center gap-4 mb-8">
                <h1 className="stencil-text" style={{ fontSize: '2rem', background: 'var(--primary)', padding: '0 8px', border: '2px solid var(--foreground)' }}>
                    PEDIR COLETA
                </h1>
                <div className="stencil-text text-sm">PASSO {step} / 3</div>
            </div>

            {errorMessage && (
                <div className="card mb-6 border-2 border-accent" style={{ background: '#fff4f4' }}>
                    <p className="font-black text-xs uppercase" style={{ color: 'var(--accent)' }}>
                        {errorMessage}
                    </p>
                </div>
            )}

            {step === 1 && (
                <div className="animate-slide-up">
                    <h2 className="stencil-text text-xl mb-4">1. O QUE VAMOS COLETAR?</h2>
                    <div className="flex flex-col gap-4">
                        {items.map((item, index) => (
                            <div key={index} className="card p-4 relative" style={{ background: '#fff' }}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black uppercase">Material</label>
                                        <select
                                            value={item.material}
                                            onChange={(e) => updateItem(index, 'material', e.target.value)}
                                            className="border-2 border-foreground p-2 font-bold text-sm outline-none"
                                        >
                                            <option value="paper">PAPEL / PAPELÃO</option>
                                            <option value="plastic">PLÁSTICO</option>
                                            <option value="metal">METAL</option>
                                            <option value="glass">VIDRO</option>
                                            <option value="oil">ÓLEO USADO</option>
                                            <option value="ewaste">ELETRÔNICOS</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black uppercase">Unidade</label>
                                        <select
                                            value={item.unit}
                                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                                            className="border-2 border-foreground p-2 font-bold text-sm outline-none"
                                        >
                                            <option value="bag_p">SACO P</option>
                                            <option value="bag_m">SACO M</option>
                                            <option value="bag_g">SACO G</option>
                                            <option value="oil_liters">LITROS</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black uppercase">Quantidade</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max={MAX_QTY_PER_ITEM}
                                            value={item.qty}
                                            onChange={(e) => updateItem(index, 'qty', e.target.value)}
                                            className="border-2 border-foreground p-2 font-bold text-sm outline-none"
                                        />
                                    </div>
                                </div>
                                {items.length > 1 && (
                                    <button
                                        onClick={() => removeItem(index)}
                                        className="absolute -top-2 -right-2 bg-accent text-white p-1 border-2 border-foreground"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            onClick={addItem}
                            disabled={items.length >= MAX_ITEMS_PER_REQUEST}
                            className="border-2 border-dashed border-foreground p-4 flex items-center justify-center gap-2 font-black uppercase hover:bg-muted"
                        >
                            <Plus size={20} /> ADICIONAR MAIS ITENS
                        </button>
                        <p className="text-[10px] font-black uppercase text-muted">
                            Dica: junte mais materiais em um unico pedido para facilitar a coleta.
                        </p>
                    </div>
                    <button onClick={() => setStep(2)} className="cta-button w-full justify-center mt-8 py-6">
                        PRÓXIMO: LOGÍSTICA <ArrowRight size={20} />
                    </button>
                </div>
            )}

            {step === 2 && (
                <div className="animate-slide-up">
                    <h2 className="stencil-text text-xl mb-4">2. QUANDO E ONDE?</h2>
                    <div className="flex flex-col gap-6">
                        <div className="card flex flex-col gap-2">
                            <label className="stencil-text text-sm flex items-center gap-2">
                                <MapPin size={16} /> ENDEREÇO COMPLETO
                            </label>
                            <textarea
                                required
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="w-full p-4 border-2 border-foreground bg-white font-bold outline-none h-24"
                                placeholder="RUA, NÚMERO, APTO/BLOCO..."
                            />
                        </div>

                        <div className="card flex flex-col gap-2">
                            <label className="stencil-text text-sm flex items-center gap-2">
                                <Clock size={16} /> TELEFONE PARA CONTATO
                            </label>
                            <input
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full p-4 border-2 border-foreground bg-white font-bold outline-none"
                                placeholder="(00) 00000-0000"
                            />
                        </div>

                        <div className="card flex flex-col gap-2">
                            <label className="stencil-text text-sm">OBSERVAÇÕES (OPCIONAL)</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full p-4 border-2 border-foreground bg-white font-bold outline-none h-24"
                                placeholder="EX: DEIXAREI NA PORTARIA..."
                            />
                        </div>
                    </div>
                    <div className="flex gap-4 mt-8">
                        <button onClick={() => setStep(1)} className="border-2 border-foreground p-6 bg-white flex items-center justify-center">
                            <ArrowLeft size={24} />
                        </button>
                        <button onClick={() => setStep(3)} className="cta-button flex-1 justify-center py-6">
                            REVISAR PEDIDO <ArrowRight size={20} />
                        </button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="animate-slide-up">
                    <h2 className="stencil-text text-xl mb-4">3. REVISÃO FINAL</h2>
                    <div className="card" style={{ background: 'var(--primary)' }}>
                        <h3 className="stencil-text text-lg mb-2">RESUMO DA COLETA</h3>
                        <ul className="flex flex-col gap-1 list-none p-0">
                            {items.map((it, i) => (
                                <li key={i} className="font-extrabold uppercase border-b border-foreground/20 pb-1">
                                    {it.qty}x {it.unit} DE {it.material}
                                </li>
                            ))}
                        </ul>
                        <div className="mt-4 pt-4 border-t-2 border-foreground">
                            <p className="font-black text-xs uppercase mb-1">LOCAL DE COLETA:</p>
                            <p className="font-bold uppercase text-sm">{address}</p>
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="cta-button w-full justify-center mt-8 py-8"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : (
                            <>
                                <Recycle size={32} />
                                CONFIRMAR E PEDIR AGORA
                            </>
                        )}
                    </button>
                    <button onClick={() => setStep(2)} className="w-full mt-4 font-black underline uppercase text-sm">VOLTAR E EDITAR</button>
                </div>
            )}

            <style jsx>{`
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .flex-1 { flex: 1; }
        .grid { display: grid; }
        .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .gap-1 { gap: 0.25rem; }
        .gap-2 { gap: 0.5rem; }
        .gap-4 { gap: 1rem; }
        .gap-6 { gap: 1.5rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mb-8 { margin-bottom: 2rem; }
        .text-sm { font-size: 0.875rem; }
        .text-lg { font-size: 1.125rem; }
        .text-xl { font-size: 1.25rem; }
        .text-center { text-align: center; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .relative { position: relative; }
        .absolute { position: absolute; }
        .w-full { width: 100%; }
        .h-24 { height: 6rem; }
        .pb-12 { padding-bottom: 3rem; }
      `}</style>
        </div>
    )
}
