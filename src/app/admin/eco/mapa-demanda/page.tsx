'use client';

import { useEffect, useState } from 'react';
import { EcoDemandMapInternal } from '@/components/eco/EcoDemandMapInternal';
import { groupDemandsByNeighborhood, NeighborhoodStats, DemandMapInternal } from '@/lib/eco/ecoGeoUtils';
import { Map, MapPin, AlertCircle, TrendingUp, Search, Download, Truck, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from "next/link";

export default function EcoMapAdminPage() {
  const [demands, setDemands] = useState<DemandMapInternal[]>([]);
  const [stats, setStats] = useState<NeighborhoodStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/admin/eco/recycling-demands/map');
        if (!res.ok) throw new Error('Failed to fetch map data');
        const data = await res.json();
        setDemands(data.items);
        setStats(groupDemandsByNeighborhood(data.items));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-zinc-500 animate-pulse">Carregando mapa territorial...</div>;
  }

  const totalGeocoded = demands.filter(d => d.geo_lat && d.geo_lng).length;
  const routeCandidates = demands.filter(d => d.route_candidate).length;
  const pevCandidates = demands.filter(d => d.pev_candidate).length;

  const router = useRouter();

  async function createRouteFromNeighborhood(stats: NeighborhoodStats) {
    const title = `Rota Piloto — ${stats.neighborhood}`;
    const materials = stats.top_materials;
    const estimated_stops = stats.total;

    try {
      const res = await fetch('/api/admin/eco/pilot-routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          neighborhood: stats.neighborhood,
          material_focus: materials,
          estimated_stops,
          status: 'draft'
        })
      });

      if (res.ok) {
        const route = await res.json();
        router.push(`/admin/eco/rotas-piloto/${route.id}`);
      }
    } catch (err) {
      console.error("Error creating route:", err);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <Map className="w-8 h-8 text-emerald-600" />
            Mapa Interno da Demanda
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Enxergue concentração territorial para decidir rota piloto, PEV experimental e contato prioritário.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/eco/rotas-piloto" className="bg-black text-white px-4 py-2 text-sm font-black uppercase border-2 border-black hover:bg-zinc-800 transition-colors">
            Ir para Rotas Piloto
          </Link>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3 text-amber-800 text-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <div>
          <strong className="block mb-1">Privacidade vem antes da eficiência.</strong>
          Mapa interno. Não compartilhe prints com dados sensíveis. Este mapa ajuda a decidir onde agir primeiro, mas não substitui conversa com a comunidade.
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Total Demandas</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white">{demands.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Com Localização</p>
          <p className="text-3xl font-bold text-emerald-600">{totalGeocoded}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Candidatas a Rota</p>
          <p className="text-3xl font-bold text-blue-600">{routeCandidates}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Candidatas a PEV</p>
          <p className="text-3xl font-bold text-purple-600">{pevCandidates}</p>
        </div>
      </div>

      {/* Main Map Content */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <h2 className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <MapPin className="w-5 h-5" /> Distribuição Territorial
          </h2>
        </div>
        <div className="relative">
           <EcoDemandMapInternal demands={demands} />
        </div>
      </div>

      {/* Leitura por Bairro */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" /> Leitura por Bairro
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-zinc-500 dark:text-zinc-400">
            <thead className="text-xs text-zinc-700 uppercase bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-6 py-3">Bairro</th>
                <th className="px-6 py-3">Total</th>
                <th className="px-6 py-3">Materiais Dominantes</th>
                <th className="px-6 py-3">Cand. Rota</th>
                <th className="px-6 py-3">Ação Sugerida</th>
                <th className="px-6 py-3 text-right">Operação</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.neighborhood} className="bg-white border-b dark:bg-zinc-900 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white whitespace-nowrap">
                    {s.neighborhood}
                  </td>
                  <td className="px-6 py-4 font-bold text-emerald-600">{s.total}</td>
                  <td className="px-6 py-4">{s.top_materials.join(', ')}</td>
                  <td className="px-6 py-4">{s.route_candidates > 0 ? <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">{s.route_candidates}</span> : '-'}</td>
                  <td className="px-6 py-4">
                    <span className="font-medium bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                      {s.suggested_action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => createRouteFromNeighborhood(s)}
                        className="bg-zinc-900 text-white px-3 py-1 text-[10px] font-black uppercase border-2 border-black hover:bg-zinc-700 transition-colors flex items-center gap-1"
                      >
                        Criar Rota <Truck size={12} />
                      </button>
                      <Link 
                        href={`/admin/eco/pevs/novo?neighborhood=${encodeURIComponent(s.neighborhood)}`}
                        className="bg-white text-emerald-800 px-3 py-1 text-[10px] font-black uppercase border-2 border-emerald-800 hover:bg-emerald-50 transition-colors flex items-center gap-1"
                      >
                        Avaliar PEV <ChevronRight size={12} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">Nenhum dado agregado encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

