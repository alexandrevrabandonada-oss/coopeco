"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createPev, getCellIdForUser } from "@/lib/eco/pev"
import { ArrowLeft, Save, Loader2, Info } from "lucide-react"
import Link from "next/link"

const MATERIALS = ["Papel/Papelão", "Plástico", "Metal", "Vidro", "Óleo", "Eletrônicos", "Rejeitos"]

export default function NovoPev() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [cellId, setCellId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    neighborhood: "",
    address_text: "",
    accepted_materials: [] as string[],
    status: "draft" as "draft" | "active"
  })

  useEffect(() => {
    getCellIdForUser().then(setCellId)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cellId) return alert("Célula não identificada")
    
    setLoading(true)
    try {
      const slug = formData.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-")
      const newPev = await createPev({
        ...formData,
        cell_id: cellId,
        slug: `${slug}-${Math.random().toString(36).substring(2, 6)}`
      })
      router.push(`/eco/pev/${newPev.id}`)
    } catch (err) {
      console.error(err)
      alert("Erro ao cadastrar PEV")
    } finally {
      setLoading(false)
    }
  }

  const toggleMaterial = (m: string) => {
    setFormData(prev => ({
      ...prev,
      accepted_materials: prev.accepted_materials.includes(m)
        ? prev.accepted_materials.filter(x => x !== m)
        : [...prev.accepted_materials, m]
    }))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/eco/pev" className="p-2 border-2 border-black hover:bg-gray-100">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="stencil-text text-3xl">NOVO PEV</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <label className="block text-sm font-black uppercase mb-2">Nome do Ponto</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="w-full p-4 border-4 border-black font-black text-xl outline-none focus:bg-yellow-50"
            placeholder="EX: ECOPONTO CENTRO"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <label className="block text-sm font-black uppercase mb-2">Bairro</label>
            <input
              type="text"
              required
              value={formData.neighborhood}
              onChange={e => setFormData({ ...formData, neighborhood: e.target.value })}
              className="w-full p-3 border-2 border-black font-bold outline-none focus:bg-yellow-50"
              placeholder="Ex: Vila Santa Cecília"
            />
          </div>
          <div className="card">
            <label className="block text-sm font-black uppercase mb-2">Status Inicial</label>
            <select
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value as "draft" | "active" })}
              className="w-full p-3 border-2 border-black font-bold outline-none appearance-none"
            >
              <option value="draft">Rascunho (Privado)</option>
              <option value="active">Ativo (Público)</option>
            </select>
          </div>
        </div>

        <div className="card">
          <label className="block text-sm font-black uppercase mb-2">Endereço / Referência</label>
          <input
            type="text"
            value={formData.address_text}
            onChange={e => setFormData({ ...formData, address_text: e.target.value })}
            className="w-full p-3 border-2 border-black font-bold outline-none focus:bg-yellow-50"
            placeholder="Rua, número, próximo ao mercado X..."
          />
        </div>

        <div className="card">
          <label className="block text-sm font-black uppercase mb-4">Materiais Aceitos</label>
          <div className="flex flex-wrap gap-2">
            {MATERIALS.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => toggleMaterial(m)}
                className={`px-4 py-2 border-2 text-xs font-black uppercase transition-all ${
                  formData.accepted_materials.includes(m)
                    ? "bg-primary border-black shadow-[3px_3px_0px_black] -translate-y-0.5"
                    : "bg-white border-gray-200 text-gray-400"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {!cellId && (
          <div className="p-4 border-4 border-yellow-500 bg-yellow-50 flex gap-3 items-center">
            <Info className="text-yellow-500" />
            <p className="text-xs font-bold uppercase">
              Aguardando identificação da sua célula para salvar...
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !cellId}
          className={`w-full cta-button justify-center py-6 text-2xl bg-primary ${
            loading || !cellId ? "opacity-50 grayscale cursor-not-allowed" : ""
          }`}
        >
          {loading ? <Loader2 className="animate-spin" /> : <>CADASTRAR <Save className="ml-2" /></>}
        </button>
      </form>
    </div>
  )
}
