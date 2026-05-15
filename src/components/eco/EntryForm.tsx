"use client"

import { useState } from "react"
import { createEntry, PevEntry } from "@/lib/eco/pev"
import { useRouter } from "next/navigation"
import { Check, AlertTriangle, Loader2 } from "lucide-react"

const MATERIAL_TYPES = ["Plástico", "Papel/Papelão", "Metal", "Vidro", "Eletrônicos", "Óleo", "Outros"]
const UNITS = [
  { val: "kg", label: "Quilogramas (kg)" },
  { val: "saco_p", label: "Saco P" },
  { val: "saco_m", label: "Saco M" },
  { val: "saco_g", label: "Saco G" },
  { val: "caixa_p", label: "Caixa P" },
  { val: "caixa_m", label: "Caixa M" },
  { val: "caixa_g", label: "Caixa G" },
  { val: "litro", label: "Litros (l)" },
  { val: "unidade", label: "Unidades" }
]
const CONDITIONS = [
  { val: "clean", label: "Limpo" },
  { val: "mixed", label: "Misturado" },
  { val: "wet", label: "Molhado/Sujo" },
  { val: "rejected", label: "Rejeitado" },
  { val: "unsafe", label: "Perigoso" }
]
const SOURCE_TYPES = [
  { val: "resident", label: "Residente" },
  { val: "commerce", label: "Comércio" },
  { val: "school", label: "Escola" },
  { val: "condominium", label: "Condomínio" },
  { val: "association", label: "Associação" },
  { val: "other", label: "Outro" }
]

export function EntryForm({ pevId, cellId }: { pevId: string, cellId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    material_type: "",
    quantity: "",
    unit: "kg",
    condition: "clean" as PevEntry['condition'],
    source_type: "resident",
    source_neighborhood: "",
    notes: ""
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await createEntry({
        pev_id: pevId,
        cell_id: cellId,
        material_type: formData.material_type,
        quantity: parseFloat(formData.quantity) || 0,
        unit: formData.unit,
        condition: formData.condition,
        source_type: formData.source_type,
        source_neighborhood: formData.source_neighborhood,
        notes: formData.notes
      })
      setSuccess(true)
      setTimeout(() => {
        router.refresh()
        setSuccess(false)
        setFormData({ ...formData, quantity: "", notes: "", material_type: "" })
      }, 2000)
    } catch (err) {
      console.error(err)
      alert("Erro ao registrar recebimento")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="card bg-green-50 border-green-500 text-green-800 flex flex-col items-center justify-center py-12">
        <Check size={48} className="mb-4" />
        <h2 className="stencil-text text-2xl">Recebido!</h2>
        <p>Registro salvo com sucesso.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card">
        <label className="block text-sm font-black uppercase mb-2">Tipo de Material</label>
        <div className="grid grid-cols-2 gap-2">
          {MATERIAL_TYPES.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setFormData({ ...formData, material_type: type })}
              className={`p-3 border-2 text-sm font-bold uppercase transition-all ${
                formData.material_type === type 
                  ? "bg-primary border-black scale-[1.02] shadow-[2px_2px_0px_black]" 
                  : "bg-white border-gray-200 grayscale opacity-70"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <label className="block text-sm font-black uppercase mb-2">Quantidade</label>
          <input
            type="number"
            step="0.01"
            required
            value={formData.quantity}
            onChange={e => setFormData({ ...formData, quantity: e.target.value })}
            className="w-full p-3 border-2 border-black font-bold focus:bg-yellow-50 outline-none"
            placeholder="0.00"
          />
        </div>
        <div className="card">
          <label className="block text-sm font-black uppercase mb-2">Unidade</label>
          <select
            value={formData.unit}
            onChange={e => setFormData({ ...formData, unit: e.target.value })}
            className="w-full p-3 border-2 border-black font-bold focus:bg-yellow-50 outline-none appearance-none"
          >
            {UNITS.map(u => (
              <option key={u.val} value={u.val}>{u.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <label className="block text-sm font-black uppercase mb-2">Condição</label>
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map(c => (
            <button
              key={c.val}
              type="button"
              onClick={() => setFormData({ ...formData, condition: c.val as PevEntry['condition'] })}
              className={`px-4 py-2 border-2 text-xs font-black uppercase transition-all ${
                formData.condition === c.val 
                  ? "bg-black text-white border-black" 
                  : "bg-white border-gray-300"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <label className="block text-sm font-black uppercase mb-2">Origem</label>
        <div className="grid grid-cols-2 gap-4">
          <select
            value={formData.source_type}
            onChange={e => setFormData({ ...formData, source_type: e.target.value })}
            className="w-full p-3 border-2 border-black font-bold focus:bg-yellow-50 outline-none appearance-none"
          >
            {SOURCE_TYPES.map(s => (
              <option key={s.val} value={s.val}>{s.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Bairro de Origem"
            value={formData.source_neighborhood}
            onChange={e => setFormData({ ...formData, source_neighborhood: e.target.value })}
            className="w-full p-3 border-2 border-black font-bold focus:bg-yellow-50 outline-none"
          />
        </div>
      </div>

      <div className="card">
        <label className="block text-sm font-black uppercase mb-2">Observações</label>
        <textarea
          value={formData.notes}
          onChange={e => setFormData({ ...formData, notes: e.target.value })}
          className="w-full p-3 border-2 border-black font-bold focus:bg-yellow-50 outline-none min-h-[100px]"
          placeholder="Ex: Material muito sujo, cooperado ajudou na descarga..."
        />
      </div>

      <button
        type="submit"
        disabled={loading || !formData.material_type || !formData.quantity}
        className={`w-full cta-button justify-center py-6 text-xl ${
          loading || !formData.material_type || !formData.quantity ? "opacity-50 grayscale cursor-not-allowed" : "bg-primary"
        }`}
      >
        {loading ? <Loader2 className="animate-spin" /> : "REGISTRAR RECEBIMENTO"}
      </button>

      {formData.condition === 'rejected' && (
        <div className="p-4 border-4 border-red-500 bg-red-50 flex gap-3 items-start animate-slide-up">
          <AlertTriangle className="text-red-500 shrink-0" />
          <p className="text-sm font-bold text-red-900">
            Atenção: Oriente o cidadão sobre por que o material foi rejeitado e como descartá-lo corretamente.
          </p>
        </div>
      )}
    </form>
  )
}
