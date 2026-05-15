'use client';

import { useEffect, useState } from 'react';
import { 
  MapPin, 
  Clock, 
  Shield, 
  Info, 
  Search, 
  ChevronRight, 
  AlertTriangle,
  Package,
  CheckCircle2
} from "lucide-react";
import Link from "next/link";

export default function PublicPevListPage() {
  const [pevs, setPevs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ neighborhood: '', material: '' });

  async function fetchPevs() {
    setLoading(true);
    try {
      const url = new URL('/api/eco/pevs/public', window.location.origin);
      if (filter.neighborhood) url.searchParams.set('neighborhood', filter.neighborhood);
      if (filter.material) url.searchParams.set('material', filter.material);
      
      const res = await fetch(url);
      const data = await res.json();
      setPevs(data || []);
    } catch (err) {
      console.error("Error fetching public PEVs:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPevs();
  }, [filter]);

  const materials = [
    { id: 'cardboard', label: 'Papelão' },
    { id: 'plastic', label: 'Plástico' },
    { id: 'metal', label: 'Metal' },
    { id: 'glass', label: 'Vidro' },
    { id: 'cooking_oil', label: 'Óleo' },
    { id: 'electronics', label: 'E-lixo' }
  ];

  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-6 space-y-12">
      <div className="max-w-4xl mx-auto text-center space-y-4">
        <h1 className="stencil-text text-5xl tracking-tighter">PONTOS ECO DE ENTREGA</h1>
        <p className="text-zinc-600 font-bold text-lg uppercase">
          Locais onde a comunidade pode entregar recicláveis com regra, cuidado e transparência.
        </p>
      </div>

      {/* Filters */}
      <div className="max-w-4xl mx-auto flex flex-wrap gap-4 justify-center">
         <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input 
              placeholder="Buscar por bairro..."
              value={filter.neighborhood}
              onChange={e => setFilter({...filter, neighborhood: e.target.value})}
              className="pl-10 pr-4 py-2 border-4 border-black font-black uppercase text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
         </div>
         <div className="flex flex-wrap gap-2">
            {materials.map(m => (
              <button 
                key={m.id}
                onClick={() => setFilter({...filter, material: filter.material === m.id ? '' : m.id})}
                className={`px-3 py-1 border-2 border-black text-[10px] font-black uppercase transition-colors ${filter.material === m.id ? 'bg-black text-white' : 'bg-white text-zinc-400'}`}
              >
                {m.label}
              </button>
            ))}
         </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full text-center py-20 animate-pulse font-black uppercase tracking-widest">
            Buscando pontos ativos...
          </div>
        ) : pevs.map(p => (
          <div key={p.id} className="bg-white border-4 border-black p-6 flex flex-col justify-between space-y-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1">
             <div className="space-y-4">
                <div className="flex justify-between items-start">
                   <span className="bg-emerald-500 text-black px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black">
                     {p.experiment_status === 'active_test' ? 'Teste Experimental' : 'Ponto Verificado'}
                   </span>
                   <span className="text-[10px] font-black uppercase text-zinc-400">{p.neighborhood}</span>
                </div>
                
                <h3 className="text-xl font-black uppercase tracking-tighter leading-none">{p.partner_display_name}</h3>
                
                <div className="space-y-2">
                   <div className="flex items-start gap-2">
                      <MapPin size={16} className="text-zinc-400 shrink-0" />
                      <p className="text-xs font-bold uppercase">
                        {p.address_public_level === 'full_public' ? p.address_text : `Bairro: ${p.neighborhood}`}
                      </p>
                   </div>
                   <div className="flex items-start gap-2">
                      <Clock size={16} className="text-zinc-400 shrink-0" />
                      <p className="text-xs font-bold uppercase whitespace-pre-wrap">{p.opening_rules}</p>
                   </div>
                   <div className="flex items-start gap-2 text-emerald-600">
                      <Package size={16} className="shrink-0" />
                      <div className="flex flex-wrap gap-1">
                         {p.accepted_materials?.map((m: string) => (
                           <span key={m} className="bg-emerald-50 px-1 text-[10px] font-black uppercase">{m}</span>
                         ))}
                      </div>
                   </div>
                </div>
             </div>

             <div className="bg-zinc-100 p-4 border-2 border-black space-y-2">
                <h4 className="text-[10px] font-black uppercase flex items-center gap-1">
                   <Shield size={12} /> Regras de Segurança
                </h4>
                <p className="text-[10px] font-bold uppercase italic leading-tight text-zinc-600">
                  {p.safety_rules}
                </p>
             </div>

             <div className="pt-4 border-t-2 border-black flex justify-between items-center">
                <Link href={`/t/pev/${p.slug}`} className="text-xs font-black uppercase underline hover:text-emerald-600 transition-colors">
                  Ver Transparência
                </Link>
                <ChevronRight size={20} />
             </div>
          </div>
        ))}
      </div>

      {!loading && pevs.length === 0 && (
        <div className="max-w-md mx-auto text-center py-20 space-y-4">
           <AlertTriangle size={48} className="mx-auto text-zinc-300" />
           <p className="font-black uppercase text-zinc-400 italic">Nenhum PEV ativo encontrado com estes filtros.</p>
        </div>
      )}

      {/* Warnings & Footer */}
      <div className="max-w-4xl mx-auto space-y-8 pt-12">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card border-dashed border-4 border-zinc-200 p-6 space-y-3">
               <h4 className="font-black uppercase text-sm">PEV não é lixeira</h4>
               <p className="text-xs font-bold uppercase text-zinc-500 leading-relaxed">
                 Confira as regras antes de levar o material. Não deixe material fora do horário ou na calçada. 
                 Se o ponto estiver cheio, avise a equipe ECO.
               </p>
            </div>
            <div className="card border-dashed border-4 border-emerald-200 p-6 space-y-3">
               <h4 className="font-black uppercase text-sm text-emerald-800">Quero sugerir um PEV</h4>
               <p className="text-xs font-bold uppercase text-emerald-600 leading-relaxed">
                 Sua loja, condomínio ou associação pode ser um ponto ECO? 
                 <Link href="/começar" className="underline ml-1">Inicie uma avaliação aqui.</Link>
               </p>
            </div>
         </div>
         
         <div className="text-center py-10 border-t-4 border-black">
            <p className="stencil-text text-2xl mb-2 opacity-20">COOP ECO</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Cuidado Coletivo • Transparência Real • Recibo é Lei
            </p>
         </div>
      </div>
    </div>
  );
}
