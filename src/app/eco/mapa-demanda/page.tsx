import { getDemandRollup } from "@/lib/eco/demand"
import Link from "next/link"
import { BarChart3, Map, Users, Target, Info } from "lucide-react"

export default async function MapaDemandaPublicoPage({
  searchParams
}: {
  searchParams: Promise<{ bairro?: string }>
}) {
  const { bairro } = await searchParams
  
  // Pass filter if provided
  const rollups = await getDemandRollup(bairro ? { neighborhood: bairro } : undefined)

  // Aggregate metrics
  const totalDemands = rollups.reduce((acc, curr) => acc + curr.total_demands, 0)
  const totalPevs = rollups.reduce((acc, curr) => acc + curr.possible_pevs, 0)
  const totalPickups = rollups.reduce((acc, curr) => acc + curr.pickup_interest, 0)
  
  // Group by Neighborhood
  const byNeighborhood = rollups.reduce((acc, curr) => {
    if (!acc[curr.neighborhood]) {
      acc[curr.neighborhood] = { total: 0, pevs: 0, pickups: 0, materials: new Set<string>() }
    }
    acc[curr.neighborhood].total += curr.total_demands
    acc[curr.neighborhood].pevs += curr.possible_pevs
    acc[curr.neighborhood].pickups += curr.pickup_interest
    acc[curr.neighborhood].materials.add(curr.material_type)
    return acc
  }, {} as Record<string, { total: number, pevs: number, pickups: number, materials: Set<string> }>)

  const neighborhoodsSorted = Object.entries(byNeighborhood)
    .sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 space-y-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-4 border-black pb-4">
          <div className="space-y-2">
            <h1 className="stencil-text text-4xl text-green-800">MAPA DA DEMANDA</h1>
            <p className="text-sm font-black uppercase text-gray-600">Volta Redonda — Visão Geral</p>
          </div>
          <Link href="/eco/reciclar" className="bg-black text-white px-6 py-3 font-black uppercase text-sm hover:bg-gray-800 transition-colors">
            Cadastrar Local
          </Link>
        </div>

        {/* Warning Policy */}
        <div className="bg-white border-4 border-dashed border-gray-300 p-4 flex gap-4 items-start text-gray-600">
           <Info className="shrink-0 mt-1" />
           <div>
             <p className="text-sm font-bold uppercase">Política de Privacidade</p>
             <p className="text-xs">
               Este mapa não é um ranking de competição e não exibe endereços exatos, nomes ou telefones. 
               É uma ferramenta de cuidado coletivo para orientar rotas, instalação de PEVs e educação ambiental.
             </p>
           </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-yellow-400 border-4 border-black p-6 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-xs font-black uppercase">Locais Mapeados</p>
              <Map size={24} />
            </div>
            <p className="text-4xl font-black">{totalDemands}</p>
          </div>
          <div className="bg-white border-4 border-black p-6 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-xs font-black uppercase text-gray-500">Pedidos de Coleta</p>
              <TruckIcon />
            </div>
            <p className="text-4xl font-black">{totalPickups}</p>
          </div>
          <div className="bg-green-500 text-black border-4 border-black p-6 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-xs font-black uppercase">Candidatos a PEV</p>
              <Target size={24} />
            </div>
            <p className="text-4xl font-black">{totalPevs}</p>
          </div>
        </div>

        {/* Action Steps */}
        <div className="border-4 border-black p-6 bg-white space-y-4">
          <h2 className="font-black uppercase text-xl">Como esse mapa vira ação?</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center text-xs font-bold uppercase">
             <div className="border-2 border-black p-2 bg-yellow-100">1. Cadastro</div>
             <div className="border-2 border-black p-2">2. Organização por bairro</div>
             <div className="border-2 border-black p-2">3. Contato com geradores</div>
             <div className="border-2 border-black p-2 bg-blue-100">4. Rota Piloto</div>
             <div className="border-2 border-black p-2 bg-green-100">5. PEV Experimental</div>
             <div className="border-2 border-black p-2 bg-black text-white">6. Transparência</div>
          </div>
        </div>

        {/* Neighborhood List */}
        <div className="space-y-4">
          <h2 className="font-black uppercase text-xl flex items-center gap-2">
            <BarChart3 /> Ranking de Engajamento por Bairro
          </h2>
          
          {neighborhoodsSorted.length === 0 ? (
            <div className="bg-white border-4 border-black p-12 text-center">
              <p className="font-bold uppercase text-gray-500">Nenhum dado cadastrado ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {neighborhoodsSorted.map(([nb, data], i) => (
                <div key={nb} className="bg-white border-4 border-black p-4 flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-black text-white flex items-center justify-center font-black text-lg">
                      {i + 1}
                    </div>
                    <div>
                      <h3 className="font-black uppercase text-xl">{nb}</h3>
                      <p className="text-xs font-bold text-gray-500 uppercase">
                        {data.materials.size} tipos de materiais citados
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 text-center">
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-400">Total</p>
                      <p className="font-black text-lg">{data.total}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-400">Quer Coleta</p>
                      <p className="font-black text-lg text-blue-600">{data.pickups}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-400">Pode ser PEV</p>
                      <p className="font-black text-lg text-green-600">{data.pevs}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function TruckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="15" height="13" x="1" y="3" rx="1"/>
      <path d="M16 8h2a2 2 0 0 1 2 2v6h-4"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="15.5" cy="18.5" r="2.5"/>
    </svg>
  )
}
