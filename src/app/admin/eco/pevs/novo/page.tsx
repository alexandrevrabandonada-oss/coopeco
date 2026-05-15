'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Info, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function AdminNewPevPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  
  const source_zone_id = searchParams.get('source_zone_id');
  const source_route_id = searchParams.get('source_route_id');
  const neighborhood_hint = searchParams.get('neighborhood');

  const [formData, setFormData] = useState({
    name: '',
    partner_display_name: '',
    neighborhood: neighborhood_hint || '',
    city: 'Volta Redonda',
    pev_mode: 'experimental',
    experiment_status: 'draft',
    accepted_materials: [] as string[],
    rejected_materials: [] as string[],
    opening_rules: '',
    safety_rules: '',
    public_visibility: 'private',
    address_public_level: 'neighborhood',
    capacity_level: 'small',
    needs_pickup_frequency: 'unknown',
    source_zone_id: source_zone_id || null,
    source_route_id: source_route_id || null,
    cell_id: '' // Will be set in API via user profile usually, but we should fetch it if needed
  });

  const materialOptions = [
    { id: 'cardboard', label: 'Papelão' },
    { id: 'paper', label: 'Papel' },
    { id: 'plastic', label: 'Plástico' },
    { id: 'metal', label: 'Metal' },
    { id: 'glass', label: 'Vidro' },
    { id: 'cooking_oil', label: 'Óleo de Cozinha' },
    { id: 'electronics', label: 'Eletrônicos' },
    { id: 'books', label: 'Livros' }
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/eco/pevs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        const data = await res.json();
        router.push(`/admin/eco/pevs/${data.id}`);
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error}`);
      }
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setLoading(false);
    }
  }

  const toggleMaterial = (id: string, list: 'accepted_materials' | 'rejected_materials') => {
    setFormData(prev => ({
      ...prev,
      [list]: prev[list].includes(id) 
        ? prev[list].filter(m => m !== id) 
        : [...prev[list], id]
    }));
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-6 space-y-8 bg-zinc-50 min-h-screen">
      <div className="flex justify-between items-center">
        <Link href="/admin/eco/pevs" className="flex items-center gap-1 text-[10px] font-black uppercase text-zinc-500 hover:text-black transition-colors">
          <ArrowLeft size={12} /> Voltar
        </Link>
        <h1 className="stencil-text text-3xl">Novo PEV Experimental</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Basic Info */}
          <section className="bg-white border-4 border-black p-6 space-y-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
             <h2 className="font-black uppercase text-sm border-b-2 border-black pb-1">Identificação</h2>
             
             <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-zinc-400">Nome Interno</label>
                  <input 
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: PEV Teste Praça do Vidro"
                    className="w-full border-2 border-black p-2 text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-zinc-400">Nome Público (Parceiro)</label>
                  <input 
                    required
                    value={formData.partner_display_name}
                    onChange={e => setFormData({...formData, partner_display_name: e.target.value})}
                    placeholder="Ex: Mercearia do Zé"
                    className="w-full border-2 border-black p-2 text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-zinc-400">Bairro</label>
                    <input 
                      required
                      value={formData.neighborhood}
                      onChange={e => setFormData({...formData, neighborhood: e.target.value})}
                      className="w-full border-2 border-black p-2 text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-zinc-400">Cidade</label>
                    <input 
                      disabled
                      value={formData.city}
                      className="w-full border-2 border-black p-2 text-sm font-bold uppercase bg-zinc-100"
                    />
                  </div>
                </div>
             </div>
          </section>

          {/* Operational Config */}
          <section className="bg-white border-4 border-black p-6 space-y-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
             <h2 className="font-black uppercase text-sm border-b-2 border-black pb-1">Configuração Operacional</h2>
             
             <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-zinc-400">Capacidade Volumétrica</label>
                  <select 
                    value={formData.capacity_level}
                    onChange={e => setFormData({...formData, capacity_level: e.target.value as any})}
                    className="w-full border-2 border-black p-2 text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="small">Pequena (até 5 bags)</option>
                    <option value="medium">Média (até 15 bags)</option>
                    <option value="large">Grande (container/galpão)</option>
                    <option value="unknown">Não definida</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-zinc-400">Frequência de Retirada Esperada</label>
                  <select 
                    value={formData.needs_pickup_frequency}
                    onChange={e => setFormData({...formData, needs_pickup_frequency: e.target.value as any})}
                    className="w-full border-2 border-black p-2 text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quinzenal</option>
                    <option value="monthly">Mensal</option>
                    <option value="on_demand">Sob demanda</option>
                    <option value="unknown">Desconhecida</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-zinc-400">Visibilidade Inicial</label>
                  <select 
                    value={formData.public_visibility}
                    onChange={e => setFormData({...formData, public_visibility: e.target.value as any})}
                    className="w-full border-2 border-black p-2 text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="private">Privado (Sempre Oculto)</option>
                    <option value="listed">Listado (Busca mas sem Mapa)</option>
                    <option value="public_map">Público (Mapa + Listagem)</option>
                  </select>
                </div>
             </div>
          </section>

          {/* Materials */}
          <section className="bg-white border-4 border-black p-6 space-y-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:col-span-2">
             <h2 className="font-black uppercase text-sm border-b-2 border-black pb-1">O que aceita / O que não aceita</h2>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                   <p className="text-[10px] font-black uppercase text-emerald-600">Materiais Aceitos</p>
                   <div className="flex flex-wrap gap-2">
                      {materialOptions.map(m => (
                        <button 
                          key={m.id}
                          type="button"
                          onClick={() => toggleMaterial(m.id, 'accepted_materials')}
                          className={`px-3 py-1 border-2 border-black text-[10px] font-black uppercase transition-colors ${formData.accepted_materials.includes(m.id) ? 'bg-emerald-500 text-black' : 'bg-white text-zinc-400'}`}
                        >
                          {m.label}
                        </button>
                      ))}
                   </div>
                </div>
                <div className="space-y-2">
                   <p className="text-[10px] font-black uppercase text-red-600">Materiais Rejeitados</p>
                   <div className="flex flex-wrap gap-2">
                      {materialOptions.map(m => (
                        <button 
                          key={m.id}
                          type="button"
                          onClick={() => toggleMaterial(m.id, 'rejected_materials')}
                          className={`px-3 py-1 border-2 border-black text-[10px] font-black uppercase transition-colors ${formData.rejected_materials.includes(m.id) ? 'bg-red-500 text-white' : 'bg-white text-zinc-400'}`}
                        >
                          {m.label}
                        </button>
                      ))}
                   </div>
                </div>
             </div>
          </section>

          {/* Rules */}
          <section className="bg-white border-4 border-black p-6 space-y-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:col-span-2">
             <h2 className="font-black uppercase text-sm border-b-2 border-black pb-1">Regras de Operação</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-zinc-400">Horários e Regras de Entrega</label>
                  <textarea 
                    value={formData.opening_rules}
                    onChange={e => setFormData({...formData, opening_rules: e.target.value})}
                    placeholder="Ex: Seg-Sex das 8h às 18h. Material deve estar limpo."
                    rows={4}
                    className="w-full border-2 border-black p-2 text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-zinc-400">Regras de Segurança</label>
                  <textarea 
                    value={formData.safety_rules}
                    onChange={e => setFormData({...formData, safety_rules: e.target.value})}
                    placeholder="Ex: Vidro embalado em papelão. Óleo em pet fechado."
                    rows={4}
                    className="w-full border-2 border-black p-2 text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
             </div>
          </section>

        </div>

        <div className="bg-zinc-900 p-6 border-4 border-black flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-3 text-emerald-400">
              <Info size={24} />
              <p className="text-[10px] font-black uppercase leading-tight max-w-md">
                PEV Experimental deve começar pequeno. Aceite apenas o que consegue cuidar. 
                Selo ECO só vem com rotina e transparência.
              </p>
           </div>
           <button 
             disabled={loading}
             className="w-full md:w-auto bg-emerald-500 text-black px-10 py-4 font-black uppercase text-sm border-4 border-black hover:bg-emerald-400 disabled:opacity-50 flex items-center justify-center gap-2"
           >
             {loading ? 'Salvando...' : <><Save size={20} /> Salvar e Iniciar Ciclo</>}
           </button>
        </div>
      </form>
    </div>
  );
}
