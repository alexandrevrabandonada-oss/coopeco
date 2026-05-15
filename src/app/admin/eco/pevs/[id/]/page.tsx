'use client';

import { useEffect, useState, use } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Package,
  Calendar,
  User,
  ClipboardList,
  TrendingUp,
  Target,
  Shield,
  Info,
  ChevronRight,
  MessageCircle,
  X,
  Check
} from "lucide-react";
import Link from "next/link";
import { getPevExperimentReadiness } from "@/lib/eco/pev";

export default function AdminPevDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const pevId = resolvedParams.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'operation' | 'rules' | 'events'>('operation');

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/eco/pevs/${pevId}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Error fetching PEV detail:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [pevId]);

  if (loading) return <div className="p-20 text-center animate-pulse uppercase font-black tracking-widest">Carregando detalhes do PEV...</div>;
  if (!data || !data.pev) return <div className="p-20 text-center uppercase font-black tracking-widest text-red-600">PEV não encontrado.</div>;

  const { pev, events, entries, lots } = data;
  const readiness = getPevExperimentReadiness(pev);

  async function handleQuickAction(action: string) {
    try {
      const res = await fetch(`/api/admin/eco/pevs/${pevId}/quick-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error("Action error:", err);
    }
  }

  const getStatusColor = (status: string) => {
    const colors: any = {
      draft: 'bg-zinc-200 text-black',
      evaluating: 'bg-blue-100 text-blue-800',
      approved_for_test: 'bg-yellow-100 text-yellow-800',
      active_test: 'bg-emerald-500 text-white',
      converted_to_regular: 'bg-zinc-800 text-white',
      paused: 'bg-red-100 text-red-800',
      failed: 'bg-red-600 text-white'
    };
    return colors[status] || 'bg-zinc-100';
  };

  return (
    <div className="p-6 space-y-6 bg-zinc-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-4 border-black pb-4">
        <div className="space-y-1">
          <Link href="/admin/eco/pevs" className="flex items-center gap-1 text-[10px] font-black uppercase text-zinc-500 hover:text-black mb-2 transition-colors">
            <ArrowLeft size={12} /> Voltar para Experimentos
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black uppercase tracking-tighter">{pev.partner_display_name || pev.name}</h1>
            <span className={`px-2 py-0.5 text-xs font-black uppercase border-2 border-black ${getStatusColor(pev.experiment_status)}`}>
              {pev.experiment_status}
            </span>
          </div>
          <p className="text-zinc-600 font-bold text-sm">
            {pev.neighborhood || "Bairro não definido"} • {pev.city || "Volta Redonda"} • Modo: <span className="uppercase font-black">{pev.pev_mode}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {pev.experiment_status === 'draft' && (
            <button onClick={() => handleQuickAction('start_evaluation')} className="bg-black text-white px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-zinc-800 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
              Iniciar Avaliação
            </button>
          )}
          {pev.experiment_status === 'evaluating' && (
            <button onClick={() => handleQuickAction('approve_for_test')} className="bg-blue-600 text-white px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-blue-700 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
              Aprovar para Teste
            </button>
          )}
          {pev.experiment_status === 'approved_for_test' && readiness.can_activate && (
            <button onClick={() => handleQuickAction('activate_test')} className="bg-emerald-500 text-black px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-emerald-600 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
              Ativar Teste de Campo
            </button>
          )}
          {pev.experiment_status === 'active_test' && (
            <div className="flex gap-2">
              <button onClick={() => handleQuickAction('pause_test')} className="bg-yellow-400 text-black px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-yellow-500 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                Pausar Teste
              </button>
              <button onClick={() => handleQuickAction('convert_to_regular')} className="bg-black text-white px-4 py-2 text-sm font-black uppercase border-4 border-black hover:bg-zinc-800 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                Converter para Regular
              </button>
            </div>
          )}
          <button onClick={() => handleQuickAction('fail_experiment')} className="bg-white text-red-600 px-4 py-2 text-sm font-black uppercase border-4 border-red-600 hover:bg-red-50 transition-colors shadow-[4px_4px_0px_0px_rgba(220,38,38,0.2)]">
            Falhou / Rejeitar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Readiness & Info */}
        <div className="space-y-6">
          <section className="bg-black text-white border-4 border-black p-4 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]">
            <h2 className="font-black uppercase text-sm border-b-2 border-white/20 pb-1 flex items-center gap-2">
               <Shield size={18} /> Prontidão do Experimento
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
                 {readiness.missing_items.map((item: string) => (
                   <div key={item} className="flex items-center gap-2 text-xs text-red-400 font-bold uppercase italic">
                     <AlertCircle size={14} /> Falta: {item}
                   </div>
                 ))}
                 {readiness.warnings.map((item: string) => (
                   <div key={item} className="flex items-center gap-2 text-xs text-yellow-400 font-bold uppercase">
                     <AlertCircle size={14} /> {item}
                   </div>
                 ))}
                 {readiness.can_activate && (
                   <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold uppercase">
                     <CheckCircle2 size={14} /> Pronto para ativação
                   </div>
                 )}
               </div>
            </div>
          </section>

          <section className="bg-white border-4 border-black p-4 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="font-black uppercase text-sm border-b-2 border-black pb-1 flex items-center gap-2">
               <Info size={18} /> Metadados Operacionais
            </h2>
            <div className="grid grid-cols-1 gap-3">
               <div className="flex items-center gap-3">
                 <Package className="text-zinc-400" size={18} />
                 <div>
                   <p className="text-[10px] font-black uppercase text-zinc-400">Capacidade</p>
                   <p className="text-sm font-bold uppercase">{pev.capacity_level}</p>
                 </div>
               </div>
               <div className="flex items-center gap-3">
                 <Clock className="text-zinc-400" size={18} />
                 <div>
                   <p className="text-[10px] font-black uppercase text-zinc-400">Frequência de Retirada</p>
                   <p className="text-sm font-bold uppercase">{pev.needs_pickup_frequency}</p>
                 </div>
               </div>
               <div className="flex items-center gap-3">
                 <TrendingUp className="text-zinc-400" size={18} />
                 <div>
                   <p className="text-[10px] font-black uppercase text-zinc-400">Visibilidade Pública</p>
                   <p className="text-sm font-bold uppercase">{pev.public_visibility} ({pev.address_public_level})</p>
                 </div>
               </div>
            </div>
            
            {pev.source_zone_id && (
               <div className="pt-2 border-t border-zinc-100">
                 <p className="text-[10px] font-black uppercase text-zinc-400 mb-1">Origem do Mapa</p>
                 <Link href={`/admin/eco/mapa-demanda`} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                   <Target size={12} /> Ver Zona de Demanda
                 </Link>
               </div>
            )}
          </section>
        </div>

        {/* Right Column: Tabs & Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex border-b-4 border-black overflow-x-auto">
            <button 
              onClick={() => setActiveTab('operation')}
              className={`px-6 py-3 text-xs font-black uppercase transition-colors whitespace-nowrap ${activeTab === 'operation' ? 'bg-black text-white' : 'bg-transparent text-zinc-500 hover:bg-zinc-100'}`}
            >
              Operação & Entradas
            </button>
            <button 
              onClick={() => setActiveTab('rules')}
              className={`px-6 py-3 text-xs font-black uppercase transition-colors whitespace-nowrap ${activeTab === 'rules' ? 'bg-black text-white' : 'bg-transparent text-zinc-500 hover:bg-zinc-100'}`}
            >
              Regras & Materiais
            </button>
            <button 
              onClick={() => setActiveTab('events')}
              className={`px-6 py-3 text-xs font-black uppercase transition-colors whitespace-nowrap ${activeTab === 'events' ? 'bg-black text-white' : 'bg-transparent text-zinc-500 hover:bg-zinc-100'}`}
            >
              Histórico
            </button>
          </div>

          {activeTab === 'operation' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="bg-white border-4 border-black p-4 space-y-2">
                    <p className="text-[10px] font-black uppercase text-zinc-400">Última Entrada</p>
                    <p className="text-lg font-black uppercase">{pev.last_entry_at ? new Date(pev.last_entry_at).toLocaleString('pt-BR') : 'Nenhuma'}</p>
                 </div>
                 <div className="bg-white border-4 border-black p-4 space-y-2">
                    <p className="text-[10px] font-black uppercase text-zinc-400">Última Coleta/Retirada</p>
                    <p className="text-lg font-black uppercase">{pev.last_collection_at ? new Date(pev.last_collection_at).toLocaleString('pt-BR') : 'Nenhuma'}</p>
                 </div>
              </div>

              <div className="bg-white border-4 border-black p-6 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                 <div className="flex justify-between items-center border-b-2 border-black pb-2">
                    <h3 className="font-black uppercase text-sm">Entradas Recentes</h3>
                    <Link href={`/eco/pev/${pevId}/receber`} className="bg-emerald-500 text-black px-3 py-1 text-[10px] font-black uppercase border-2 border-black hover:bg-emerald-400">
                      Registrar Entrada
                    </Link>
                 </div>
                 <div className="space-y-3">
                    {entries.map((e: any) => (
                      <div key={e.id} className="flex justify-between items-center text-xs border-b border-zinc-100 pb-2 last:border-0">
                         <div>
                            <span className="font-black uppercase">{e.material_type}</span>
                            <p className="text-zinc-400 text-[10px] font-bold">{new Date(e.received_at).toLocaleDateString('pt-BR')} • {e.quantity} {e.unit}</p>
                         </div>
                         <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${e.condition === 'clean' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`}>
                           {e.condition}
                         </span>
                      </div>
                    ))}
                    {entries.length === 0 && <p className="text-zinc-400 italic text-center py-4 uppercase font-black tracking-widest opacity-20">Nenhuma entrada.</p>}
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-emerald-50 border-4 border-emerald-800 p-4 space-y-4">
                     <h3 className="font-black uppercase text-emerald-800 text-sm border-b border-emerald-800/20 pb-1">O QUE ACEITA</h3>
                     <div className="flex flex-wrap gap-2">
                        {pev.accepted_materials?.map((m: string) => (
                          <span key={m} className="bg-emerald-800 text-white px-2 py-0.5 text-[10px] font-black uppercase">{m}</span>
                        ))}
                     </div>
                     <p className="text-xs text-emerald-900 font-bold whitespace-pre-wrap">{pev.opening_rules || "Sem regras de horário/funcionamento"}</p>
                  </div>
                  <div className="bg-red-50 border-4 border-red-800 p-4 space-y-4">
                     <h3 className="font-black uppercase text-red-800 text-sm border-b border-red-800/20 pb-1">O QUE NÃO ACEITA</h3>
                     <div className="flex flex-wrap gap-2">
                        {pev.rejected_materials?.map((m: string) => (
                          <span key={m} className="bg-red-800 text-white px-2 py-0.5 text-[10px] font-black uppercase">{m}</span>
                        ))}
                     </div>
                     <p className="text-xs text-red-900 font-bold whitespace-pre-wrap">{pev.safety_rules || "Sem regras de segurança definidas"}</p>
                  </div>
               </div>
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

        </div>
      </div>
    </div>
  );
}
