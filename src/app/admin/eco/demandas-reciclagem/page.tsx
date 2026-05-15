import { getAdminDemands, calculateDemandPriorityScore } from "@/lib/eco/demand"
import { ClipboardList, Filter, MapPin, Truck, Target, Phone, ChevronRight } from "lucide-react"
import Link from "next/link"

export default async function AdminDemandasReciclagemPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  
  const demandsRaw = await getAdminDemands({ status })
  
  // Apply auto-priority if not set in DB
  const demands = demandsRaw.map(d => {
    if (!d.priority || d.priority === 'normal') {
       const { priority, score } = calculateDemandPriorityScore(d)
       return { ...d, _auto_priority: priority, _score: score }
    }
    return { ...d, _auto_priority: d.priority, _score: -1 }
  })

  // Kanban groupings
  const colNew = demands.filter(d => d.status === 'new' || !d.status)
  const colTriaged = demands.filter(d => d.status === 'triaged')
  const colContacted = demands.filter(d => d.status === 'contacted')
  const colConverted = demands.filter(d => d.status?.startsWith('converted'))
  const colArchived = demands.filter(d => d.status === 'archived')

  const DemandCard = ({ d }: { d: any }) => (
    <div className="bg-white border-2 border-black p-3 hover:bg-gray-50 flex flex-col justify-between min-h-[140px]">
      <div className="space-y-1">
        <div className="flex justify-between items-start gap-2">
          <span className="font-black uppercase text-sm truncate">{d.neighborhood}</span>
          {d._auto_priority === 'urgent' && <span className="bg-red-600 text-white px-1 text-[10px] font-black uppercase">URGENTE</span>}
          {d._auto_priority === 'high' && <span className="bg-orange-500 text-white px-1 text-[10px] font-black uppercase">ALTA</span>}
        </div>
        <p className="text-[10px] font-bold text-gray-500 uppercase">{d.participant_type} • Vol: {d.volume_level}</p>
        <p className="text-[10px] text-gray-600 line-clamp-1">{d.material_types.join(', ')}</p>
        
        <div className="flex gap-1 pt-1">
          {d.preference === 'pickup_request' && <Truck size={14} className="text-blue-600" />}
          {d.can_be_pev && <Target size={14} className="text-green-600" />}
          {d.consent_contact && <Phone size={14} className="text-gray-400" />}
        </div>
      </div>
      
      <div className="mt-3">
        <Link href={`/admin/eco/demandas-reciclagem/${d.id}`} className="flex items-center justify-center gap-1 w-full bg-black text-white px-2 py-1 text-[10px] font-black uppercase hover:bg-gray-800">
          Detalhes <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 h-screen flex flex-col overflow-hidden py-4 px-4">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Caminho da Demanda</h1>
          <p className="text-gray-600 font-bold">Transforme cadastros em rota, PEV e orientação comunitária.</p>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        <div className="border-4 border-black p-3 bg-yellow-400 text-black">
          <p className="text-[10px] font-black uppercase">Novas (Fila)</p>
          <p className="text-2xl font-black">{colNew.length}</p>
        </div>
        <div className="border-4 border-black p-3 bg-white text-black">
          <p className="text-[10px] font-black uppercase text-red-600">Prioridade Alta+</p>
          <p className="text-2xl font-black">{demands.filter(d => d._auto_priority === 'high' || d._auto_priority === 'urgent').length}</p>
        </div>
        <div className="border-4 border-black p-3 bg-white text-black">
          <p className="text-[10px] font-black uppercase">Candidatos a Rota</p>
          <p className="text-2xl font-black">{demands.filter(d => d.preference === 'pickup_request' || d.preference === 'both').length}</p>
        </div>
        <div className="border-4 border-black p-3 bg-green-500 text-black">
          <p className="text-[10px] font-black uppercase">Candidatos a PEV</p>
          <p className="text-2xl font-black">{demands.filter(d => d.can_be_pev).length}</p>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 h-full">
        
        {/* Col: Novas */}
        <div className="flex-shrink-0 w-72 bg-gray-100 border-4 border-black flex flex-col">
          <div className="bg-black text-white p-2 font-black uppercase text-sm border-b-4 border-black flex justify-between">
            <span>1. Fila de Entrada</span>
            <span className="bg-white text-black px-1">{colNew.length}</span>
          </div>
          <div className="p-2 space-y-2 overflow-y-auto flex-1">
            {colNew.map(d => <DemandCard key={d.id} d={d} />)}
          </div>
        </div>

        {/* Col: Em Triagem */}
        <div className="flex-shrink-0 w-72 bg-gray-100 border-4 border-black flex flex-col">
          <div className="bg-gray-200 text-black p-2 font-black uppercase text-sm border-b-4 border-black flex justify-between">
            <span>2. Triadas</span>
            <span className="bg-black text-white px-1">{colTriaged.length}</span>
          </div>
          <div className="p-2 space-y-2 overflow-y-auto flex-1">
            {colTriaged.map(d => <DemandCard key={d.id} d={d} />)}
          </div>
        </div>

        {/* Col: Contatadas */}
        <div className="flex-shrink-0 w-72 bg-gray-100 border-4 border-black flex flex-col">
          <div className="bg-blue-200 text-black p-2 font-black uppercase text-sm border-b-4 border-black flex justify-between">
            <span>3. Contatadas</span>
            <span className="bg-black text-white px-1">{colContacted.length}</span>
          </div>
          <div className="p-2 space-y-2 overflow-y-auto flex-1">
            {colContacted.map(d => <DemandCard key={d.id} d={d} />)}
          </div>
        </div>

        {/* Col: Convertidas */}
        <div className="flex-shrink-0 w-72 bg-gray-100 border-4 border-black flex flex-col">
          <div className="bg-green-300 text-black p-2 font-black uppercase text-sm border-b-4 border-black flex justify-between">
            <span>4. Rota / PEV</span>
            <span className="bg-black text-white px-1">{colConverted.length}</span>
          </div>
          <div className="p-2 space-y-2 overflow-y-auto flex-1">
            {colConverted.map(d => <DemandCard key={d.id} d={d} />)}
          </div>
        </div>

      </div>
    </div>
  )
}
