export interface DemandMapInternal {
  id: string;
  created_at: string;
  city: string;
  neighborhood: string;
  participant_type: string;
  material_types: string[];
  volume_level: string;
  frequency: string;
  preference: string;
  status: string;
  priority: string;
  route_candidate: boolean;
  pev_candidate: boolean;
  is_recurring_generator: boolean;
  can_be_pev: boolean;
  can_volunteer: boolean;
  consent_contact: boolean;
  geo_precision: string;
  geo_status: string;
  geo_lat: number | null;
  geo_lng: number | null;
}

export interface NeighborhoodStats {
  neighborhood: string;
  total: number;
  route_candidates: number;
  pev_candidates: number;
  recurring_generators: number;
  top_materials: string[];
  dominant_preference: string;
  suggested_action: string;
}

export function groupDemandsByNeighborhood(demands: DemandMapInternal[]): NeighborhoodStats[] {
  const groups: Record<string, DemandMapInternal[]> = {};

  demands.forEach(d => {
    if (!groups[d.neighborhood]) groups[d.neighborhood] = [];
    groups[d.neighborhood].push(d);
  });

  return Object.keys(groups).map(neighborhood => {
    const items = groups[neighborhood];
    const total = items.length;
    const route_candidates = items.filter(i => i.route_candidate).length;
    const pev_candidates = items.filter(i => i.pev_candidate || i.can_be_pev).length;
    const recurring_generators = items.filter(i => i.is_recurring_generator).length;
    
    // Top materials
    const materialsCount: Record<string, number> = {};
    items.forEach(i => {
      (i.material_types || []).forEach(m => {
        materialsCount[m] = (materialsCount[m] || 0) + 1;
      });
    });
    const top_materials = Object.keys(materialsCount)
      .sort((a, b) => materialsCount[b] - materialsCount[a])
      .slice(0, 3);

    // Dominant preference
    const prefCount: Record<string, number> = {};
    items.forEach(i => {
      if (i.preference) {
        prefCount[i.preference] = (prefCount[i.preference] || 0) + 1;
      }
    });
    let dominant_preference = 'unknown';
    let maxPref = 0;
    Object.keys(prefCount).forEach(p => {
      if (prefCount[p] > maxPref) {
        maxPref = prefCount[p];
        dominant_preference = p;
      }
    });

    const dropoff_interest = items.filter(i => i.preference === 'dropoff_pev' || i.preference === 'both').length;
    const guidance_only = items.filter(i => i.preference === 'guidance_only').length;

    // Suggested action
    let suggested_action = "aguardar mais cadastros";
    if (total >= 10 && route_candidates >= 3) {
      suggested_action = "avaliar rota piloto";
    } else if (pev_candidates >= 1 && dropoff_interest >= 5) {
      suggested_action = "avaliar PEV";
    } else if (guidance_only > (total / 2) && total >= 5) {
      suggested_action = "fazer educação ambiental";
    } else if (recurring_generators > 0) {
      suggested_action = "contatar geradores recorrentes";
    }

    return {
      neighborhood,
      total,
      route_candidates,
      pev_candidates,
      recurring_generators,
      top_materials,
      dominant_preference,
      suggested_action
    };
  }).sort((a, b) => b.total - a.total);
}
