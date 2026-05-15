import { createClient } from "@/lib/supabase"

const supabase = createClient()

export type PevMode = 'experimental' | 'regular' | 'paused' | 'archived'
export type PevExperimentStatus = 'draft' | 'evaluating' | 'approved_for_test' | 'active_test' | 'paused' | 'failed' | 'converted_to_regular' | 'archived'
export type PevPublicVisibility = 'private' | 'listed' | 'public_map'
export type PevAddressPublicLevel = 'hidden' | 'neighborhood' | 'approximate' | 'full_public'
export type PevCapacityLevel = 'small' | 'medium' | 'large' | 'unknown'
export type PevStorageRiskLevel = 'low' | 'medium' | 'high'
export type PevPickupFrequency = 'weekly' | 'biweekly' | 'monthly' | 'on_demand' | 'unknown'

export type PevSite = {
  id: string
  cell_id: string
  name: string
  slug: string | null
  address_text: string | null
  neighborhood: string | null
  city: string
  state: string
  opening_hours: Record<string, string[]>
  accepted_materials: string[]
  blocked_materials: string[]
  status: 'draft' | 'active' | 'paused' | 'archived'
  public_transparency?: boolean
  created_at: string
  
  // ECO-D05 Fields
  pev_mode: PevMode
  experiment_status: PevExperimentStatus
  experiment_started_at: string | null
  experiment_ends_at: string | null
  source_zone_id: string | null
  source_demand_id: string | null
  source_route_id: string | null
  rejected_materials: string[]
  opening_rules: string | null
  safety_rules: string | null
  public_visibility: PevPublicVisibility
  partner_display_name: string | null
  partner_contact_public: boolean
  address_public_level: PevAddressPublicLevel
  capacity_level: PevCapacityLevel
  storage_risk_level: PevStorageRiskLevel
  needs_pickup_frequency: PevPickupFrequency
  last_collection_at: string | null
  last_entry_at: string | null
}

export type PevExperimentEvent = {
  id: string
  pev_site_id: string
  created_at: string
  event_type: string
  old_value: string | null
  new_value: string | null
  note: string | null
  actor_id: string | null
}

export type PevLot = {
  id: string
  cell_id: string
  pev_id: string
  code: string
  status: 'open' | 'closed' | 'sold' | 'paid' | 'archived'
  opened_at: string
  closed_at: string | null
  notes: string | null
  // PEV-02 Fields
  destination_name?: string | null
  destination_type?: 'cooperative' | 'buyer' | 'association' | 'donation' | 'other' | null
  sold_at?: string | null
  gross_value?: number
  final_weight_kg?: number | null
  total_direct_costs?: number
  eco_fund_percent?: number
  eco_fund_value?: number
  distributable_value?: number
  payout_status?: 'draft' | 'calculated' | 'approved' | 'paid'
  sale_proof_url?: string | null
  sale_notes?: string | null
}

export type PevLotCost = {
  id: string
  cell_id: string
  lot_id: string
  cost_type: 'transport' | 'fuel' | 'bags' | 'labels' | 'carretos' | 'maintenance' | 'other'
  description: string | null
  amount: number
  paid_to_label: string | null
  paid_to_user_id: string | null
  proof_url: string | null
  created_at: string
}

export type PevWorkLog = {
  id: string
  cell_id: string
  lot_id: string
  worker_user_id: string | null
  worker_label: string
  work_type: 'receiving' | 'registering' | 'sorting' | 'loading' | 'transport_selling' | 'coordination' | 'other'
  hours: number
  weight: number
  points: number
  notes: string | null
  created_at: string
}

export type PevPayout = {
  id: string
  cell_id: string
  lot_id: string
  worker_user_id: string | null
  worker_label: string
  points: number
  work_payment: number
  reimbursement: number
  total_payment: number
  effective_hourly_value: number | null
  status: 'pending' | 'approved' | 'paid' | 'cancelled'
  paid_at: string | null
}

export const WORK_TYPE_WEIGHTS: Record<PevWorkLog['work_type'], number> = {
  receiving: 1.0,
  registering: 1.0,
  sorting: 1.2,
  loading: 1.3,
  transport_selling: 1.2,
  coordination: 1.0,
  other: 1.0
}


