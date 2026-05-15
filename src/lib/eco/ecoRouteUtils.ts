export interface PilotRoute {
  id: string;
  title: string;
  status: string;
  planned_date: string | null;
  time_window_start: string | null;
  time_window_end: string | null;
  material_focus: string[];
  operator_name: string | null;
  estimated_stops: number;
  estimated_cost_brl: number | null;
}

export interface RouteReadiness {
  score: number;
  missing_items: string[];
  warnings: string[];
  can_schedule: boolean;
}

export function getPilotRouteReadiness(route: PilotRoute, actualStopsCount: number): RouteReadiness {
  const missing_items: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  if (!route.planned_date) {
    missing_items.push("Data da rota");
    score -= 20;
  }
  
  if (!route.time_window_start || !route.time_window_end) {
    missing_items.push("Janela de horário");
    score -= 20;
  }

  if (!route.material_focus || route.material_focus.length === 0) {
    missing_items.push("Material prioritário");
    score -= 20;
  }

  if (actualStopsCount === 0) {
    missing_items.push("Demandas (paradas)");
    score -= 20;
  } else if (actualStopsCount < 3) {
    warnings.push("Rota pequena demais (mínimo sugerido: 3 paradas)");
  } else if (actualStopsCount > 20) {
    warnings.push("Rota grande demais para um piloto (sugerido: máximo 20 paradas)");
  }

  if (!route.operator_name) {
    missing_items.push("Operador definido");
    score -= 20;
  }

  if (!route.estimated_cost_brl) {
    warnings.push("Falta custo estimado");
  }

  const can_schedule = missing_items.length === 0 && actualStopsCount >= 3;

  return {
    score: Math.max(0, score),
    missing_items,
    warnings,
    can_schedule
  };
}

export const PILOT_ROUTE_MESSAGES = {
  confirmation: (date: string, start: string, end: string) => 
    `Olá! Aqui é da Associação Popular pela Sustentabilidade / ECO. Estamos organizando uma rota piloto de recicláveis no seu bairro. Você cadastrou uma demanda no Mapa da Demanda ECO. Podemos confirmar se você ainda tem esse material e se estaria disponível no dia ${date}, entre ${start} e ${end}?`,
  
  honesty: "Essa é uma rota piloto, não uma coleta fixa ainda. Estamos testando a viabilidade por bairro para organizar PEVs, rotas comunitárias e parcerias com cooperativas.",
  
  preparation: "Para ajudar a coleta: separe o material seco, evite misturar com lixo orgânico e, se tiver vidro, deixe bem protegido para evitar acidente.",
  
  not_included: "Seu cadastro continua no nosso mapa. Esta primeira rota será pequena para teste, mas os dados ajudam a planejar as próximas ações no bairro."
};
