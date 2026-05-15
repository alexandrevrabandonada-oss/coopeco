'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { DemandMapInternal } from '@/lib/eco/ecoGeoUtils';

// Leaflet needs to be dynamically imported because it uses window
const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then((mod) => mod.CircleMarker), { ssr: false });

export function EcoDemandMapInternal({ demands }: { demands: DemandMapInternal[] }) {
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    // Fix leaflet marker icon issue in Next.js
    import('leaflet').then((leaflet) => {
      setL(leaflet);
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl: '/leaflet/marker-icon.png',
        shadowUrl: '/leaflet/marker-shadow.png',
      });
    });
  }, []);

  if (!L) return <div className="h-96 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-lg flex items-center justify-center">Carregando mapa...</div>;

  // Volta Redonda Center Approx
  const defaultCenter: [number, number] = [-22.5112, -44.0934];

  // Group demands for neighborhood precision when no exact geo
  const neighborhoodGroups: Record<string, DemandMapInternal[]> = {};
  
  demands.forEach(d => {
    if (d.geo_lat && d.geo_lng) {
      // Use coordinate directly but we will check precision in rendering
    } else {
      if (!neighborhoodGroups[d.neighborhood]) neighborhoodGroups[d.neighborhood] = [];
      neighborhoodGroups[d.neighborhood].push(d);
    }
  });

  // Base colors for markers
  const getMarkerColor = (d: DemandMapInternal) => {
    if (d.route_candidate) return '#10b981'; // emerald
    if (d.pev_candidate) return '#3b82f6'; // blue
    if (d.is_recurring_generator) return '#f59e0b'; // amber
    if (d.priority === 'urgent' || d.priority === 'high') return '#ef4444'; // red
    return '#6b7280'; // gray
  };

  return (
    <div className="h-[600px] w-full rounded-xl overflow-hidden border border-zinc-200 shadow-sm relative z-0">
      <MapContainer center={defaultCenter} zoom={13} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Render precise / approximate markers */}
        {demands.map(d => {
          if (!d.geo_lat || !d.geo_lng) return null;
          
          const isPrivate = d.geo_precision === 'exact_private';
          // Se for exato privado, podemos adicionar um offset minúsculo ou usar um círculo sem centro exato
          // Para visualização de mapa, usaremos CircleMarker que aparenta mais como "área aproximada"
          
          if (isPrivate) {
             return (
               <CircleMarker 
                  key={d.id}
                  center={[d.geo_lat, d.geo_lng]}
                  radius={12}
                  pathOptions={{ color: getMarkerColor(d), fillColor: getMarkerColor(d), fillOpacity: 0.4, weight: 2 }}
               >
                 <Popup>
                    <div className="p-2 space-y-2 max-w-xs">
                      <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit">Localização Privada</div>
                      <h4 className="font-bold">{d.participant_type}</h4>
                      <p className="text-sm">Bairro: {d.neighborhood}</p>
                      <p className="text-sm">Materiais: {d.material_types.join(', ')}</p>
                      <p className="text-sm">Volume: {d.volume_level} ({d.frequency})</p>
                      <div className="mt-2 pt-2 border-t">
                        <a href={`/admin/eco/demandas-reciclagem/${d.id}`} target="_blank" className="text-blue-600 text-sm hover:underline">Abrir Detalhe</a>
                      </div>
                    </div>
                 </Popup>
               </CircleMarker>
             )
          }

          // Exact or neighborhood geocoded with coordinates
          // We can use a standard CircleMarker as well for visual consistency, but maybe smaller
          return (
            <CircleMarker 
                key={d.id}
                center={[d.geo_lat, d.geo_lng]}
                radius={6}
                pathOptions={{ color: getMarkerColor(d), fillColor: getMarkerColor(d), fillOpacity: 0.8, weight: 2 }}
            >
              <Popup>
                  <div className="p-2 space-y-2 max-w-xs">
                    <h4 className="font-bold text-sm uppercase">{d.participant_type}</h4>
                    <p className="text-sm">Bairro: {d.neighborhood}</p>
                    <p className="text-sm">Status: <span className="font-semibold">{d.status}</span></p>
                    <div className="mt-2 pt-2 border-t">
                      <a href={`/admin/eco/demandas-reciclagem/${d.id}`} target="_blank" className="text-blue-600 text-sm hover:underline">Abrir Detalhe</a>
                    </div>
                  </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  );
}
