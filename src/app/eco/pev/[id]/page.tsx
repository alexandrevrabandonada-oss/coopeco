export const dynamic = 'force-dynamic'
import { getPevById, getPevEntries, getOpenLot } from "@/lib/eco/pev"
import Link from "next/link"
import { ArrowLeft, PlusCircle, Layers, Calendar, MapPin, CheckCircle2 } from "lucide-react"

export default async function PevDetail({ params }: { params: { id: string } }) {
  const { id } = await params
  const pev = await getPevById(id)
  const entries = await getPevEntries(id, 5)
  const openLot = await getOpenLot(id)

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/eco/pev" className="p-2 border-2 border-black hover:bg-gray-100">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="stencil-text text-3xl leading-none">{pev.name}</h1>
          <span className="text-xs font-black uppercase text-muted">{pev.neighborhood}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card border-4">
          <h3 className="stencil-text text-xl mb-4 flex items-center gap-2">
            <PlusCircle className="text-primary" /> AÇÕES RÁPIDAS
          </h3>
          <div className="grid grid-cols-1 gap-3">
            <Link 
              href={`/eco/pev/${id}/receber`} 
              className="cta-button bg-primary justify-between py-6 group"
            >
              REGISTRAR RECEBIMENTO
              <PlusCircle className="group-hover:rotate-90 transition-transform" />
            </Link>
            <Link 
              href={`/eco/pev/${id}/lotes`} 
              className="cta-button bg-white justify-between py-6"
            >
              GERENCIAR LOTES
              <Layers />
            </Link>
          </div>
        </div>

        <div className="card border-4 bg-black text-white">
          <h3 className="stencil-text text-xl mb-4 text-primary">STATUS ATUAL</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <span className="text-xs font-black uppercase text-gray-400">Lote Aberto</span>
              <span className="font-bold">{openLot ? openLot.code : 'NENHUM'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <span className="text-xs font-black uppercase text-gray-400">Entradas Hoje</span>
              <span className="font-bold text-primary">--</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-black uppercase text-gray-400">Volume Total</span>
              <span className="font-bold">--</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="stencil-text text-xl mb-6">ÚLTIMOS RECEBIMENTOS</h3>
        {entries.length === 0 ? (
          <div className="text-center py-8 text-muted">
            Nenhum recebimento registrado ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map(entry => (
              <div key={entry.id} className="flex items-center gap-4 p-4 border-2 border-black bg-white hover:bg-yellow-50 transition-colors">
                <div className="w-12 h-12 bg-gray-100 border-2 border-black flex items-center justify-center font-black uppercase text-[10px] text-center p-1">
                  {entry.material_type.substring(0, 3)}
                </div>
                <div className="flex-1">
                  <div className="font-black uppercase text-sm">{entry.material_type}</div>
                  <div className="text-xs text-gray-500 font-bold">{new Date(entry.received_at).toLocaleString('pt-BR')}</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-lg">{entry.quantity} {entry.unit}</div>
                  <div className="text-[10px] font-black uppercase text-green-600 flex items-center justify-end gap-1">
                    <CheckCircle2 size={10} /> {entry.condition}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-6">
           <Link href={`/eco/pev/${id}/lotes`} className="text-sm font-black uppercase flex items-center gap-2 hover:underline">
             VER HISTÓRICO COMPLETO <ArrowLeft size={14} className="rotate-180" />
           </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
           <h3 className="stencil-text text-lg mb-4 flex items-center gap-2"><MapPin size={18}/> LOCALIZAÇÃO</h3>
           <p className="font-bold">{pev.address_text || 'Endereço não cadastrado'}</p>
           <p className="text-sm text-muted">{pev.neighborhood} - {pev.city}, {pev.state}</p>
        </div>
        <div className="card">
           <h3 className="stencil-text text-lg mb-4 flex items-center gap-2"><Calendar size={18}/> MATERIAIS ACEITOS</h3>
           <div className="flex flex-wrap gap-2">
              {pev.accepted_materials.map(m => (
                <span key={m} className="px-2 py-1 bg-yellow-100 border border-black text-[10px] font-black uppercase">{m}</span>
              ))}
           </div>
        </div>
      </div>
    </div>
  )
}
