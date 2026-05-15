export const dynamic = 'force-dynamic'
import { getPevById, getCellIdForUser } from "@/lib/eco/pev"
import { EntryForm } from "@/components/eco/EntryForm"
import Link from "next/link"
import { ArrowLeft, Zap } from "lucide-react"

export default async function ReceberPage({ params }: { params: { id: string } }) {
  const { id } = await params
  const pev = await getPevById(id)
  const cellId = await getCellIdForUser()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/eco/pev/${id}`} className="p-2 border-2 border-black hover:bg-gray-100">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="stencil-text text-3xl leading-none">RECEBIMENTO</h1>
          <span className="text-xs font-black uppercase text-muted">PLANTÃO: {pev.name}</span>
        </div>
      </div>

      <div className="p-4 border-4 border-black bg-yellow-400 flex items-center gap-4 mb-8">
        <div className="bg-black text-white p-2">
          <Zap size={24} />
        </div>
        <div>
          <p className="text-sm font-black uppercase leading-tight">Fluxo de Plantão</p>
          <p className="text-[10px] font-bold uppercase opacity-80">Registre cada entrega assim que o material chegar.</p>
        </div>
      </div>

      {cellId ? (
        <EntryForm pevId={id} cellId={cellId} />
      ) : (
        <div className="card text-center py-12 border-red-500">
           <p className="font-black text-red-600 uppercase">Acesso Não Identificado</p>
           <p className="text-sm">Você precisa estar vinculado a uma célula para registrar recebimentos.</p>
        </div>
      )}
    </div>
  )
}
