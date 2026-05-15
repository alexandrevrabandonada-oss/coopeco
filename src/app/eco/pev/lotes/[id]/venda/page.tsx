"use client"

import { useState, useEffect } from "react"
import { getLotById, updateLot, PevLot } from "@/lib/eco/pev"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Save, Loader2, DollarSign, Scale, Calendar } from "lucide-react"
import Link from "next/link"

const DESTINATION_TYPES = [
  { val: 'cooperative', label: 'Cooperativa' },
  { val: 'buyer', label: 'Comprador/Indústria' },
  { val: 'association', label: 'Associação' },
  { val: 'donation', label: 'Doação' },
  { val: 'other', label: 'Outro' }
]

export default function VendaPage() {
  const router = useRouter()
  const { id } = useParams() as { id: string }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lot, setLot] = useState<PevLot | null>(null)
  const [formData, setFormData] = useState({
    destination_name: "",
    destination_type: "buyer" as PevLot['destination_type'],
    sold_at: new Date().toISOString().split('T')[0],
    gross_value: "",
    final_weight_kg: "",
    sale_notes: ""
  })

  useEffect(() => {
    getLotById(id).then(data => {
      setLot(data)
      setFormData({
        destination_name: data.destination_name || "",
        destination_type: data.destination_type || "buyer",
        sold_at: data.sold_at ? new Date(data.sold_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        gross_value: data.gross_value?.toString() || "",
        final_weight_kg: data.final_weight_kg?.toString() || "",
        sale_notes: data.sale_notes || ""
      })
      setLoading(false)
    })
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateLot(id, {
        ...formData,
        gross_value: parseFloat(formData.gross_value) || 0,
        final_weight_kg: parseFloat(formData.final_weight_kg) || 0,
        status: 'sold',
        sold_at: new Date(formData.sold_at).toISOString()
      })
      router.push(`/eco/pev/lotes/${id}`)
    } catch (err) {
      console.error(err)
      alert("Erro ao salvar venda")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-12 text-center font-black uppercase">Carregando Lote...</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-slide-up">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/eco/pev/lotes/${id}`} className="p-2 border-2 border-black hover:bg-gray-100">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="stencil-text text-3xl leading-none">REGISTRAR VENDA</h1>
          <span className="text-xs font-black uppercase text-muted">LOTE: {lot?.code}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <label className="block text-sm font-black uppercase mb-2">Destino / Comprador</label>
          <input
            type="text"
            required
            value={formData.destination_name}
            onChange={e => setFormData({ ...formData, destination_name: e.target.value })}
            className="w-full p-4 border-4 border-black font-black text-xl outline-none focus:bg-yellow-50"
            placeholder="EX: COOPERATIVA VERDE"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <label className="block text-sm font-black uppercase mb-2">Tipo de Destino</label>
            <select
              value={formData.destination_type || "buyer"}
              onChange={e => setFormData({ ...formData, destination_type: e.target.value as PevLot['destination_type'] })}
              className="w-full p-3 border-2 border-black font-bold outline-none appearance-none"
            >
              {DESTINATION_TYPES.map(t => (
                <option key={t.val} value={t.val}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="card">
            <label className="block text-sm font-black uppercase mb-2 flex items-center gap-2">
              <Calendar size={14} /> DATA DA VENDA
            </label>
            <input
              type="date"
              required
              value={formData.sold_at}
              onChange={e => setFormData({ ...formData, sold_at: e.target.value })}
              className="w-full p-2.5 border-2 border-black font-bold outline-none focus:bg-yellow-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card bg-primary bg-opacity-10">
            <label className="block text-sm font-black uppercase mb-2 flex items-center gap-2 text-primary-dark">
              <DollarSign size={16} /> VALOR BRUTO (R$)
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.gross_value}
              onChange={e => setFormData({ ...formData, gross_value: e.target.value })}
              className="w-full p-4 border-4 border-black font-black text-2xl outline-none focus:bg-yellow-50"
              placeholder="0,00"
            />
          </div>
          <div className="card bg-blue-50">
            <label className="block text-sm font-black uppercase mb-2 flex items-center gap-2 text-blue-800">
              <Scale size={16} /> PESO FINAL (KG)
            </label>
            <input
              type="number"
              step="0.1"
              required
              value={formData.final_weight_kg}
              onChange={e => setFormData({ ...formData, final_weight_kg: e.target.value })}
              className="w-full p-4 border-4 border-black font-black text-2xl outline-none focus:bg-yellow-50"
              placeholder="0,0"
            />
          </div>
        </div>

        <div className="card">
          <label className="block text-sm font-black uppercase mb-2">Observações da Venda</label>
          <textarea
            value={formData.sale_notes}
            onChange={e => setFormData({ ...formData, sale_notes: e.target.value })}
            className="w-full p-3 border-2 border-black font-bold outline-none focus:bg-yellow-50 min-h-[100px]"
            placeholder="Ex: Nota fiscal enviada, desconto por material úmido..."
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className={`w-full cta-button justify-center py-6 text-2xl bg-primary ${
            saving ? "opacity-50 grayscale cursor-not-allowed" : ""
          }`}
        >
          {saving ? <Loader2 className="animate-spin" /> : <>SALVAR VENDA <Save className="ml-2" /></>}
        </button>
      </form>
    </div>
  )
}
