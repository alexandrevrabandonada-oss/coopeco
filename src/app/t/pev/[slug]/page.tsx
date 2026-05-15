import { getPevPublicMonthlyReport } from "@/lib/eco/pev-reports"
import { getPevBySlug } from "@/lib/eco/pev"
import { MapPin, CheckCircle2 } from "lucide-react"

export default async function PublicTransparencyPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const { slug } = await params
  const { month } = await searchParams

  const currentDate = new Date()
  const targetMonth = month || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`

  try {
    const pev = await getPevBySlug(slug)

    // Check if the site is publicly visible
    if (!pev.public_transparency) {
      return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-8 text-center space-y-4">
           <h1 className="stencil-text text-4xl opacity-20">INDISPONÍVEL</h1>
           <p className="font-black uppercase">Este PEV ainda não publicou transparência pública.</p>
        </div>
      )
    }

    const [report] = await getPevPublicMonthlyReport({ pevSlug: slug, month: targetMonth })

    const hasData = !!report
    const r = report || {
      total_entries: 0, accepted_entries: 0, sold_lots: 0,
      gross_value_total: 0, eco_fund_total: 0, final_weight_kg_total: 0
    }

    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4 space-y-12">
        <div className="max-w-md mx-auto text-center space-y-2">
           <h1 className="stencil-text text-4xl">TRANSPARÊNCIA ECO</h1>
           <p className="text-xs font-black uppercase text-gray-500">Boletim Público Mensal</p>
           <p className="font-bold">{targetMonth}</p>
        </div>

        <div className="max-w-md mx-auto space-y-6">
           <div className="card bg-white border-4 p-6 space-y-4">
              <h3 className="font-black uppercase text-sm border-b-2 border-black pb-2">Informações do Local</h3>
              <div className="flex items-start gap-3">
                 <MapPin className="text-primary shrink-0" size={18} />
                 <p className="text-xs font-bold uppercase">{pev.name} - {pev.neighborhood}, {pev.city}</p>
              </div>
              <div className="flex items-center gap-3">
                 <CheckCircle2 className="text-green-600 shrink-0" size={18} />
                 <p className="text-xs font-bold uppercase">Ponto Verificado e Ativo</p>
              </div>
           </div>

           {!hasData ? (
             <div className="text-center p-6 border-4 border-dashed border-gray-300">
                <p className="text-sm font-black uppercase text-gray-500">
                  Sem dados registrados ou consolidados neste mês.
                </p>
             </div>
           ) : (
             <div className="grid grid-cols-2 gap-4">
               <div className="border-4 border-black p-4 bg-yellow-400 text-black">
                 <p className="text-[10px] font-black uppercase text-black/70">Entradas</p>
                 <p className="text-2xl font-black">{r.accepted_entries}</p>
               </div>
               <div className="border-4 border-black p-4 bg-white text-black">
                 <p className="text-[10px] font-black uppercase text-gray-500">Lotes Vendidos</p>
                 <p className="text-2xl font-black">{r.sold_lots}</p>
               </div>
               <div className="border-4 border-black p-4 bg-black text-white col-span-2">
                 <p className="text-[10px] font-black uppercase text-gray-400">Receita Bruta Gerada</p>
                 <p className="text-3xl font-black">R$ {r.gross_value_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
               </div>
               <div className="border-4 border-black p-4 bg-green-500 text-black col-span-2">
                 <p className="text-[10px] font-black uppercase text-black/70">Fundo ECO (Reinvestimento)</p>
                 <p className="text-3xl font-black">R$ {r.eco_fund_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
               </div>
             </div>
           )}

           <div className="text-center p-6 border-4 border-dashed border-gray-300 space-y-4">
              <p className="text-[10px] font-black uppercase text-gray-400">
                Dados agregados, sem exposição de pessoas.
              </p>
              <p className="text-xs font-black uppercase">
                Recibo é lei. Cuidado é coletivo. Trabalho digno é o centro.
              </p>
           </div>
        </div>
      </div>
    )
  } catch (err) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-4">
         <h1 className="stencil-text text-4xl opacity-20">404</h1>
         <p className="font-black uppercase">PEV não encontrado ou inativo.</p>
      </div>
    )
  }
}
