import { getAdminDemands, getDemandEvents, getWhatsAppTemplate } from "@/lib/eco/demand"
import { ArrowLeft, Clock, MessageCircle, Phone, MapPin, Target, Truck, AlertTriangle } from "lucide-react"
import Link from "next/link"

export default async function DemandDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [demand] = await getAdminDemands({ status: undefined }) // Simplified fetch, better to use single get
  // Since getAdminDemands returns an array based on filters, we'll fetch single manually or rely on filtering
  // Actually, wait. I didn't create a `getDemandById` in demand.ts. I will just fetch all and find, or just import supabase.
  // For MVP, I'll filter the array:
  const demands = await getAdminDemands()
  const d = demands.find(x => x.id === id)
  const events = await getDemandEvents(id)

  if (!d) return <div>Demanda não encontrada.</div>

  const waFirstContact = getWhatsAppTemplate('first_contact', d)
  const waGuidance = getWhatsAppTemplate('guidance', d)
  const waPev = getWhatsAppTemplate('pev_candidate', d)

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-8 px-4">
      <Link href="/admin/eco/demandas-reciclagem" className="flex items-center gap-2 font-bold uppercase text-sm hover:underline">
        <ArrowLeft size={16} /> Voltar para o Painel
      </Link>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight">{d.neighborhood}</h1>
          <p className="text-gray-500 font-bold uppercase">{d.participant_type} • ID: {d.id?.split('-')[0]}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-black uppercase text-gray-400">Status Atual</p>
          <span className="bg-black text-white px-3 py-1 font-black uppercase">{d.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Col: Details */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Public Data */}
          <div className="border-4 border-black p-6 bg-white">
            <h2 className="font-black uppercase text-xl border-b-2 border-black pb-2 mb-4">Dados Operacionais</h2>
            <div className="grid grid-cols-2 gap-4 text-sm font-bold">
              <div>
                <p className="text-gray-500 uppercase text-xs">Volume</p>
                <p>{d.volume_level}</p>
              </div>
              <div>
                <p className="text-gray-500 uppercase text-xs">Frequência</p>
                <p>{d.frequency}</p>
              </div>
              <div>
                <p className="text-gray-500 uppercase text-xs">Materiais</p>
                <p>{d.material_types.join(', ')}</p>
              </div>
              <div>
                <p className="text-gray-500 uppercase text-xs">Preferência</p>
                <p>{d.preference}</p>
              </div>
              {d.main_problem && (
                <div className="col-span-2 mt-2 bg-gray-100 p-3">
                  <p className="text-gray-500 uppercase text-xs">Maior Problema Atual</p>
                  <p>{d.main_problem}</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              {d.can_be_pev && <span className="bg-green-100 text-green-800 font-bold px-2 py-1 flex items-center gap-1 text-xs uppercase"><Target size={14}/> Topa ser PEV</span>}
              {d.can_volunteer && <span className="bg-yellow-100 text-yellow-800 font-bold px-2 py-1 flex items-center gap-1 text-xs uppercase">Quer ser Voluntário</span>}
              {d.is_recurring_generator && <span className="bg-blue-100 text-blue-800 font-bold px-2 py-1 flex items-center gap-1 text-xs uppercase">Gerador Recorrente</span>}
            </div>
          </div>

          {/* Private Data */}
          <div className="border-4 border-dashed border-red-300 p-6 bg-red-50">
            <h2 className="font-black uppercase text-xl border-b-2 border-red-300 pb-2 mb-4 text-red-900 flex items-center gap-2">
              <AlertTriangle size={20} /> Contato (Privado)
            </h2>
            {d.consent_contact ? (
              <div className="grid grid-cols-2 gap-4 text-sm font-bold text-red-900">
                <div>
                  <p className="text-red-700 uppercase text-xs">Nome</p>
                  <p>{d.contact_name || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-red-700 uppercase text-xs">Telefone</p>
                  <p>{d.contact_phone || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-red-700 uppercase text-xs">E-mail</p>
                  <p>{d.contact_email || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-red-700 uppercase text-xs">Referência / Endereço</p>
                  <p>{d.address_hint || 'Não informado'}</p>
                </div>
              </div>
            ) : (
              <p className="font-bold uppercase text-red-700">Esta pessoa NÃO autorizou contato direto. Use esses dados apenas se for caso de extrema necessidade operacional, e de preferência, aguarde mais volume no bairro.</p>
            )}
          </div>

          {/* Action Area (Forms will be mocked for MVP viewing) */}
          <div className="border-4 border-black p-6 bg-yellow-400">
             <h2 className="font-black uppercase text-xl mb-4">Ação Rápida (Operador)</h2>
             <div className="flex flex-wrap gap-2">
                <button className="bg-black text-white px-4 py-2 font-black uppercase text-sm">Marcar como Contatado</button>
                <button className="border-2 border-black bg-white px-4 py-2 font-black uppercase text-sm text-black">Candidato Rota</button>
                <button className="border-2 border-black bg-white px-4 py-2 font-black uppercase text-sm text-black">Candidato PEV</button>
                <button className="bg-transparent border-2 border-black px-4 py-2 font-black uppercase text-sm text-black hover:bg-black hover:text-white transition-colors">Arquivar</button>
             </div>
          </div>

        </div>

        {/* Right Col: Timeline & Comm */}
        <div className="space-y-6">
          <div className="border-4 border-black p-6 bg-white">
            <h2 className="font-black uppercase text-xl border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
              <MessageCircle size={20} /> Textos Base
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase">1º Contato</p>
                <textarea readOnly className="w-full text-xs font-mono p-2 border-2 border-gray-300 h-24" value={waFirstContact} />
              </div>
              {d.can_be_pev && (
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase">Investigar PEV</p>
                  <textarea readOnly className="w-full text-xs font-mono p-2 border-2 border-gray-300 h-24" value={waPev} />
                </div>
              )}
              {d.contact_phone && (
                <a href={`https://wa.me/55${d.contact_phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-green-600 text-white p-3 font-black uppercase text-sm w-full">
                  <Phone size={16} /> Abrir WhatsApp
                </a>
              )}
            </div>
          </div>

          <div className="border-4 border-black p-6 bg-gray-50">
            <h2 className="font-black uppercase text-xl border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
              <Clock size={20} /> Histórico
            </h2>
            {events.length === 0 ? (
              <p className="text-sm font-bold uppercase text-gray-400">Nenhum evento registrado.</p>
            ) : (
              <div className="space-y-4">
                {events.map(ev => (
                  <div key={ev.id} className="border-l-2 border-black pl-3 py-1 relative">
                    <div className="absolute w-2 h-2 bg-black rounded-full -left-[5px] top-2"></div>
                    <p className="text-[10px] font-black text-gray-500 uppercase">{new Date(ev.created_at || '').toLocaleString()}</p>
                    <p className="text-sm font-bold uppercase">{ev.event_type}</p>
                    {ev.note && <p className="text-xs text-gray-600 mt-1">{ev.note}</p>}
                    {(ev.old_value || ev.new_value) && (
                      <p className="text-[10px] font-mono mt-1 bg-gray-200 inline-block px-1">
                        {ev.old_value} &rarr; {ev.new_value}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
