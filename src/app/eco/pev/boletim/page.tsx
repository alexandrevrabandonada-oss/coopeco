import { getPevMonthlyReport } from "@/lib/eco/pev-reports"
import { getPevs } from "@/lib/eco/pev"
import Link from "next/link"
import { ArrowRight, BarChart3, Download } from "lucide-react"

export default async function BoletimDashboardPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const currentDate = new Date()
  const targetMonth = month || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`

  // Fetch all PEVs to map names, and then fetch reports
  const pevs = await getPevs()
  const reports = await getPevMonthlyReport({ month: targetMonth })

  const totalEntries = reports.reduce((acc, curr) => acc + curr.total_entries, 0)
  const totalSoldLots = reports.reduce((acc, curr) => acc + curr.sold_lots, 0)
  const totalWeight = reports.reduce((acc, curr) => acc + curr.final_weight_kg_total, 0)
  const totalGross = reports.reduce((acc, curr) => acc + curr.gross_value_total, 0)
  const totalEcoFund = reports.reduce((acc, curr) => acc + curr.eco_fund_total, 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Boletim Mensal</h1>
          <p className="text-gray-600">Visão agregada de impacto e resultados operacionais.</p>
        </div>
        <div className="flex items-center gap-4">
          <form className="flex items-center gap-2">
            <input 
              type="month" 
              name="month" 
              defaultValue={targetMonth}
              className="px-3 py-2 border-2 border-black font-bold uppercase text-sm"
            />
            <button type="submit" className="px-4 py-2 bg-black text-white font-bold uppercase text-sm">
              Filtrar
            </button>
          </form>
        </div>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="border-4 border-black p-4 bg-yellow-400 text-black">
          <p className="text-xs font-black uppercase">Entradas Recebidas</p>
          <p className="text-3xl font-black">{totalEntries}</p>
        </div>
        <div className="border-4 border-black p-4 bg-white text-black">
          <p className="text-xs font-black uppercase">Lotes Vendidos</p>
          <p className="text-3xl font-black">{totalSoldLots}</p>
        </div>
        <div className="border-4 border-black p-4 bg-white text-black">
          <p className="text-xs font-black uppercase">Peso Total (Kg)</p>
          <p className="text-3xl font-black">{totalWeight.toLocaleString('pt-BR')}</p>
        </div>
        <div className="border-4 border-black p-4 bg-black text-white">
          <p className="text-xs font-black uppercase text-gray-300">Receita Bruta</p>
          <p className="text-3xl font-black">R$ {totalGross.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="border-4 border-black p-4 bg-green-500 text-black">
          <p className="text-xs font-black uppercase">Fundo ECO</p>
          <p className="text-3xl font-black">R$ {totalEcoFund.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* PEV List */}
      <div className="border-4 border-black bg-white overflow-hidden">
        <div className="bg-black text-white p-4 flex justify-between items-center">
          <h2 className="font-black uppercase flex items-center gap-2">
            <BarChart3 size={20} />
            Desempenho por PEV
          </h2>
          <a 
            href={`/api/eco/pev/export/public-summary?month=${targetMonth}`} 
            target="_blank" 
            rel="noreferrer"
            className="text-xs font-bold uppercase hover:underline flex items-center gap-1"
          >
            <Download size={14} />
            Exportar Geral (CSV)
          </a>
        </div>
        <div className="divide-y-4 divide-black">
          {pevs.map(pev => {
            const report = reports.find(r => r.pev_id === pev.id)
            return (
              <div key={pev.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <h3 className="font-bold text-lg">{pev.name}</h3>
                  <div className="flex gap-4 text-sm text-gray-600 mt-1">
                    <span>Entradas: {report?.total_entries || 0}</span>
                    <span>Vendas: R$ {(report?.gross_value_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <span>Transparência: {pev.public_transparency ? <span className="text-green-600 font-bold">ATIVA</span> : <span className="text-red-600 font-bold">INATIVA</span>}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Link href={`/eco/pev/${pev.id}/boletim?month=${targetMonth}`} className="flex items-center justify-center p-2 border-2 border-black hover:bg-black hover:text-white transition-colors">
                    <ArrowRight size={20} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
