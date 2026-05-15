'use client';

import { useEffect, useState } from 'react';
import { 
  ClipboardList, 
  Truck, 
  ChevronRight, 
  PlusCircle, 
  Clock, 
  CheckCircle2, 
  Package,
  Calendar,
  User,
  MapPin,
  Target
} from "lucide-react";
import Link from "next/link";

export default function AdminRotasPilotoPage() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);

  async function fetchRoutes() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/eco/pilot-routes');
      const data = await res.json();
      setRoutes(data.items || []);
      setSummary(data.summary || {});
    } catch (err) {
      console.error("Error fetching routes:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRoutes();
  }, []);

  const groups = {
    draft: routes.filter(r => r.status === 'draft'),
    preparing: routes.filter(r => r.status === 'preparing'),
    confirming: routes.filter(r => r.status === 'confirming'),
    scheduled: routes.filter(r => r.status === 'scheduled'),
    in_progress: routes.filter(r => r.status === 'in_progress'),
    finalized: routes.filter(r => ['completed', 'canceled', 'archived'].includes(r.status))
  };

  const RouteCard = ({ r }: { r: any }) => (
    <div className="bg-white border-2 border-black p-3 hover:bg-gray-50 flex flex-col justify-between min-h-[160px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1">
      <div className="space-y-2">
        <div className="flex justify-between items-start gap-2">
          <span className="font-black uppercase text-xs truncate bg-black text-white px-1">{r.neighborhood || "Sem Bairro"}</span>
          <span className="text-[10px] font-bold text-gray-500 uppercase">{r.route_type}</span>
        </div>
        
        <h3 className="font-black text-sm uppercase leading-tight">{r.title}</h3>
        
        <div className="grid grid-cols-1 gap-1">
          {r.planned_date && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-gray-600">
              <Calendar size={12} /> {new Date(r.planned_date).toLocaleDateString('pt-BR')}
            </div>
          )}
          {(r.time_window_start || r.time_window_end) && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-gray-600">
              <Clock size={12} /> {r.time_window_start?.slice(0,5)} - {r.time_window_end?.slice(0,5)}
            </div>
          )}
          {r.operator_name && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-gray-600">
              <User size={12} /> {r.operator_name}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1 pt-1">
          {r.material_focus?.map((m: string) => (
            <span key={m} className="bg-zinc-100 border border-zinc-300 text-[8px] font-black uppercase px-1">{m}</span>
          ))}
        </div>
      </div>
      
      <div className="mt-3 border-t-2 border-black pt-2 flex justify-between items-center">
        <div className="flex items-center gap-1">
           <Package size={14} className="text-zinc-400" />
           <span className="text-xs font-black">{r.estimated_stops || 0}</span>
        </div>
        <Link href={`/admin/eco/rotas-piloto/${r.id}`} className="flex items-center justify-center gap-1 bg-black text-white px-2 py-1 text-[10px] font-black uppercase hover:bg-gray-800">
          Operar <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 h-screen flex flex-col overflow-hidden py-6 px-6 bg-zinc-50">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-zinc-900">Rotas Piloto</h1>
          <p className="text-zinc-600 font-bold text-lg">Teste pequeno, com cuidado, para descobrir o que funciona.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/eco/mapa-demanda" className="border-4 border-black p-3 bg-white text-black font-black uppercase text-sm hover:bg-zinc-100 flex items-center gap-2">
            <MapPin size={18} /> Ver Mapa
          </Link>
          <button onClick={() => {}} className="border-4 border-black p-3 bg-emerald-500 text-black font-black uppercase text-sm hover:bg-emerald-400 flex items-center gap-2">
            <PlusCircle size={18} /> Nova Rota Piloto
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 shrink-0">
        <div className="border-4 border-black p-3 bg-zinc-200 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[10px] font-black uppercase">Rascunhos</p>
          <p className="text-2xl font-black">{summary.draft || 0}</p>
        </div>
        <div className="border-4 border-black p-3 bg-blue-100 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[10px] font-black uppercase text-blue-800">Em Confirmação</p>
          <p className="text-2xl font-black">{summary.confirming || 0}</p>
        </div>
        <div className="border-4 border-black p-3 bg-yellow-200 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[10px] font-black uppercase text-yellow-800">Agendadas</p>
          <p className="text-2xl font-black">{summary.scheduled || 0}</p>
        </div>
        <div className="border-4 border-black p-3 bg-emerald-200 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[10px] font-black uppercase text-emerald-800">Em Andamento</p>
          <p className="text-2xl font-black">{summary.in_progress || 0}</p>
        </div>
        <div className="border-4 border-black p-3 bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[10px] font-black uppercase text-zinc-400">Concluídas</p>
          <p className="text-2xl font-black">{summary.completed || 0}</p>
        </div>
        <div className="border-4 border-black p-3 bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,128,0,0.5)]">
          <p className="text-[10px] font-black uppercase text-emerald-400">Paradas Previstas</p>
          <p className="text-2xl font-black">{summary.estimated_stops_total || 0}</p>
        </div>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-black"></div>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6 h-full">
          
          {/* Col: Rascunho */}
          <div className="flex-shrink-0 w-80 bg-zinc-100 border-4 border-black flex flex-col">
            <div className="bg-zinc-300 text-black p-3 font-black uppercase text-sm border-b-4 border-black flex justify-between items-center">
              <span className="flex items-center gap-2"><ClipboardList size={18} /> 1. Rascunho</span>
              <span className="bg-black text-white px-2 py-0.5 rounded-full text-xs">{groups.draft.length}</span>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1 thin-scrollbar">
              {groups.draft.map(r => <RouteCard key={r.id} r={r} />)}
              {groups.draft.length === 0 && (
                <p className="text-xs font-bold text-zinc-400 text-center py-10 uppercase italic">Nenhuma rota em rascunho</p>
              )}
            </div>
          </div>

          {/* Col: Preparando */}
          <div className="flex-shrink-0 w-80 bg-zinc-100 border-4 border-black flex flex-col">
            <div className="bg-zinc-200 text-black p-3 font-black uppercase text-sm border-b-4 border-black flex justify-between items-center">
              <span className="flex items-center gap-2"><Target size={18} /> 2. Preparando</span>
              <span className="bg-black text-white px-2 py-0.5 rounded-full text-xs">{groups.preparing.length}</span>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1 thin-scrollbar">
              {groups.preparing.map(r => <RouteCard key={r.id} r={r} />)}
            </div>
          </div>

          {/* Col: Confirmando */}
          <div className="flex-shrink-0 w-80 bg-zinc-100 border-4 border-black flex flex-col">
            <div className="bg-blue-200 text-black p-3 font-black uppercase text-sm border-b-4 border-black flex justify-between items-center">
              <span className="flex items-center gap-2"><Clock size={18} /> 3. Confirmando</span>
              <span className="bg-black text-white px-2 py-0.5 rounded-full text-xs">{groups.confirming.length}</span>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1 thin-scrollbar">
              {groups.confirming.map(r => <RouteCard key={r.id} r={r} />)}
            </div>
          </div>

          {/* Col: Agendada */}
          <div className="flex-shrink-0 w-80 bg-zinc-100 border-4 border-black flex flex-col">
            <div className="bg-yellow-200 text-black p-3 font-black uppercase text-sm border-b-4 border-black flex justify-between items-center">
              <span className="flex items-center gap-2"><Calendar size={18} /> 4. Agendada</span>
              <span className="bg-black text-white px-2 py-0.5 rounded-full text-xs">{groups.scheduled.length}</span>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1 thin-scrollbar">
              {groups.scheduled.map(r => <RouteCard key={r.id} r={r} />)}
            </div>
          </div>

          {/* Col: Em Andamento */}
          <div className="flex-shrink-0 w-80 bg-zinc-100 border-4 border-black flex flex-col">
            <div className="bg-emerald-300 text-black p-3 font-black uppercase text-sm border-b-4 border-black flex justify-between items-center">
              <span className="flex items-center gap-2"><Truck size={18} /> 5. Em Andamento</span>
              <span className="bg-black text-white px-2 py-0.5 rounded-full text-xs">{groups.in_progress.length}</span>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1 thin-scrollbar">
              {groups.in_progress.map(r => <RouteCard key={r.id} r={r} />)}
            </div>
          </div>

          {/* Col: Finalizadas */}
          <div className="flex-shrink-0 w-80 bg-zinc-100 border-4 border-black flex flex-col">
            <div className="bg-zinc-800 text-white p-3 font-black uppercase text-sm border-b-4 border-black flex justify-between items-center">
              <span className="flex items-center gap-2"><CheckCircle2 size={18} /> 6. Concluídas</span>
              <span className="bg-white text-black px-2 py-0.5 rounded-full text-xs">{groups.finalized.length}</span>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1 thin-scrollbar opacity-60">
              {groups.finalized.map(r => <RouteCard key={r.id} r={r} />)}
            </div>
          </div>

        </div>
      )}

      {/* Microcopy footer */}
      <div className="bg-zinc-900 text-zinc-400 p-2 text-center text-[10px] font-black uppercase tracking-widest shrink-0">
        &quot;Rota piloto boa é pequena o bastante para caber na mão e grande o bastante para ensinar.&quot;
      </div>
    </div>
  );
}