export type PevEntry = {
  id: string
  cell_id: string
  pev_id: string
  lot_id: string | null
  material_type: string
  quantity: number | null
  unit: string
  condition: 'clean' | 'mixed' | 'wet' | 'rejected' | 'unsafe'
  source_type: string | null
  source_neighborhood: string | null
  photo_url: string | null
  notes: string | null
  received_by: string | null
  received_at: string
  status: 'accepted' | 'rejected' | 'moved'
}

export async function getPevs() {
  const { data, error } = await supabase
    .from("eco_pev_sites")
    .select("*")
    .order("name")
  
  if (error) throw error
  return data as PevSite[]
}

export async function getPevById(id: string) {
  const { data, error } = await supabase
    .from("eco_pev_sites")
    .select("*")
    .eq("id", id)
    .single()
  
  if (error) throw error
  return data as PevSite
}

export async function getPevBySlug(slug: string) {
  const { data, error } = await supabase
    .from("eco_pev_sites")
    .select("*, cell:eco_cells(name)")
    .eq("slug", slug)
    .single()
  
  if (error) throw error
  return data as PevSite & { cell: { name: string } }
}


export async function createPev(pev: Partial<PevSite>) {
  const { data, error } = await supabase
    .from("eco_pev_sites")
    .insert(pev)
    .select()
    .single()
  
  if (error) throw error
  return data as PevSite
}

