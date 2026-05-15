export const dynamic = 'force-dynamic'
import { getPevs } from "@/lib/eco/pev"
import { PevCard } from "@/components/eco/PevCard"
import Link from "next/link"
import { Plus, DollarSign, Package, TrendingUp, Wallet } from "lucide-react"

export default async function PevDashboard() {
  const pevs = await getPevs()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="stencil-text text-4xl leading-none">PEV ECO</h1>
          <p className="text-muted font-bold text-xs uppercase">GESTÃO DE LOGÍSTICA E RESULTADO</p>
        </div>
        <div className="flex gap-2">
          <Link href="/eco/impacto" className="cta-button bg-white">
            <TrendingUp size={20} /> <span className="hidden sm:inline">IMPACTO</span>
          </Link>
          <Link href="/eco/pev/novo" className="cta-button bg-primary">
            <Plus size={20} /> <span className="hidden sm:inline">NOVO PEV</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card bg-black text-white p-4">
          <div className="flex items-center gap-3 mb-2">
            <Package className="text-primary" size={16} />
            <span className="text-[10px] font-black uppercase">PEVs Ativos</span>
          </div>
          <div className="text-2xl font-black">{pevs.filter(p => p.status === 'active').length}</div>
        </div>
        <div className="card bg-primary p-4 border-black">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign size={16} />
            <span className="text-[10px] font-black uppercase">Receita Bruta</span>
          </div>
          <div className="text-2xl font-black">R$ --</div>
        </div>
        <div className="card bg-white p-4">
          <div className="flex items-center gap-3 mb-2 text-primary-dark">
            <TrendingUp size={16} />
            <span className="text-[10px] font-black uppercase">Fundo ECO</span>
          </div>
          <div className="text-2xl font-black">R$ --</div>
        </div>
        <div className="card bg-gray-50 p-4">
          <div className="flex items-center gap-3 mb-2 text-red-600">
            <Wallet size={16} />
            <span className="text-[10px] font-black uppercase">Pgtos Pendentes</span>
          </div>
          <div className="text-2xl font-black">--</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="stencil-text text-2xl mb-4">PONTOS DE ENTREGA</h2>
          {pevs.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-muted mb-4">Nenhum PEV cadastrado para sua célula.</p>
              <Link href="/eco/pev/novo" className="cta-button inline-flex mx-auto bg-primary">
                CADASTRAR PRIMEIRO PEV
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {pevs.map(pev => (
                <PevCard key={pev.id} pev={pev} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card border-4 bg-yellow-50">
            <h3 className="stencil-text text-lg mb-4">LOGÍSTICA ATIVA</h3>
            <div className="space-y-3">
               {/* Placeholders for active lots across all PEVs */}
               <div className="text-[10px] font-bold text-gray-400 uppercase italic py-8 text-center">
                 Resumo de lotes abertos aparecerá aqui em tempo real.
               </div>
            </div>
          </div>

          <div className="p-6 border-4 border-dashed border-gray-300">
            <h3 className="font-black uppercase mb-2 text-xs">O QUE É O PEV ECO?</h3>
            <p className="text-[11px] text-gray-600 leading-relaxed uppercase font-bold">
              O Ponto de Entrega Voluntária (PEV) é o elo entre o cidadão e a economia circular. 
              Aqui registramos cada entrada de material limpo e separado, organizando o fluxo local 
              antes do envio para beneficiamento, com rateio justo e transparente entre os participantes.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
