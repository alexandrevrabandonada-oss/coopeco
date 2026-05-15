"use client"

import { useState, useEffect } from "react"
import { getPevLots, getPevById, closeLot, PevLot, PevSite } from "@/lib/eco/pev"
import Link from "next/link"
import { ArrowLeft, Lock, History, CheckCircle2, ChevronRight, Loader2, DollarSign, TrendingUp } from "lucide-react"
import { useParams } from "next/navigation"

export default function LotesPage() {
  const { id } = useParams() as { id: string }
  const [pev, setPev] = useState<PevSite | null>(null)
  const [lots, setLots] = useState<PevLot[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [p, l] = await Promise.all([getPevById(id), getPevLots(id)])
        setPev(p)
        setLots(l)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleCloseLot(lotId: string) {
    if (!confirm("Deseja realmente fechar este lote? Novos recebimentos criarão um novo lote automaticamente.")) return
    
    setActionLoading(lotId)
    try {
      await closeLot(lotId)
      const updatedLots = await getPevLots(id)
      setLots(updatedLots)
    } catch (err) {
      console.error(err)
      alert("Erro ao fechar lote")
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) return <div className="p-12 text-center font-black uppercase">Carregando Lotes...</div>

  const activeLots = lots.filter(l => l.status === 'open')
  const historicalLots = lots.filter(l => l.status !== 'open')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/eco/pev/${id}`} className="p-2 border-2 border-black hover:bg-gray-100">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="stencil-text text-3xl leading-none">GESTÃO DE LOTES</h1>
          <span className="text-xs font-black uppercase text-muted">{pev?.name}</span>
        </div>
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="stencil-text text-xl mb-4 flex items-center gap-2">
            LOTE ATUAL
          </h2>
          {activeLots.length === 0 ? (
            <div className="card border-dashed border-4 text-center py-8">
              <p className="text-sm font-bold text-gray-500 uppercase">Nenhum lote aberto no momento.</p>
              <p className="text-[10px] uppercase mt-1">O primeiro recebimento abrirá um lote automaticamente.</p>
            </div>
          ) : (
            activeLots.map(lot => (
              <div key={lot.id} className="card border-4 border-black bg-yellow-50">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="bg-black text-white px-2 py-0.5 text-[10px] font-black uppercase mb-1 inline-block">ABERTO EM {new Date(lot.opened_at).toLocaleDateString('pt-BR')}</span>
                    <h3 className="text-2xl font-black">{lot.code}</h3>
                  </div>
                  <button 
                    onClick={() => handleCloseLot(lot.id)}
                    disabled={!!actionLoading}
                    className="cta-button bg-black text-white text-xs py-2"
                  >
                    {actionLoading === lot.id ? <Loader2 className="animate-spin" /> : <>FECHAR LOTE <Lock size={14} className="ml-2" /></>}
                  </button>
                </div>
                <div className="flex gap-4">
                   <div className="flex-1 p-3 bg-white border-2 border-black">
                      <p className="text-[10px] font-black uppercase opacity-60">Status</p>
                      <p className="text-sm font-black uppercase">{lot.status}</p>
                   </div>
                   <div className="flex-1 p-3 bg-white border-2 border-black">
                      <p className="text-[10px] font-black uppercase opacity-60">Peso Est.</p>
                      <p className="text-xl font-black">--</p>
                   </div>
                </div>
              </div>
            ))
          )}
        </section>

        <section>
          <h2 className="stencil-text text-xl mb-4 flex items-center gap-2">
            <History className="text-gray-400" /> HISTÓRICO
          </h2>
          <div className="space-y-3">
            {historicalLots.map(lot => (
              <div key={lot.id} className="flex items-center gap-4 p-4 border-2 border-black bg-white hover:bg-gray-50 group transition-colors">
                <div className="w-10 h-10 bg-gray-100 border-2 border-black flex items-center justify-center">
                  {lot.status === 'paid' ? <DollarSign className="text-green-600" size={20} /> : <CheckCircle2 className="text-gray-400" size={20} />}
                </div>
                <div className="flex-1">
                  <div className="font-black text-sm uppercase">{lot.code}</div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase">
                    {lot.status} • {new Date(lot.closed_at || '').toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                   <div className="text-right hidden sm:block">
                      <div className="text-[10px] font-black uppercase opacity-60">Venda</div>
                      <div className="text-xs font-black">{lot.gross_value ? `R$ ${Number(lot.gross_value).toFixed(2)}` : '--'}</div>
                   </div>
                   <Link 
                     href={`/eco/pev/lotes/${lot.id}`} 
                     className="cta-button py-2 px-4 text-[10px] bg-primary group-hover:bg-yellow-400"
                   >
                     GERENCIAR <ChevronRight size={12} className="ml-1" />
                   </Link>
                </div>
              </div>
            ))}
            {historicalLots.length === 0 && (
              <p className="text-center py-8 text-xs font-black uppercase opacity-40">Nenhum lote finalizado.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