export async function getOpenLot(pevId: string) {
  const { data, error } = await supabase
    .from("eco_pev_lots")
    .select("*")
    .eq("pev_id", pevId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  
  if (error) throw error
  return data as PevLot | null
}

export async function createLot(lot: Partial<PevLot>) {
  const { data, error } = await supabase
    .from("eco_pev_lots")
    .insert({
      ...lot,
      code: lot.code || `LOT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    })
    .select()
    .single()
  
  if (error) throw error
  return data as PevLot
}

export async function closeLot(lotId: string) {
  const { data, error } = await supabase
    .from("eco_pev_lots")
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq("id", lotId)
    .select()
    .single()
  
  if (error) throw error
  return data as PevLot
}

export async function getPevLots(pevId: string) {
  const { data, error } = await supabase
    .from("eco_pev_lots")
    .select("*")
    .eq("pev_id", pevId)
    .order("opened_at", { ascending: false })
  
  if (error) throw error
  return data as PevLot[]
}

export async function createEntry(entry: Partial<PevEntry>) {
  // Ensure we have an open lot if not provided
  let lotId = entry.lot_id
  if (!lotId && entry.pev_id) {
    const openLot = await getOpenLot(entry.pev_id)
    if (openLot) {
      lotId = openLot.id
    } else {
      const newLot = await createLot({ 
        pev_id: entry.pev_id, 
        cell_id: entry.cell_id,
        status: 'open' 
      })
      lotId = newLot.id
    }
  }

  const { data, error } = await supabase
    .from("eco_pev_entries")
    .insert({ ...entry, lot_id: lotId })
    .select()
    .single()
  
  if (error) throw error
  return data as PevEntry
}

export async function getPevEntries(pevId: string, limit = 10) {
  const { data, error } = await supabase
    .from("eco_pev_entries")
    .select("*")
    .eq("pev_id", pevId)
    .order("received_at", { ascending: false })
    .limit(limit)
  
  if (error) throw error
  return data as PevEntry[]
}

export async function getLotEntries(lotId: string) {
  const { data, error } = await supabase
    .from("eco_pev_entries")
    .select("*")
    .eq("lot_id", lotId)
    .order("received_at", { ascending: false })
  
  if (error) throw error
  return data as PevEntry[]
}

export async function getLotById(id: string) {
  const { data, error } = await supabase
    .from("eco_pev_lots")
    .select("*, pev:eco_pev_sites(*)")
    .eq("id", id)
    .single()
  
  if (error) throw error
  return data as PevLot & { pev: PevSite }
}

export async function updateLot(id: string, updates: Partial<PevLot>) {
  const { data, error } = await supabase
    .from("eco_pev_lots")
    .update(updates)
    .eq("id", id)
    .select()
    .single()
  
  if (error) throw error
  return data as PevLot
}

export async function getLotCosts(lotId: string) {
  const { data, error } = await supabase
    .from("eco_pev_lot_costs")
    .select("*")
    .eq("lot_id", lotId)
    .order("created_at")
  
  if (error) throw error
  return data as PevLotCost[]
}

export async function createLotCost(cost: Partial<PevLotCost>) {
  const { data, error } = await supabase
    .from("eco_pev_lot_costs")
    .insert(cost)
    .select()
    .single()
  
  if (error) throw error
  return data as PevLotCost
}

export async function getWorkLogs(lotId: string) {
  const { data, error } = await supabase
    .from("eco_pev_work_logs")
    .select("*")
    .eq("lot_id", lotId)
    .order("created_at")
  
  if (error) throw error
  return data as PevWorkLog[]
}

export async function createWorkLog(log: Partial<PevWorkLog>) {
  const { data, error } = await supabase
    .from("eco_pev_work_logs")
    .insert(log)
    .select()
    .single()
  
  if (error) throw error
  return data as PevWorkLog
}

export async function getLotPayouts(lotId: string) {
  const { data, error } = await supabase
    .from("eco_pev_payouts")
    .select("*")
    .eq("lot_id", lotId)
  
  if (error) throw error
  return data as PevPayout[]
}

export async function recalculateAndPersistPevLotPayout(lotId: string) {
  // 1. Fetch data
  const lot = await getLotById(lotId)
  const costs = await getLotCosts(lotId)
  const workLogs = await getWorkLogs(lotId)

  const grossValue = lot.gross_value || 0
  const totalDirectCosts = costs.reduce((sum, c) => sum + Number(c.amount), 0)
  const netAfterCosts = Math.max(0, grossValue - totalDirectCosts)
  const ecoFundPercent = lot.eco_fund_percent || 10
  const ecoFundValue = (netAfterCosts * ecoFundPercent) / 100
  const distributableValue = netAfterCosts - ecoFundValue
  const totalPoints = workLogs.reduce((sum, w) => sum + Number(w.points), 0)

  // 2. Prepare Payouts
  const workerStats: Record<string, { 
    worker_label: string, 
    worker_user_id: string | null, 
    points: number, 
    hours: number,
    reimbursement: number 
  }> = {}

  workLogs.forEach(w => {
    if (!workerStats[w.worker_label]) {
      workerStats[w.worker_label] = { 
        worker_label: w.worker_label, 
        worker_user_id: w.worker_user_id, 
        points: 0, 
        hours: 0,
        reimbursement: 0 
      }
    }
    workerStats[w.worker_label].points += Number(w.points)
    workerStats[w.worker_label].hours += Number(w.hours)
  })

  costs.forEach(c => {
    if (c.paid_to_label && workerStats[c.paid_to_label]) {
      workerStats[c.paid_to_label].reimbursement += Number(c.amount)
    }
  })

  const payouts: Partial<PevPayout>[] = Object.values(workerStats).map(stats => {
    const workPayment = totalPoints > 0 ? (distributableValue * stats.points) / totalPoints : 0
    const totalPayment = workPayment + stats.reimbursement
    const effectiveHourlyValue = stats.hours > 0 ? workPayment / stats.hours : null

    return {
      cell_id: lot.cell_id,
      lot_id: lotId,
      worker_label: stats.worker_label,
      worker_user_id: stats.worker_user_id,
      points: stats.points,
      work_payment: workPayment,
      reimbursement: stats.reimbursement,
      total_payment: totalPayment,
      effective_hourly_value: effectiveHourlyValue,
      status: 'pending'
    }
  })

  // 3. Persist
  // Use a transaction or sequential delete/insert for simplicity in this MVP
  await supabase.from("eco_pev_payouts").delete().eq("lot_id", lotId)
  if (payouts.length > 0) {
    await supabase.from("eco_pev_payouts").insert(payouts)
  }

  // 4. Update Lot
  await updateLot(lotId, {
    total_direct_costs: totalDirectCosts,
    eco_fund_value: ecoFundValue,
    distributable_value: distributableValue,
    payout_status: 'calculated'
  })

  // 5. ECO Fund Movement
  await supabase.from("eco_pev_fund_movements").delete().eq("lot_id", lotId).eq("movement_type", "lot_contribution")
  if (ecoFundValue > 0) {
    await supabase.from("eco_pev_fund_movements").insert({
      cell_id: lot.cell_id,
      lot_id: lotId,
      movement_type: 'lot_contribution',
      amount: ecoFundValue,
      description: `Contribuição do lote ${lot.code} para Fundo ECO`
    })
  }

  return { lot, payouts }
}

export async function approvePayout(lotId: string) {
  await supabase.from("eco_pev_payouts").update({ status: 'approved' }).eq("lot_id", lotId)
  return await updateLot(lotId, { payout_status: 'approved' })
}

export async function markPaid(lotId: string) {
  const now = new Date().toISOString()
  await supabase.from("eco_pev_payouts").update({ status: 'paid', paid_at: now }).eq("lot_id", lotId)
  return await updateLot(lotId, { payout_status: 'paid', status: 'paid' })
}

export async function getCellIdForUser() {
    // This is a helper to get the cell_id from the user's profile
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from("profiles")
        .select("neighborhood_id")
        .eq("user_id", user.id)
        .single()
    
    if (!profile?.neighborhood_id) return null

    const { data: cell } = await supabase
        .from("eco_cell_neighborhoods")
        .select("cell_id")
        .eq("neighborhood_id", profile.neighborhood_id)
        .limit(1)
        .maybeSingle()
    
    return cell?.cell_id || null
}

export async function getPevStats(pevId: string) {
  const { data: entries, error } = await supabase
    .from("eco_pev_entries")
    .select("quantity")
    .eq("pev_id", pevId)
    .eq("status", "accepted")
  
  if (error) throw error
  
  const totalKg = entries.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0)
  
  const { data: lots, error: lotError } = await supabase
    .from("eco_pev_lots")
    .select("gross_value")
    .eq("pev_id", pevId)
    .in("status", ["sold", "paid"])
  
  if (lotError) throw lotError
  const totalValue = lots.reduce((sum, l) => sum + (Number(l.gross_value) || 0), 0)
  
  return { totalKg, totalValue, lotCount: lots.length }
}

export async function getCellMonthlyStats(cellId: string) {
  // Aggregate everything for the current month
  const firstDay = new Date()
  firstDay.setDate(1)
  firstDay.setHours(0,0,0,0)

  const { data: entries } = await supabase
    .from("eco_pev_entries")
    .select("quantity")
    .eq("cell_id", cellId)
    .gte("received_at", firstDay.toISOString())
  
  const { data: lots } = await supabase
    .from("eco_pev_lots")
    .select("gross_value, eco_fund_value")
    .eq("cell_id", cellId)
    .gte("opened_at", firstDay.toISOString())

  const totalKg = entries?.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0) || 0
  const totalGross = lots?.reduce((sum, l) => sum + (Number(l.gross_value) || 0), 0) || 0
  const totalFund = lots?.reduce((sum, l) => sum + (Number(l.eco_fund_value) || 0), 0) || 0

  return { totalKg, totalGross, totalFund, lotCount: lots?.length || 0 }
}

/**
 * ECO-D05: Experimental PEV Utilities
 */

export function getPevExperimentReadiness(pev: PevSite) {
  const missing_items: string[] = []
  const warnings: string[] = []
  
  if (!pev.accepted_materials || pev.accepted_materials.length === 0) {
    missing_items.push("Materiais aceitos não definidos")
  }
  
  if (!pev.rejected_materials || pev.rejected_materials.length === 0) {
    missing_items.push("Materiais rejeitados não definidos")
  }
  
  if (!pev.opening_rules) {
    missing_items.push("Regras de funcionamento/horário não preenchidas")
  }
  
  if (!pev.safety_rules) {
    missing_items.push("Regras de segurança não preenchidas")
  }
  
  if (pev.capacity_level === 'unknown') {
    missing_items.push("Capacidade volumétrica não definida")
  }
  
  if (pev.needs_pickup_frequency === 'unknown') {
    missing_items.push("Frequência de retirada não estimada")
  }
  
  // Warnings
  if (pev.public_visibility === 'public_map' && pev.address_public_level === 'full_public') {
    warnings.push("Atenção: Endereço completo exposto no mapa público")
  }
  
  const acceptsGlass = pev.accepted_materials?.includes('glass')
  if (acceptsGlass && (!pev.safety_rules || !pev.safety_rules.toLowerCase().includes('vidro'))) {
    warnings.push("Aceita vidro mas não possui regra específica de segurança para vidro")
  }

  const acceptsOil = pev.accepted_materials?.includes('cooking_oil')
  if (acceptsOil && (!pev.safety_rules || !pev.safety_rules.toLowerCase().includes('óleo'))) {
    warnings.push("Aceita óleo mas não possui regra específica de segurança para óleo")
  }

  const acceptsElectronics = pev.accepted_materials?.includes('electronics')
  if (acceptsElectronics && (!pev.safety_rules || !pev.safety_rules.toLowerCase().includes('eletrônico'))) {
    warnings.push("Aceita eletrônicos mas não possui regra específica de segurança para e-lixo")
  }

  const score = Math.max(0, 100 - (missing_items.length * 15) - (warnings.length * 5))
  const can_activate = missing_items.length === 0
  
  return { score, missing_items, warnings, can_activate }
}

export async function recordPevExperimentEvent(input: Partial<PevExperimentEvent>) {
  const { data, error } = await supabase
    .from("eco_pev_experiment_events")
    .insert(input)
    .select()
    .single()
  
  if (error) throw error
  return data as PevExperimentEvent
}

export async function getPevExperimentEvents(pevId: string) {
  const { data, error } = await supabase
    .from("eco_pev_experiment_events")
    .select("*")
    .eq("pev_site_id", pevId)
    .order("created_at", { ascending: false })
  
  if (error) throw error
  return data as PevExperimentEvent[]
}

export async function updateExperimentalPev(id: string, patch: Partial<PevSite>, note?: string) {
  // Capture old status if it's changing for the event log
  let oldStatus: string | null = null
  if (patch.experiment_status || patch.pev_mode) {
    const current = await getPevById(id)
    oldStatus = patch.experiment_status ? current.experiment_status : current.pev_mode
  }

  const { data, error } = await supabase
    .from("eco_pev_sites")
    .update(patch)
    .eq("id", id)
    .select()
    .single()
  
  if (error) throw error
  
  // Record event if status changed
  if (patch.experiment_status || patch.pev_mode) {
    await recordPevExperimentEvent({
      pev_site_id: id,
      event_type: patch.experiment_status ? 'status_changed' : 'mode_changed',
      old_value: oldStatus,
      new_value: patch.experiment_status || patch.pev_mode,
      note: note || "Atualização de status via admin"
    })
  }

  return data as PevSite
}

export async function applyPevExperimentQuickAction(id: string, action: string) {
  const patch: Partial<PevSite> = {}
  let note = ""

  switch (action) {
    case 'start_evaluation':
      patch.experiment_status = 'evaluating'
      note = "Iniciada avaliação técnica do local"
      break
    case 'approve_for_test':
      patch.experiment_status = 'approved_for_test'
      note = "Local aprovado para instalação de teste"
      break
    case 'activate_test':
      patch.experiment_status = 'active_test'
      patch.status = 'active'
      patch.experiment_started_at = new Date().toISOString()
      note = "Teste de campo iniciado"
      break
    case 'pause_test':
      patch.experiment_status = 'paused'
      patch.status = 'paused'
      note = "Teste pausado para ajustes"
      break
    case 'fail_experiment':
      patch.experiment_status = 'failed'
      patch.status = 'archived'
      note = "Experimento encerrado: local inviável"
      break
    case 'convert_to_regular':
      patch.experiment_status = 'converted_to_regular'
      patch.pev_mode = 'regular'
      note = "Experimento validado: convertido para PEV regular"
      break
    case 'archive':
      patch.status = 'archived'
      patch.experiment_status = 'archived'
      note = "PEV arquivado"
      break
    default:
      throw new Error(`Ação desconhecida: ${action}`)
  }

  return await updateExperimentalPev(id, patch, note)
}



