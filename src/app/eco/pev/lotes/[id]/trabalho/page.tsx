"use client"

import { useState, useEffect } from "react"
import { getLotById, getWorkLogs, createWorkLog, PevLot, PevWorkLog, WORK_TYPE_WEIGHTS } from "@/lib/eco/pev"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Hammer, User, Clock, Star, Loader2, Info } from "lucide-react"
import Link from "next/link"

const WORK_TYPES = [
  { val: 'receiving', label: 'Recebimento' },
  { val: 'registering', label: 'Registro' },
  { val: 'sorting', label: 'Triagem' },
  { val: 'loading', label: 'Carga/descarga' },
  { val: 'transport_selling', label: 'Transporte/venda' },
  { val: 'coordination', label: 'Coordenação' },
  { val: 'other', label: 'Outro' }
]

export default function TrabalhoPage() {
  const { id } = useParams() as { id: string }
  const [lot, setLot] = useState<PevLot | null>(null)
  const [logs, setLogs] = useState<PevWorkLog[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [formData, setFormData] = useState({
    worker_label: "",
    work_type: "sorting" as PevWorkLog['work_type'],
    hours: "",
    notes: ""
  })

  useEffect(() => {
    Promise.all([getLotById(id), getWorkLogs(id)]).then(([l, w]) => {
      setLot(l)
      setLogs(w)
      setLoading(false)
    })
  }, [id])

  async function handleAddWork(e: React.FormEvent) {
    e.preventDefault()
    if (!lot) return
    setAdding(true)
    try {
      const weight = WORK_TYPE_WEIGHTS[formData.work_type as keyof typeof WORK_TYPE_WEIGHTS]
      const newLog = await createWorkLog({
        cell_id: lot.cell_id,
        lot_id: id,
        worker_label: formData.worker_label,
        work_type: formData.work_type,
        hours: parseFloat(formData.hours) || 0,
        weight: weight,
        notes: formData.notes
      })
      setLogs([...logs, newLog])
      setFormData({ ...formData, hours: "", notes: "" })
    } catch (err) {
      console.error(err)
      alert("Erro ao adicionar registro de trabalho")
    } finally {
      setAdding(false)
    }
  }

  if (loading) return <div className="p-12 text-center font-black uppercase">Carregando Trabalho...</div>

  const totalPoints = logs.reduce((sum, l) => sum + Number(l.points), 0)
  const totalHours = logs.reduce((sum, l) => sum + Number(l.hours), 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/eco/pev/lotes/${id}`} className="p-2 border-2 border-black hover:bg-gray-100">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="stencil-text text-3xl leading-none">LOG DE TRABALHO</h1>
          <span className="text-xs font-black uppercase text-muted">LOTE: {lot?.code}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-2">
          <form onSubmit={handleAddWork} className="card border-4 sticky top-6">
            <h3 className="stencil-text text-lg mb-4 flex items-center gap-2">
              <Hammer className="text-primary" /> REGISTRAR TRABALHO
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase mb-1">Trabalhador (Label/Apelido)</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData.worker_label}
                    onChange={e => setFormData({ ...formData, worker_label: e.target.value })}
                    className="w-full p-2 pl-10 border-2 border-black font-bold outline-none focus:bg-yellow-50"
                    placeholder="Ex: Operador A"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase mb-1">Tipo de Trabalho</label>
                <select
                  value={formData.work_type || "sorting"}
                  onChange={e => setFormData({ ...formData, work_type: e.target.value as PevWorkLog['work_type'] })}
                  className="w-full p-2 border-2 border-black font-bold outline-none appearance-none bg-white"
                >
                  {WORK_TYPES.map(t => (
                    <option key={t.val} value={t.val}>{t.label} (Peso {WORK_TYPE_WEIGHTS[t.val as keyof typeof WORK_TYPE_WEIGHTS]})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase mb-1">Horas Trabalhadas</label>
                <div className="relative">
                  <Clock size={16} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={formData.hours}
                    onChange={e => setFormData({ ...formData, hours: e.target.value })}
                    className="w-full p-2 pl-10 border-2 border-black font-black text-xl outline-none focus:bg-yellow-50"
                    placeholder="0.0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase mb-1">Notas (Opcional)</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2 border-2 border-black font-bold outline-none focus:bg-yellow-50"
                />
              </div>

              <button
                type="submit"
                disabled={adding || !formData.worker_label || !formData.hours}
                className="w-full cta-button justify-center py-4 bg-primary"
              >
                {adding ? <Loader2 className="animate-spin" /> : "REGISTRAR LOG"}
              </button>
            </div>
          </form>
        </div>

        <div className="md:col-span-3 space-y-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="card bg-black text-white p-4">
               <span className="text-[10px] font-black uppercase opacity-60">Horas Totais</span>
               <p className="text-2xl font-black">{totalHours.toFixed(1)}h</p>
            </div>
            <div className="card bg-primary p-4 border-black">
               <span className="text-[10px] font-black uppercase opacity-60">Pontos Totais</span>
               <p className="text-2xl font-black flex items-center gap-2">
                 <Star size={20} className="fill-black" /> {totalPoints.toFixed(1)}
               </p>
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="card border-dashed border-2 text-center py-12 text-muted">
              Nenhum log de trabalho registrado.
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="card flex justify-between items-center p-4">
                   <div className="flex items-center gap-4">
                      <div className="p-2 bg-yellow-100 border border-black rounded-full">
                        <User size={18} />
                      </div>
                      <div>
                        <div className="font-black text-sm uppercase">{log.worker_label}</div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase">
                          {WORK_TYPES.find(t => t.val === log.work_type)?.label} • {log.hours}h
                        </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="text-right">
                         <div className="font-black text-primary-dark">+{Number(log.points).toFixed(1)} pts</div>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          )}

          <div className="card bg-blue-50 border-blue-200 flex gap-3 items-start p-4">
            <Info className="text-blue-600 shrink-0 mt-0.5" size={16} />
            <p className="text-[10px] font-bold text-blue-900 uppercase leading-tight">
              A pontuação é calculada como: <strong>Horas × Peso da Tarefa</strong>. 
              Isso garante que tarefas mais pesadas ou complexas (como triagem e carga) 
              tenham uma participação maior no rateio final do lote.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
