"use client"

import { useState, useEffect } from "react"
import { getLotById, getLotCosts, createLotCost, PevLot, PevLotCost } from "@/lib/eco/pev"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Plus, Receipt, Trash2, Loader2 } from "lucide-react"
import Link from "next/link"

const COST_TYPES = [
  { val: 'transport', label: 'Transporte/Frete' },
  { val: 'fuel', label: 'Combustível' },
  { val: 'bags', label: 'Sacos/Big Bags' },
  { val: 'labels', label: 'Etiquetas/Identificação' },
  { val: 'carretos', label: 'Carretos Locais' },
  { val: 'maintenance', label: 'Manutenção' },
  { val: 'other', label: 'Outro' }
]

export default function CustosPage() {
  const { id } = useParams() as { id: string }
  const [lot, setLot] = useState<PevLot | null>(null)
  const [costs, setCosts] = useState<PevLotCost[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [formData, setFormData] = useState({
    cost_type: "transport" as PevLotCost['cost_type'],
    description: "",
    amount: "",
    paid_to_label: ""
  })

  useEffect(() => {
    Promise.all([getLotById(id), getLotCosts(id)]).then(([l, c]) => {
      setLot(l)
      setCosts(c)
      setLoading(false)
    })
  }, [id])

  async function handleAddCost(e: React.FormEvent) {
    e.preventDefault()
    if (!lot) return
    setAdding(true)
    try {
      const newCost = await createLotCost({
        cell_id: lot.cell_id,
        lot_id: id,
        cost_type: formData.cost_type,
        description: formData.description,
        amount: parseFloat(formData.amount) || 0,
        paid_to_label: formData.paid_to_label
      })
      setCosts([...costs, newCost])
      setFormData({ cost_type: "transport", description: "", amount: "", paid_to_label: "" })
    } catch (err) {
      console.error(err)
      alert("Erro ao adicionar custo")
    } finally {
      setAdding(false)
    }
  }

  if (loading) return <div className="p-12 text-center font-black uppercase">Carregando Custos...</div>

  const total = costs.reduce((sum, c) => sum + Number(c.amount), 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/eco/pev/lotes/${id}`} className="p-2 border-2 border-black hover:bg-gray-100">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="stencil-text text-3xl leading-none">CUSTOS DIRETOS</h1>
          <span className="text-xs font-black uppercase text-muted">LOTE: {lot?.code}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-2">
          <form onSubmit={handleAddCost} className="card border-4 sticky top-6">
            <h3 className="stencil-text text-lg mb-4 flex items-center gap-2">
              <Plus className="text-primary" /> NOVO CUSTO
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase mb-1">Tipo de Custo</label>
                <select
                  value={formData.cost_type || "transport"}
                  onChange={e => setFormData({ ...formData, cost_type: e.target.value as PevLotCost['cost_type'] })}
                  className="w-full p-2 border-2 border-black font-bold outline-none appearance-none bg-white"
                >
                  {COST_TYPES.map(t => (
                    <option key={t.val} value={t.val}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase mb-1">Descrição</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2 border-2 border-black font-bold outline-none focus:bg-yellow-50"
                  placeholder="Ex: Frete até o porto"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full p-3 border-4 border-black font-black text-xl outline-none focus:bg-yellow-50"
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase mb-1">Pago Para (Label/Nome)</label>
                <input
                  type="text"
                  value={formData.paid_to_label}
                  onChange={e => setFormData({ ...formData, paid_to_label: e.target.value })}
                  className="w-full p-2 border-2 border-black font-bold outline-none focus:bg-yellow-50"
                  placeholder="Ex: João Fretes"
                />
              </div>

              <button
                type="submit"
                disabled={adding || !formData.amount}
                className="w-full cta-button justify-center py-4 bg-primary"
              >
                {adding ? <Loader2 className="animate-spin" /> : "ADICIONAR CUSTO"}
              </button>
            </div>
          </form>
        </div>

        <div className="md:col-span-3 space-y-4">
          <div className="card bg-black text-white p-4">
             <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase opacity-60">Total de Custos</span>
                <span className="text-3xl font-black">R$ {total.toFixed(2)}</span>
             </div>
          </div>

          {costs.length === 0 ? (
            <div className="card border-dashed border-2 text-center py-12 text-muted">
              Nenhum custo registrado para este lote.
            </div>
          ) : (
            <div className="space-y-3">
              {costs.map(cost => (
                <div key={cost.id} className="card flex justify-between items-center p-4">
                   <div className="flex items-center gap-4">
                      <div className="p-2 bg-gray-100 border border-black">
                        <Receipt size={18} />
                      </div>
                      <div>
                        <div className="font-black text-sm uppercase">
                          {COST_TYPES.find(t => t.val === cost.cost_type)?.label}
                        </div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase">
                          {cost.description || 'Sem descrição'} • {cost.paid_to_label}
                        </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="text-right">
                         <div className="font-black">R$ {Number(cost.amount).toFixed(2)}</div>
                      </div>
                      <button className="text-gray-300 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                   </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="p-4 border-4 border-dashed border-gray-300 text-[10px] font-bold text-gray-500 uppercase leading-tight">
            Nota: Os custos diretos são reembolsados integralmente aos trabalhadores que os pagaram, 
            antes do cálculo do rateio do lucro líquido.
          </div>
        </div>
      </div>
    </div>
  )
}
