"use client"

import { useState, useEffect } from "react"
import { 
  getLotById, 
  getLotPayouts, 
  recalculateAndPersistPevLotPayout, 
  approvePayout, 
  markPaid, 
  PevLot, 
  PevPayout 
} from "@/lib/eco/pev"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, TrendingUp, CheckCircle2, DollarSign, Calculator, Loader2, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { LotFinanceCard } from "@/components/eco/LotFinanceCard"
import { PayoutTable } from "@/components/eco/PayoutTable"

export default function RateioPage() {
  const router = useRouter()
  const { id } = useParams() as { id: string }
  const [lot, setLot] = useState<PevLot | null>(null)
  const [payouts, setPayouts] = useState<PevPayout[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    try {
      const [l, p] = await Promise.all([getLotById(id), getLotPayouts(id)])
      setLot(l)
      setPayouts(p)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCalculate() {
    if (!lot?.gross_value) {
      alert("Registre a venda do lote antes de calcular o rateio.")
      return
    }
    setActionLoading(true)
    try {
      await recalculateAndPersistPevLotPayout(id)
      await load()
    } catch (err) {
      console.error(err)
      alert("Erro ao calcular rateio")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleApprove() {
    setActionLoading(true)
    try {
      await approvePayout(id)
      await load()
    } catch (err) {
      console.error(err)
      alert("Erro ao aprovar")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleMarkPaid() {
    if (!confirm("Confirmar que todos os pagamentos deste lote foram realizados?")) return
    setActionLoading(true)
    try {
      await markPaid(id)
      await load()
    } catch (err) {
      console.error(err)
      alert("Erro ao marcar como pago")
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div className="p-12 text-center font-black uppercase">Carregando Rateio...</div>

  const hasLowHourlyValue = payouts.some(p => (p.effective_hourly_value || 0) < 5) // Exemplo: < R$ 5/h

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/eco/pev/lotes/${id}`} className="p-2 border-2 border-black hover:bg-gray-100">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="stencil-text text-3xl leading-none">CÁLCULO DE RATEIO</h1>
          <span className="text-xs font-black uppercase text-muted">LOTE: {lot?.code}</span>
        </div>
        <div className="ml-auto">
          <span className={`px-3 py-1 text-xs font-black uppercase border-2 border-black ${
            lot?.payout_status === 'paid' ? 'bg-green-500 text-white' : 'bg-yellow-400'
          }`}>
            STATUS: {lot?.payout_status}
          </span>
        </div>
      </div>

      {!lot?.gross_value && (
        <div className="card bg-red-50 border-red-500 flex flex-col items-center py-12">
           <AlertTriangle size={48} className="text-red-500 mb-4" />
           <p className="font-black text-red-900 uppercase">Venda não registrada</p>
           <p className="text-sm mb-6">Você precisa registrar a venda do lote para poder calcular o rateio.</p>
           <Link href={`/eco/pev/lotes/${id}/venda`} className="cta-button bg-black text-white">
             REGISTRAR VENDA AGORA
           </Link>
        </div>
      )}

      {lot?.gross_value && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <LotFinanceCard lot={lot} />
            
            <div className="card space-y-4">
              <h3 className="stencil-text text-lg uppercase">Ações Financeiras</h3>
              
              <button
                onClick={handleCalculate}
                disabled={actionLoading}
                className="w-full cta-button justify-between bg-black text-white"
              >
                {actionLoading ? <Loader2 className="animate-spin" /> : <>RECALCULAR RATEIO <Calculator size={18} /></>}
              </button>

              {lot.payout_status === 'calculated' && (
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="w-full cta-button justify-between bg-green-600 text-white"
                >
                  {actionLoading ? <Loader2 className="animate-spin" /> : <>APROVAR PARA PAGAMENTO <CheckCircle2 size={18} /></>}
                </button>
              )}

              {lot.payout_status === 'approved' && (
                <button
                  onClick={handleMarkPaid}
                  disabled={actionLoading}
                  className="w-full cta-button justify-between bg-primary"
                >
                  {actionLoading ? <Loader2 className="animate-spin" /> : <>MARCAR COMO PAGO <DollarSign size={18} /></>}
                </button>
              )}
            </div>
            
            {hasLowHourlyValue && (
               <div className="card bg-orange-50 border-orange-500 flex gap-3 p-4">
                  <AlertTriangle className="text-orange-600 shrink-0" size={20} />
                  <div>
                    <p className="text-xs font-black uppercase text-orange-900">Atenção: Ganho por hora baixo</p>
                    <p className="text-[10px] font-bold text-orange-800 uppercase">
                      Este lote resultou em um valor/hora abaixo do piso ideal. Considere revisar materiais ou logística para o próximo.
                    </p>
                  </div>
               </div>
            )}
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="stencil-text text-xl flex items-center gap-2">
                <TrendingUp className="text-primary" /> RESULTADO POR TRABALHADOR
              </h3>
            </div>
            
            <PayoutTable payouts={payouts} />
            
            <div className="p-4 border-4 border-black bg-gray-50 space-y-4">
               <h4 className="text-xs font-black uppercase border-b border-black pb-1">Regras de Rateio</h4>
               <ul className="space-y-2">
                  <li className="text-[10px] font-bold uppercase flex gap-2">
                    <div className="w-1.5 h-1.5 bg-black rounded-full mt-1 shrink-0" />
                    Custos diretos são devolvidos integralmente a quem pagou.
                  </li>
                  <li className="text-[10px] font-bold uppercase flex gap-2">
                    <div className="w-1.5 h-1.5 bg-black rounded-full mt-1 shrink-0" />
                    O lucro líquido (Venda - Custos - 10% Fundo ECO) é distribuído por pontos.
                  </li>
                  <li className="text-[10px] font-bold uppercase flex gap-2">
                    <div className="w-1.5 h-1.5 bg-black rounded-full mt-1 shrink-0" />
                    Pontos = Horas x Peso da tarefa (Triagem/Carga valem mais).
                  </li>
               </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
