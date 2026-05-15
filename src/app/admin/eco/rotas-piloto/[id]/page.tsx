'use client';

import { useEffect, useState, use, useCallback } from 'react';
import { 
  ArrowLeft, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Package,
  Calendar,
  User,
  ClipboardList,
  MessageCircle,
  Play,
  Check,
  X,
  Info,
  Target
} from "lucide-react";
import Link from "next/link";
import { getPilotRouteReadiness, PILOT_ROUTE_MESSAGES } from "@/lib/eco/ecoRouteUtils";

export default function AdminRotaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const routeId = resolvedParams.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stops' | 'events' | 'results'>('stops');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/eco/pilot-routes/${routeId}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Error fetching route detail:", err);
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  if (loading) return <div className="p-20 text-center animate-pulse uppercase font-black tracking-widest">Carregando detalhes da rota...</div>;
  if (!data || !data.route) return <div className="p-20 text-center uppercase font-black tracking-widest text-red-600">Rota não encontrada.</div>;

  const { route, stops, events } = data;
  const readiness = getPilotRouteReadiness(route, stops.length);

  async function handleQuickAction(action: string) {
    try {
      const res = await fetch(`/api/admin/eco/pilot-routes/${routeId}/quick-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error("Action error:", err);
    }
  }

  async function updateStopStatus(stopId: string, updates: any) {
    try {
      const res = await fetch(`/api/admin/eco/pilot-routes/${routeId}/stops/${stopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error("Stop update error:", err);
    }
  }

  const getStatusColor = (status: string) => {
    const colors: any = {
      draft: 'bg-zinc-200 text-black',
      preparing: 'bg-zinc-800 text-white',
      confirming: 'bg-blue-600 text-white',
      scheduled: 'bg-yellow-400 text-black',
      in_progress: 'bg-emerald-500 text-white',
      completed: 'bg-green-700 text-white',
      canceled: 'bg-red-600 text-white'
    };
    return colors[status] || 'bg-zinc-100';
  };

  return (
    <div className="p-6 space-y-6 bg-zinc-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-4 border-black pb-4">
        <div className="space-y-1">
          <Link href="/admin/eco/rotas-piloto" className="flex items-center gap-1 text-[10px] font-black uppercase text-zinc-500 hover:text-black mb-2 transition-colors">
            <ArrowLeft size={12} /> Voltar para Kanban
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black uppercase tracking-tighter">{route.title}</h1>
            <span className={`px-2 py-0.5 text-xs font-black uppercase border-2 border-black ${getStatusColor(route.status)}`}>
              {route.status}
            </span>
          </div>
          <p className="text-zinc-600 font-bold text-sm">
            {route.neighborhood || "Bairro não definido"} • {route.vehicle_type || "Veículo não definido"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {route.status === 'draft' && (
            <button onClick={() => handleQuickAction('prepare_route')} className="bg-black text-white px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-zinc-800 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
              Iniciar Preparo
            </button>
          )}
          {route.status === 'preparing' && (
            <button onClick={() => handleQuickAction('start_confirmation')} className="bg-blue-600 text-white px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-blue-700 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
              Iniciar Confirmações
            </button>
          )}
          {route.status === 'confirming' && readiness.can_schedule && (
            <button onClick={() => handleQuickAction('schedule_route')} className="bg-yellow-400 text-black px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-yellow-500 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
              Agendar Rota
            </button>
          )}
          {route.status === 'scheduled' && (
            <button onClick={() => handleQuickAction('start_route')} className="bg-emerald-500 text-black px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-emerald-600 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
              Começar Rota Agora <Play size={16} className="inline ml-1" />
            </button>
          )}
          {route.status === 'in_progress' && (
            <button onClick={() => handleQuickAction('complete_route')} className="bg-black text-white px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-zinc-800 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
              Finalizar Coletas
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Info & Checklist */}
        <div className="space-y-6">
          <section className="bg-white border-4 border-black p-4 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="font-black uppercase text-sm border-b-2 border-black pb-1 flex items-center gap-2">
               <Info size={18} /> Detalhes do Planejamento
            </h2>
            <div className="grid grid-cols-1 gap-3">
               <div className="flex items-center gap-3">
                 <Calendar className="text-zinc-400" size={18} />
                 <div>
                   <p className="text-[10px] font-black uppercase text-zinc-400">Data Prevista</p>
                   <p className="text-sm font-bold">{route.planned_date || "N/A"}</p>
                 </div>
               </div>
               <div className="flex items-center gap-3">
                 <Clock className="text-zinc-400" size={18} />
                 <div>
                   <p className="text-[10px] font-black uppercase text-zinc-400">Janela de Horário</p>
                   <p className="text-sm font-bold">{route.time_window_start || "??:??"} - {route.time_window_end || "??:??"}</p>
                 </div>
               </div>
               <div className="flex items-center gap-3">
                 <User className="text-zinc-400" size={18} />
                 <div>
                   <p className="text-[10px] font-black uppercase text-zinc-400">Operador / Motorista</p>
                   <p className="text-sm font-bold">{route.operator_name || "A definir"}</p>
                 </div>
               </div>
            </div>
            
            <div className="pt-2">
              <p className="text-[10px] font-black uppercase text-zinc-400 mb-1">Foco de Materiais</p>
              <div className="flex flex-wrap gap-1">
                {route.material_focus?.map((m: string) => (
                  <span key={m} className="bg-emerald-100 text-emerald-800 border-2 border-emerald-800 text-[10px] font-black uppercase px-2 py-0.5">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-black text-white border-4 border-black p-4 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]">
            <h2 className="font-black uppercase text-sm border-b-2 border-white/20 pb-1 flex items-center gap-2">
               <ClipboardList size={18} /> Checklist de Prontidão
            </h2>
            
            <div className="space-y-3">
               <div className="flex items-center justify-between">
                 <span className="text-xs font-bold uppercase tracking-tight">Escore de Prontidão</span>
                 <span className={`text-xl font-black ${readiness.score >= 80 ? 'text-emerald-400' : 'text-yellow-400'}`}>{readiness.score}%</span>
               </div>
               <div className="h-2 w-full bg-white/10">
                 <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${readiness.score}%` }}></div>
               </div>

               <div className="space-y-2 pt-2">
                 {readiness.missing_items.map(item => (
                   <div key={item} className="flex items-center gap-2 text-xs text-red-400 font-bold uppercase italic">
                     <AlertCircle size={14} /> Falta: {item}
                   </div>
                 ))}
                 {readiness.warnings.map(item => (
                   <div key={item} className="flex items-center gap-2 text-xs text-yellow-400 font-bold uppercase">
                     <AlertCircle size={14} /> {item}
                   </div>
                 ))}
                 {readiness.can_schedule && (
                   <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold uppercase">
                     <CheckCircle2 size={14} /> Rota pronta para agendar
                   </div>
                 )}
               </div>
            </div>
          </section>

          <section className="bg-white border-4 border-black p-4 space-y-3">
             <h2 className="font-black uppercase text-sm border-b-2 border-black pb-1 flex items-center gap-2 text-zinc-400">
               <Target size={18} /> Estimativa vs Real
             </h2>
             <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-zinc-400">Custo Est.</p>
                  <p className="text-lg font-black tracking-tighter">R$ {route.estimated_cost_brl || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-zinc-400">Custo Real</p>
                  <p className="text-lg font-black tracking-tighter text-zinc-400">R$ {route.actual_cost_brl || '-'}</p>
                </div>
             </div>
          </section>
        </div>

        {/* Right Column: Content Area (Stops / Events) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Tabs */}
          <div className="flex border-b-4 border-black overflow-x-auto">
            <button 
              onClick={() => setActiveTab('stops')}
              className={`px-6 py-3 text-xs font-black uppercase transition-colors whitespace-nowrap ${activeTab === 'stops' ? 'bg-black text-white' : 'bg-transparent text-zinc-500 hover:bg-zinc-100'}`}
            >
              Paradas ({stops.length})
            </button>
            <button 
              onClick={() => setActiveTab('events')}
              className={`px-6 py-3 text-xs font-black uppercase transition-colors whitespace-nowrap ${activeTab === 'events' ? 'bg-black text-white' : 'bg-transparent text-zinc-500 hover:bg-zinc-100'}`}
            >
              Histórico / Eventos
            </button>
            <button 
              onClick={() => setActiveTab('results')}
              className={`px-6 py-3 text-xs font-black uppercase transition-colors whitespace-nowrap ${activeTab === 'results' ? 'bg-black text-white' : 'bg-transparent text-zinc-500 hover:bg-zinc-100'}`}
            >
              Resultados Reais
            </button>
          </div>

          {activeTab === 'stops' && (
            <div className="space-y-4">
              {stops.length === 0 ? (
                <div className="bg-white border-4 border-black border-dashed p-10 text-center space-y-3">
                   <Package className="mx-auto text-zinc-300" size={48} />
                   <p className="font-black uppercase text-zinc-400 italic">Esta rota ainda não tem demandas.</p>
                   <Link href="/admin/eco/mapa-demanda" className="inline-block bg-black text-white px-4 py-2 text-xs font-black uppercase border-2 border-black">Adicionar do Mapa</Link>
                </div>
              ) : (
                stops.map((s: any, idx: number) => (
                  <div key={s.id} className="bg-white border-4 border-black p-4 flex flex-col md:flex-row justify-between gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-black text-white w-6 h-6 flex items-center justify-center font-black text-xs">{idx + 1}</span>
                        <h3 className="font-black uppercase text-sm">{s.demand?.neighborhood} • {s.demand?.participant_type}</h3>
                      </div>
                      <p className="text-[10px] font-bold text-zinc-500">MATERIAIS: {s.demand?.material_types?.join(', ')}</p>
                      
                      <div className="flex flex-wrap gap-2 pt-2">
                         <div className="flex items-center gap-1 bg-zinc-100 px-2 py-0.5 rounded text-[10px] font-black uppercase text-zinc-600">
                           {s.confirmation_status === 'pending' && <Clock size={12} />}
                           {s.confirmation_status === 'confirmed' && <Check size={12} className="text-emerald-600" />}
                           {s.confirmation_status === 'refused' && <X size={12} className="text-red-600" />}
                           Confirmação: {s.confirmation_status}
                         </div>
                         <div className="flex items-center gap-1 bg-zinc-100 px-2 py-0.5 rounded text-[10px] font-black uppercase text-zinc-600">
                           Status: {s.status}
                         </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      <button 
                        onClick={() => {
                          const msg = PILOT_ROUTE_MESSAGES.confirmation(route.planned_date || 'N/A', route.time_window_start || '', route.time_window_end || '');
                          navigator.clipboard.writeText(msg);
                          if (s.demand?.contact_phone) {
                            window.open(`https://wa.me/${s.demand.contact_phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                          }
                          updateStopStatus(s.id, { confirmation_status: 'contacted', contacted_at: new Date().toISOString() });
                        }}
                        className="p-2 border-2 border-black hover:bg-emerald-50 text-emerald-700 transition-colors"
                        title="Enviar WhatsApp de Confirmação"
                      >
                        <MessageCircle size={18} />
                      </button>

                      {s.status === 'planned' && (
                        <>
                          <button 
                            onClick={() => updateStopStatus(s.id, { confirmation_status: 'confirmed', status: 'confirmed', confirmed_at: new Date().toISOString() })}
                            className="bg-emerald-500 text-black border-2 border-black px-3 py-1 text-[10px] font-black uppercase hover:bg-emerald-400"
                          >
                            Confirmar
                          </button>
                          <button 
                            onClick={() => updateStopStatus(s.id, { confirmation_status: 'refused', status: 'skipped' })}
                            className="bg-white text-red-600 border-2 border-red-600 px-3 py-1 text-[10px] font-black uppercase hover:bg-red-50"
                          >
                            Pular
                          </button>
                        </>
                      )}

                      {route.status === 'in_progress' && s.status === 'confirmed' && (
                        <button 
                          onClick={() => updateStopStatus(s.id, { status: 'collected' })}
                          className="bg-black text-white border-2 border-black px-4 py-2 text-xs font-black uppercase hover:bg-zinc-800"
                        >
                          Coletado
                        </button>
                      )}
                      
                      <Link href={`/admin/eco/demandas-reciclagem/${s.demand_id}`} target="_blank" className="p-2 border-2 border-black hover:bg-zinc-100 transition-colors">
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'events' && (
            <div className="bg-white border-4 border-black p-4 space-y-4">
               {events.map((e: any) => (
                 <div key={e.id} className="border-l-2 border-black pl-3 py-1 space-y-1">
                   <div className="flex items-center justify-between">
                     <span className="text-[10px] font-black uppercase tracking-tighter text-zinc-400">{new Date(e.created_at).toLocaleString('pt-BR')}</span>
                     <span className="bg-zinc-100 px-1 text-[10px] font-black uppercase">{e.event_type}</span>
                   </div>
                   <p className="text-sm font-bold uppercase tracking-tight">{e.note || `Mudança de ${e.old_value || '?'} para ${e.new_value || '?'}`}</p>
                 </div>
               ))}
               {events.length === 0 && <p className="text-zinc-400 italic text-center py-10 uppercase font-black tracking-widest opacity-20">Nenhum evento registrado.</p>}
            </div>
          )}

          {activeTab === 'results' && (
            <div className="bg-white border-4 border-black p-6 space-y-6">
              <h3 className="text-xl font-black uppercase tracking-tighter border-b-2 border-black pb-2">Aprendizado da Rota</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                   <div>
                     <p className="text-xs font-black uppercase text-zinc-400">Paradas Realizadas</p>
                     <p className="text-3xl font-black">{stops.filter((s: any) => s.status === 'collected').length} / {stops.length}</p>
                   </div>
                   <div>
                     <p className="text-xs font-black uppercase text-zinc-400">Volume Coletado (Score)</p>
                     <p className="text-3xl font-black">{stops.reduce((acc: number, s: any) => acc + (s.collected_volume_score || 0), 0)}</p>
                   </div>
                 </div>
                 <div className="space-y-4">
                   <div>
                     <p className="text-xs font-black uppercase text-zinc-400">Tempo Real</p>
                     <p className="text-3xl font-black">{route.actual_duration_minutes || '-'} min</p>
                   </div>
                   <div>
                     <p className="text-xs font-black uppercase text-zinc-400">Custo Real</p>
                     <p className="text-3xl font-black">R$ {route.actual_cost_brl || '-'}</p>
                   </div>
                 </div>
              </div>

              {route.status === 'completed' && (
                <div className="bg-emerald-50 border-4 border-emerald-800 p-6 space-y-4">
                  <div className="flex items-center gap-3 text-emerald-800">
                    <Info size={24} />
                    <div>
                      <h4 className="font-black uppercase text-sm">Viabilidade de PEV Detectada</h4>
                      <p className="text-xs font-bold uppercase leading-tight">
                        Esta rota passou por locais com alta recorrência. Considere testar um PEV experimental aqui.
                      </p>
                    </div>
                  </div>
                  <Link 
                    href={`/admin/eco/pevs/novo?source_route_id=${route.id}&neighborhood=${encodeURIComponent(stops[0]?.demand?.neighborhood || '')}`}
                    className="block w-full bg-emerald-800 text-white text-center py-3 font-black uppercase text-xs hover:bg-emerald-900 transition-colors"
                  >
                    Criar PEV Experimental a partir desta Rota
                  </Link>
                </div>
              )}

              {route.status !== 'completed' && (
                <div className="bg-zinc-100 border-2 border-black p-4 text-center">
                   <p className="text-xs font-bold uppercase italic text-zinc-500 italic">Os resultados finais serão consolidados após a conclusão da rota.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
