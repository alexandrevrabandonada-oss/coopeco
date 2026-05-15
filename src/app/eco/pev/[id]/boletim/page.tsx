import { getPevMonthlyReport, getPevMaterialMonthlyReport } from "@/lib/eco/pev-reports"
import { getPevById } from "@/lib/eco/pev"
import Link from "next/link"
import { ArrowLeft, Download, FileText, Globe, AlertTriangle } from "lucide-react"

export default async function PevBoletimDetalhePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const { id } = await params
  const { month } = await searchParams
  
  const currentDate = new Date()
  const targetMonth = month || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`

  const pev = await getPevById(id)
  const [report] = await getPevMonthlyReport({ pevId: id, month: targetMonth })
  const materials = await getPevMaterialMonthlyReport({ pevId: id, month: targetMonth })

  const hasData = !!report
  const r = report || {
    total_entries: 0, accepted_entries: 0, rejected_entries: 0,
    total_lots: 0, open_lots: 0, closed_lots: 0, sold_lots: 0, paid_lots: 0,
    gross_value_total: 0, direct_costs_total: 0, eco_fund_total: 0, distributable_total: 0, final_weight_kg_total: 0
  }

  // Alertas operacionais simples
  const alerts = []
  if (r.rejected_entries > r.total_entries * 0.2) {
    alerts.push("Taxa de rejeição acima de 20%. Necessário reforçar educação.")
  }
  if (r.direct_costs_total > r.gross_value_total * 0.5 && r.gross_value_total > 0) {
    alerts.push("Custos diretos superam 50% da receita. Atenção à margem.")
  }

  const boletimText = `BOLETIM PEV ECO — ${targetMonth}\n\nNeste mês, o PEV ECO ${pev.name} recebeu ${r.total_entries} registros de materiais recicláveis, organizou ${r.total_lots} lotes e encaminhou ${r.sold_lots} lotes para destinação responsável.\n\nResumo financeiro agregado:\n- Receita bruta: R$ ${r.gross_value_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n- Custos operacionais: R$ ${r.direct_costs_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n- Fundo ECO para expansão: R$ ${r.eco_fund_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\nO Fundo ECO é usado para manter e expandir a operação.\n\nRecibo é lei. Cuidado é coletivo. Trabalho digno é o centro.`

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/eco/pev/boletim" className="p-2 border-2 border-black hover:bg-black hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Boletim: {pev.name}</h1>
          <p className="text-gray-600">Referência: {targetMonth}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {pev.public_transparency && (
          <a href={`/t/pev/${pev.slug}?month=${targetMonth}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 border-2 border-black font-bold uppercase text-sm hover:bg-gray-100">
            <Globe size={18} />
            Ver Página Pública
          </a>
        )}
        <Link href={`/eco/pev/${id}`} className="flex items-center gap-2 px-4 py-2 border-2 border-black font-bold uppercase text-sm hover:bg-gray-100">
          Voltar ao PEV
        </Link>
        <a href={`/api/eco/pev/export/finance?pevId=${id}&month=${targetMonth}`} className="flex items-center gap-2 px-4 py-2 bg-black text-white font-bold uppercase text-sm hover:bg-gray-800 ml-auto">
          <Download size={18} />
          Exportar CSV
        </a>
      </div>

      {alerts.length > 0 && (
        <div className="border-4 border-red-500 bg-red-50 p-4 space-y-2">
          <h3 className="font-black uppercase text-red-600 flex items-center gap-2">
            <AlertTriangle size={18} /> Alertas Operacionais
          </h3>
          <ul className="list-disc list-inside text-sm font-bold text-red-800">
            {alerts.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      {!hasData && (
        <div className="border-4 border-dashed border-gray-300 p-12 text-center text-gray-500 font-bold uppercase">
          Nenhum dado registrado para este mês.
        </div>
      )}

      {hasData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="border-4 border-black bg-white p-6">
              <h3 className="font-black uppercase text-lg border-b-2 border-black pb-2 mb-4">Métricas de Volume</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-black uppercase text-gray-500">Total Entradas</p>
                  <p className="text-2xl font-black">{r.total_entries}</p>
                  <p className="text-xs font-bold text-green-600">{r.accepted_entries} aceitas</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-gray-500">Lotes Vendidos</p>
                  <p className="text-2xl font-black">{r.sold_lots}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-gray-500">Peso Final (Kg)</p>
                  <p className="text-2xl font-black">{r.final_weight_kg_total.toLocaleString('pt-BR')}</p>
                </div>
              </div>
            </div>

            <div className="border-4 border-black bg-white p-6">
              <h3 className="font-black uppercase text-lg border-b-2 border-black pb-2 mb-4">Financeiro Agregado</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-black uppercase text-gray-500">Receita Bruta</p>
                  <p className="text-2xl font-black text-green-700">R$ {r.gross_value_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-gray-500">Custos Diretos</p>
                  <p className="text-2xl font-black text-red-600">R$ {r.direct_costs_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-gray-500">Fundo ECO</p>
                  <p className="text-2xl font-black text-blue-600">R$ {r.eco_fund_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-gray-500">Valor Distribuível</p>
                  <p className="text-2xl font-black">R$ {r.distributable_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>

            <div className="border-4 border-black bg-white p-6">
              <h3 className="font-black uppercase text-lg border-b-2 border-black pb-2 mb-4">Materiais do Mês</h3>
              <div className="space-y-2">
                {materials.map((m, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                    <span className="font-bold uppercase">{m.material_type}</span>
                    <span className="font-mono">{m.total_quantity} {m.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border-4 border-black bg-yellow-400 p-6 space-y-4">
              <h3 className="font-black uppercase flex items-center gap-2">
                <FileText size={20} /> Texto do Boletim
              </h3>
              <textarea 
                readOnly
                className="w-full h-64 p-3 font-mono text-sm border-2 border-black focus:outline-none resize-none"
                value={boletimText}
              />
              <button 
                className="w-full py-2 bg-black text-white font-bold uppercase hover:bg-gray-800 transition-colors"
                // On client side we'd use a clipboard copy, but we can't easily inline it in RSC without "use client" wrapper.
                // For MVP, the user can just copy from textarea.
              >
                Copiar Texto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
