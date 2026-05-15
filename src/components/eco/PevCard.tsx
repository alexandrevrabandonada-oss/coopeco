import { PevSite } from "@/lib/eco/pev"
import Link from "next/link"
import { MapPin, ArrowRight } from "lucide-react"

export function PevCard({ pev }: { pev: PevSite }) {
  return (
    <div className="card animate-slide-up">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="stencil-text text-xl mb-1">{pev.name}</h3>
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <MapPin size={14} />
            <span>{pev.neighborhood}</span>
          </div>
        </div>
        <span className={`px-2 py-1 text-xs font-bold uppercase border-2 border-black ${
          pev.status === 'active' ? 'bg-green-400' : 'bg-yellow-400'
        }`}>
          {pev.status}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {pev.accepted_materials.slice(0, 3).map(m => (
          <span key={m} className="px-2 py-0.5 bg-gray-100 border border-black text-[10px] font-bold uppercase">
            {m}
          </span>
        ))}
        {pev.accepted_materials.length > 3 && (
          <span className="text-[10px] font-bold">+ {pev.accepted_materials.length - 3}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link 
          href={`/eco/pev/${pev.id}`} 
          className="cta-button text-xs py-2 px-3 justify-center"
          style={{ boxShadow: '3px 3px 0px var(--border)' }}
        >
          Painel
        </Link>
        <Link 
          href={`/eco/pev/${pev.id}/receber`} 
          className="cta-button text-xs py-2 px-3 justify-center bg-primary"
          style={{ boxShadow: '3px 3px 0px var(--border)' }}
        >
          Receber <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
