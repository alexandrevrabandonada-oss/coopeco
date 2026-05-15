import { createClient } from "@/lib/supabase"

const supabase = createClient()

export type RecyclingDemand = {
  id?: string
  city?: string
  neighborhood: string
  cell_id?: string | null
  
  participant_type: 'resident' | 'commerce' | 'condominium' | 'school' | 'church' | 'association' | 'public_space' | 'other'
  material_types: string[]
  volume_level: 'small_bag' | 'big_bag' | 'box' | 'many_boxes' | 'commercial_volume' | 'unknown'
  frequency: 'once' | 'weekly' | 'biweekly' | 'monthly' | 'recurring_unknown'
  preference: 'dropoff_pev' | 'pickup_request' | 'both' | 'guidance_only'
  main_problem?: string | null
  
  can_be_pev?: boolean
  can_volunteer?: boolean
  is_recurring_generator?: boolean
  
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  consent_contact?: boolean
  consent_public_aggregate?: boolean
  
  address_hint?: string | null
  lat?: number | null
  lng?: number | null
  
  status?: 'new' | 'triaged' | 'contacted' | 'mapped' | 'converted_to_route' | 'converted_to_pev_candidate' | 'archived'
  operator_notes?: string | null
  source?: string
  ref_code?: string | null

  // D02 Operational Fields
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  next_action?: string | null
  next_action_at?: string | null
  contacted_at?: string | null
  converted_at?: string | null
  route_candidate?: boolean
  pev_candidate?: boolean
  estimated_weekly_volume_score?: number
  operator_assigned_to?: string | null
  last_operator_action_at?: string | null
  
  created_at?: string
  updated_at?: string
}

export type RecyclingDemandEvent = {
  id?: string
  demand_id: string
  created_at?: string
  event_type: string
  old_value?: string | null
  new_value?: string | null
  note?: string | null
  actor_id?: string | null
}

export type RecyclingDemandRollup = {
  city: string
  neighborhood: string
  material_type: string
  preference: string
  participant_type: string
  total_demands: number
  recurring_generators: number
  possible_pevs: number
  pickup_interest: number
  dropoff_interest: number
  last_demand_at: string
}

export async function insertDemand(data: Partial<RecyclingDemand>) {
  // We use the normal client. If RLS is configured to allow anon insert, it will work.
  // Otherwise, the API route might need to use a service role key.
  const { data: result, error } = await supabase
    .from("eco_recycling_demands")
    .insert(data)
    .select()
    .single()
  
  if (error) throw error
  return result as RecyclingDemand
}

export async function getDemandRollup(filters?: { neighborhood?: string; material_type?: string; preference?: string }) {
  let query = supabase.from("eco_recycling_demand_rollup_public").select("*")
  
  if (filters?.neighborhood) query = query.eq("neighborhood", filters.neighborhood)
  if (filters?.material_type) query = query.eq("material_type", filters.material_type)
  if (filters?.preference) query = query.eq("preference", filters.preference)

  const { data, error } = await query
  if (error) throw error
  return data as RecyclingDemandRollup[]
}

export async function getAdminDemands(filters?: { 
  status?: string; 
  neighborhood?: string;
  priority?: string;
  route_candidate?: string;
  pev_candidate?: string;
}) {
  let query = supabase.from("eco_recycling_demands").select("*").order("created_at", { ascending: false })
  
  if (filters?.status) query = query.eq("status", filters.status)
  if (filters?.neighborhood) query = query.eq("neighborhood", filters.neighborhood)
  if (filters?.priority) query = query.eq("priority", filters.priority)
  if (filters?.route_candidate === 'true') query = query.eq("route_candidate", true)
  if (filters?.pev_candidate === 'true') query = query.eq("pev_candidate", true)

  const { data, error } = await query
  if (error) throw error
  return data as RecyclingDemand[]
}

export async function updateDemandStatus(id: string, updates: Partial<RecyclingDemand>, actorId?: string, note?: string) {
  // First, fetch the current state if we are logging changes (simplification for MVP: we just log a generic update if old state isn't tracked tightly here, but ideally we fetch first)
  const { data: current } = await supabase.from("eco_recycling_demands").select("status, priority").eq("id", id).single()

  const { data, error } = await supabase
    .from("eco_recycling_demands")
    .update({ ...updates, updated_at: new Date().toISOString(), last_operator_action_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
  
  if (error) throw error

  // Log event if status or priority changed
  if (current) {
    if (updates.status && updates.status !== current.status) {
      await insertDemandEvent({ demand_id: id, event_type: 'status_changed', old_value: current.status, new_value: updates.status, note, actor_id: actorId })
    }
    if (updates.priority && updates.priority !== current.priority) {
      await insertDemandEvent({ demand_id: id, event_type: 'priority_changed', old_value: current.priority, new_value: updates.priority, note, actor_id: actorId })
    }
  }

  return data as RecyclingDemand
}

export async function insertDemandEvent(event: RecyclingDemandEvent) {
  const { error } = await supabase.from("eco_recycling_demand_events").insert(event)
  if (error) throw error
}

export async function getDemandEvents(demandId: string) {
  const { data, error } = await supabase
    .from("eco_recycling_demand_events")
    .select("*")
    .eq("demand_id", demandId)
    .order("created_at", { ascending: false })
  
  if (error) throw error
  return data as RecyclingDemandEvent[]
}

export function calculateDemandPriorityScore(demand: Partial<RecyclingDemand>) {
  let score = 0
  
  if (demand.is_recurring_generator) score += 3
  if (demand.participant_type === 'commerce' || demand.participant_type === 'condominium') score += 3
  if (demand.preference === 'both') score += 2
  if (demand.preference === 'pickup_request') score += 2
  if (demand.can_be_pev) score += 2
  if (demand.can_volunteer) score += 1
  if (demand.volume_level === 'many_boxes') score += 1
  if (demand.volume_level === 'commercial_volume') score += 2
  if (demand.consent_contact) score += 1

  let priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
  if (score <= 2) priority = 'low'
  else if (score <= 5) priority = 'normal'
  else if (score <= 8) priority = 'high'
  else priority = 'urgent'

  return { score, priority }
}

export function getWhatsAppTemplate(type: 'first_contact' | 'guidance' | 'pev_candidate', demand?: Partial<RecyclingDemand>) {
  switch (type) {
    case 'first_contact':
      return `Olá${demand?.contact_name ? ` ${demand.contact_name}` : ''}! Aqui é da Associação Popular pela Sustentabilidade / ECO. Recebemos seu cadastro no Mapa da Demanda de Recicláveis em Volta Redonda. Obrigado por ajudar a cidade a se organizar. Só para confirmar: você tem material reciclável com que frequência e prefere entregar em um PEV ou solicitar coleta quando houver rota no seu bairro?`
    case 'guidance':
      return `Obrigado por participar do ECO${demand?.contact_name ? ` ${demand.contact_name}` : ''}. Neste primeiro momento, o cadastro não garante coleta imediata. Estamos mapeando a demanda por bairro para organizar rotas, PEVs e parcerias com cooperativas. Seu cadastro ajuda muito nessa construção.`
    case 'pev_candidate':
      return `Olá${demand?.contact_name ? ` ${demand.contact_name}` : ''}, vimos que você marcou que seu local pode ser um Ponto de Entrega Voluntária. Podemos conversar melhor sobre espaço, horários, tipos de material e cuidados básicos? A ideia é começar pequeno, com organização e segurança.`
    default:
      return ""
  }
}
