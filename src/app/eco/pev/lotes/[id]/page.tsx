import { getLotById, getLotCosts, getWorkLogs, getLotEntries } from "@/lib/eco/pev"
import Link from "next/link"
import { ArrowLeft, DollarSign, Hammer, Receipt, Layers, TrendingUp, ChevronRight, CheckCircle2 } from "lucide-react"
import { LotFinanceCard } from "@/components/eco/LotFinanceCard"

export default async function LotDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params
  const lot = await getLotById(id)
  const entries = await getLotEntries(id)
  const costs = await getLotCosts(id)
  const workLogs = await getWorkLogs(id)

  const totalQty = entries.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0)

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/eco/pev/${lot.pev_id}/lotes`} className="p-2 border-2 border-black hover:bg-gray-100">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="stencil-text text-3xl leading-none">LOTE {lot.code}</h1>
          <span className="text-xs font-black uppercase text-muted">PEV: {lot.pev.name}</span>
        </div>
        <div className="ml-auto">
          <span className="px-3 py-1 text-xs font-black uppercase border-2 border-black bg-white">
            {lot.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <LotFinanceCard lot={lot} />

          <div className="card">
            <h3 className="stencil-text text-lg mb-4 flex items-center gap-2">
              <Layers size={18} className="text-primary" /> CONTEÚDO DO LOTE
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
               <div className="p-3 border-2 border-black bg-gray-50">
                  <p className="text-[10px] font-black uppercase opacity-60">Entradas</p>
                  <p className="text-xl font-black">{entries.length}</p>
               </div>
               <div className="p-3 border-2 border-black bg-gray-50">
                  <p className="text-[10px] font-black uppercase opacity-60">Qtd Total</p>
                  <p className="text-xl font-black">{totalQty.toFixed(1)}</p>
               </div>
               <div className="p-3 border-2 border-black bg-gray-50">
                  <p className="text-[10px] font-black uppercase opacity-60">Custos</p>
                  <p className="text-xl font-black">{costs.length}</p>
               </div>
               <div className="p-3 border-2 border-black bg-gray-50">
                  <p className="text-[10px] font-black uppercase opacity-60">Trabalho</p>
                  <p className="text-xl font-black">{workLogs.length} reg.</p>
               </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card border-4">
            <h3 className="stencil-text text-sm mb-4 uppercase">AÇÕES DO LOTE</h3>
            <div className="grid grid-cols-1 gap-3">
              <Link 
                href={`/eco/pev/lotes/${id}/venda`} 
                className={`cta-button text-xs py-3 justify-between ${lot.gross_value ? 'bg-green-100' : 'bg-primary'}`}
              >
                {lot.gross_value ? 'ATUALIZAR VENDA' : 'REGISTRAR VENDA'} <DollarSign size={16} />
              </Link>
              <Link href={`/eco/pev/lotes/${id}/custos`} className="cta-button text-xs py-3 justify-between bg-white">
                CUSTOS DIRETOS <Receipt size={16} />
              </Link>
              <Link href={`/eco/pev/lotes/${id}/trabalho`} className="cta-button text-xs py-3 justify-between bg-white">
                REGISTRAR TRABALHO <Hammer size={16} />
              </Link>
              <Link 
                href={`/eco/pev/lotes/${id}/rateio`} 
                className="cta-button text-xs py-3 justify-between bg-black text-white"
              >
                CÁLCULO DE RATEIO <TrendingUp size={16} />
              </Link>
              <a 
                href={`/eco/pev/lotes/${id}/export`} 
                download
                className="cta-button text-xs py-3 justify-between bg-gray-100"
              >
                EXPORTAR CSV <Receipt size={16} />
              </a>
            </div>
          </div>

          {lot.payout_status && lot.payout_status !== 'draft' && (
            <div className="card bg-green-50 border-green-500">
               <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <span className="text-[10px] font-black uppercase">Rateio {lot.payout_status}</span>
               </div>
               <Link href={`/eco/pev/lotes/${id}/rateio`} className="text-xs font-bold underline flex items-center gap-1">
                 Ver detalhes do pagamento <ChevronRight size={12} />
               </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
