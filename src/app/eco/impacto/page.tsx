export const dynamic = 'force-dynamic'
import { getCellMonthlyStats, getCellIdForUser } from "@/lib/eco/pev"
import { BarChart3, TrendingUp, Package, Leaf, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function ImpactoPage() {
  const cellId = await getCellIdForUser()
  
  if (!cellId) {
    return (
      <div className="p-12 text-center">
        <p className="font-black uppercase">Célula não identificada.</p>
      </div>
    )
  }

  const stats = await getCellMonthlyStats(cellId)

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/eco/pev" className="p-2 border-2 border-black hover:bg-gray-100">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="stencil-text text-3xl leading-none">IMPACTO MENSAL</h1>
          <span className="text-xs font-black uppercase text-muted">RESULTADOS CONSOLIDADOS DA CÉLULA</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-black text-white p-6 border-4">
           <Leaf className="text-primary mb-4" size={32} />
           <p className="text-xs font-black uppercase opacity-60">Peso Recuperado</p>
           <p className="text-4xl font-black">{stats.totalKg.toFixed(1)} <span className="text-sm">KG</span></p>
        </div>
        <div className="card bg-primary p-6 border-4 border-black">
           <TrendingUp className="mb-4" size={32} />
           <p className="text-xs font-black uppercase opacity-60">Receita Gerada</p>
           <p className="text-4xl font-black">R$ {stats.totalGross.toFixed(0)}</p>
        </div>
        <div className="card p-6 border-4 border-black">
           <BarChart3 className="text-blue-600 mb-4" size={32} />
           <p className="text-xs font-black uppercase opacity-60">Lotes Movimentados</p>
           <p className="text-4xl font-black">{stats.lotCount}</p>
        </div>
        <div className="card bg-green-50 p-6 border-4 border-green-600">
           <div className="bg-green-600 text-white w-8 h-8 flex items-center justify-center rounded-full mb-4 font-black">F</div>
           <p className="text-xs font-black uppercase text-green-800 opacity-60">Fundo ECO</p>
           <p className="text-4xl font-black text-green-700">R$ {stats.totalFund.toFixed(0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="p-8 border-4 border-black bg-white space-y-6">
           <h3 className="stencil-text text-xl">SOBRE O FUNDO ECO</h3>
           <p className="text-sm font-bold text-gray-600 leading-relaxed uppercase">
             O Fundo ECO é composto por 10% do resultado líquido de cada lote. 
             Esse valor é destinado para a expansão da rede, manutenção dos PEVs 
             e fundos de reserva para a cooperativa.
           </p>
           <div className="p-4 bg-gray-100 border-2 border-black border-dashed">
              <p className="text-[10px] font-black uppercase italic">
                “Nossa meta é a sustentabilidade econômica total da operação circular.”
              </p>
           </div>
        </div>

        <div className="p-8 border-4 border-black bg-yellow-400">
           <h3 className="stencil-text text-xl mb-4">MÉTRICAS COLETIVAS</h3>
           <div className="space-y-4">
              <div className="flex justify-between border-b border-black pb-2">
                 <span className="text-xs font-black uppercase">Emissões de CO2 evitadas</span>
                 <span className="font-black">~ {(stats.totalKg * 1.5).toFixed(1)} KG</span>
              </div>
              <div className="flex justify-between border-b border-black pb-2">
                 <span className="text-xs font-black uppercase">Famílias Impactadas</span>
                 <span className="font-black">{Math.ceil(stats.totalKg / 50)}</span>
              </div>
              <div className="flex justify-between border-b border-black pb-2">
                 <span className="text-xs font-black uppercase">Eficiência Logística</span>
                 <span className="font-black">{(stats.totalKg / Math.max(1, stats.lotCount)).toFixed(0)} KG/LOTE</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
