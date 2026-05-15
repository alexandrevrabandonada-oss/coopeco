'use client';

import { useEffect, useState } from 'react';
import { 
  ClipboardList, 
  Search, 
  ChevronRight, 
  PlusCircle, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Package,
  MapPin,
  TrendingUp,
  Filter,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

export default function AdminPevsExperimentalPage() {
  const [pevs, setPevs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  async function fetchPevs() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/eco/pevs');
      const data = await res.json();
      setPevs(data.items || []);
      setSummary(data.summary || {});
    } catch (err) {
      console.error("Error fetching PEVs:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPevs();
  }, []);

  const groups = {
    draft: pevs.filter(p => p.experiment_status === 'draft'),
    evaluating: pevs.filter(p => p.experiment_status === 'evaluating'),
    approved: pevs.filter(p => p.experiment_status === 'approved_for_test'),
    active: pevs.filter(p => p.experiment_status === 'active_test'),
    paused: pevs.filter(p => ['paused', 'failed'].includes(p.experiment_status)),
    converted: pevs.filter(p => p.experiment_status === 'converted_to_regular')
  };

  const PevCard = ({ p }: { p: any }) => (
    <div className="bg-white border-2 border-black p-3 hover:bg-zinc-50 flex flex-col justify-between min-h-[140px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1">
      <div className="space-y-2">
        <div className="flex justify-between items-start gap-2">
          <span className="font-black uppercase text-[10px] truncate bg-black text-white px-1">{p.neighborhood || "Sem Bairro"}</span>
          <span className={`text-[10px] font-bold uppercase ${p.public_visibility === 'private' ? 'text-zinc-400' : 'text-emerald-600'}`}>
            {p.public_visibility}
          </span>
        </div>
        
        <h3 className="font-black text-sm uppercase leading-tight">{p.name}</h3>
        
        <div className="flex flex-wrap gap-1 pt-1">
          {p.accepted_materials?.slice(0, 3).map((m: string) => (
            <span key={m} className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[8px] font-black uppercase px-1">{m}</span>
          ))}
          {p.accepted_materials?.length > 3 && <span className="text-[8px] font-black text-zinc-400">+{p.accepted_materials.length - 3}</span>}
        </div>
      </div>
      
      <div className="mt-3 border-t-2 border-black pt-2 flex justify-between items-center">
        <div className="flex items-center gap-1">
           <Package size={14} className="text-zinc-400" />
           <span className="text-[10px] font-black uppercase text-zinc-500">{p.capacity_level}</span>
        </div>
        <Link href={`/admin/eco/pevs/${p.id}`} className="flex items-center justify-center gap-1 bg-black text-white px-2 py-1 text-[10px] font-black uppercase hover:bg-zinc-800">
          Gerenciar <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 h-screen flex flex-col overflow-hidden py-6 px-6 bg-zinc-50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-zinc-900 flex items-center gap-3">
            PEVs Experimentais
          </h1>
          <p className="text-zinc-600 font-bold text-lg">Pontos pequenos, testáveis e seguros antes de virar estrutura permanente.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/eco/pev" className="border-4 border-black p-3 bg-white text-black font-black uppercase text-sm hover:bg-zinc-100 flex items-center gap-2">
            Dashboard Operacional <ArrowRight size={18} />
          </Link>
          <Link href="/admin/eco/pevs/novo" className="border-4 border-black p-3 bg-emerald-500 text-black font-black uppercase text-sm hover:bg-emerald-400 flex items-center gap-2">
            <PlusCircle size={18} /> Novo PEV Experimental
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 shrink-0">
        <div className="border-4 border-black p-3 bg-zinc-200 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[10px] font-black uppercase text-zinc-500">Rascunhos</p>
          <p className="text-2xl font-black">{summary.draft || 0}</p>
        </div>
        <div className="border-4 border-black p-3 bg-blue-100 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[10px] font-black uppercase text-blue-800">Em Avaliação</p>
          <p className="text-2xl font-black">{summary.evaluating || 0}</p>
        </div>
        <div className="border-4 border-black p-3 bg-yellow-200 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[10px] font-black uppercase text-yellow-800">Aprovados</p>
          <p className="text-2xl font-black">{summary.approved || 0}</p>
        </div>
        <div className="border-4 border-black p-3 bg-emerald-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[10px] font-black uppercase text-emerald-200">Ativos em Teste</p>
          <p className="text-2xl font-black">{summary.active_test || 0}</p>
        </div>
        <div className="border-4 border-black p-3 bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[10px] font-black uppercase text-zinc-400">Convertidos</p>
          <p className="text-2xl font-black">{summary.converted || 0}</p>
        </div>
        <div className="border-4 border-black p-3 bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,128,0,0.5)]">
          <p className="text-[10px] font-black uppercase text-emerald-400">Total Experimentos</p>
          <p className="text-2xl font-black">{summary.experimental || 0}</p>
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
          <div className="flex-shrink-0 w-72 bg-zinc-100 border-4 border-black flex flex-col">
            <div className="bg-zinc-300 text-black p-3 font-black uppercase text-xs border-b-4 border-black flex justify-between items-center">
              <span className="flex items-center gap-2"><ClipboardList size={14} /> 1. Rascunho</span>
              <span className="bg-black text-white px-2 py-0.5 rounded-full text-[10px]">{groups.draft.length}</span>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1 thin-scrollbar">
              {groups.draft.map(p => <PevCard key={p.id} p={p} />)}
              {groups.draft.length === 0 && <p className="text-[10px] font-bold text-zinc-400 text-center py-10 uppercase italic">Vazio</p>}
            </div>
          </div>

          {/* Col: Avaliação */}
          <div className="flex-shrink-0 w-72 bg-zinc-100 border-4 border-black flex flex-col">
            <div className="bg-blue-200 text-black p-3 font-black uppercase text-xs border-b-4 border-black flex justify-between items-center">
              <span className="flex items-center gap-2"><Search size={14} /> 2. Avaliação</span>
              <span className="bg-black text-white px-2 py-0.5 rounded-full text-[10px]">{groups.evaluating.length}</span>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1 thin-scrollbar">
              {groups.evaluating.map(p => <PevCard key={p.id} p={p} />)}
            </div>
          </div>

          {/* Col: Aprovado */}
          <div className="flex-shrink-0 w-72 bg-zinc-100 border-4 border-black flex flex-col">
            <div className="bg-yellow-200 text-black p-3 font-black uppercase text-xs border-b-4 border-black flex justify-between items-center">
              <span className="flex items-center gap-2"><Clock size={14} /> 3. Aprovado</span>
              <span className="bg-black text-white px-2 py-0.5 rounded-full text-[10px]">{groups.approved.length}</span>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1 thin-scrollbar">
              {groups.approved.map(p => <PevCard key={p.id} p={p} />)}
            </div>
          </div>

          {/* Col: Ativo */}
          <div className="flex-shrink-0 w-72 bg-zinc-100 border-4 border-black flex flex-col">
            <div className="bg-emerald-200 text-black p-3 font-black uppercase text-xs border-b-4 border-black flex justify-between items-center">
              <span className="flex items-center gap-2"><TrendingUp size={14} /> 4. Em Teste</span>
              <span className="bg-black text-white px-2 py-0.5 rounded-full text-[10px]">{groups.active.length}</span>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1 thin-scrollbar">
              {groups.active.map(p => <PevCard key={p.id} p={p} />)}
            </div>
          </div>

          {/* Col: Pausado */}
          <div className="flex-shrink-0 w-72 bg-zinc-100 border-4 border-black flex flex-col">
            <div className="bg-red-100 text-black p-3 font-black uppercase text-xs border-b-4 border-black flex justify-between items-center">
              <span className="flex items-center gap-2"><AlertCircle size={14} /> 5. Pausado</span>
              <span className="bg-black text-white px-2 py-0.5 rounded-full text-[10px]">{groups.paused.length}</span>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1 thin-scrollbar">
              {groups.paused.map(p => <PevCard key={p.id} p={p} />)}
            </div>
          </div>

          {/* Col: Convertido */}
          <div className="flex-shrink-0 w-72 bg-zinc-100 border-4 border-black flex flex-col">
            <div className="bg-zinc-800 text-white p-3 font-black uppercase text-xs border-b-4 border-black flex justify-between items-center">
              <span className="flex items-center gap-2"><CheckCircle2 size={14} /> 6. Convertido</span>
              <span className="bg-white text-black px-2 py-0.5 rounded-full text-[10px]">{groups.converted.length}</span>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1 thin-scrollbar opacity-60">
              {groups.converted.map(p => <PevCard key={p.id} p={p} />)}
            </div>
          </div>

        </div>
      )}

      {/* Microcopy footer */}
      <div className="bg-zinc-900 text-zinc-400 p-2 text-center text-[10px] font-black uppercase tracking-widest shrink-0">
        &quot;PEV ativo não é propaganda. É compromisso de cuidado coletivo.&quot;
      </div>
    </div>
  );
}
