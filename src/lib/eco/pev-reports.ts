import { createClient } from "@/lib/supabase"

const supabase = createClient()

/**
 * MÓDULO PEV-03: Boletim e Transparência
 */

export interface PevMonthlyRollup {
  cell_id: string
  pev_id: string
  month_ref: string
  total_entries: number
  accepted_entries: number
  rejected_entries: number
  total_lots: number
  open_lots: number
  closed_lots: number
  sold_lots: number
  paid_lots: number
  gross_value_total: number
  direct_costs_total: number
  eco_fund_total: number
  distributable_total: number
  final_weight_kg_total: number
}

export interface PevMaterialMonthlyRollup {
  cell_id: string
  pev_id: string
  month_ref: string
  material_type: string
  unit: string
  total_quantity: number
  entry_count: number
  accepted_count: number
  rejected_count: number
}

export interface PevPublicMonthlyRollup {
  pev_id: string
  pev_slug: string
  pev_name: string
  pev_neighborhood: string
  pev_city: string
  pev_state: string
  month_ref: string
  total_entries: number
  accepted_entries: number
  sold_lots: number
  final_weight_kg_total: number
  gross_value_total: number
  eco_fund_total: number
}

// 1. Interno: Resumo do Mês
export async function getPevMonthlyReport(params: {
  pevId?: string,
  month?: string
}) {
  let query = supabase.from("eco_pev_monthly_rollups").select("*")
  
  if (params.pevId) {
    query = query.eq("pev_id", params.pevId)
  }
  if (params.month) {
    query = query.eq("month_ref", `${params.month}-01T00:00:00Z`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as PevMonthlyRollup[]
}

// 2. Interno: Materiais do Mês
export async function getPevMaterialMonthlyReport(params: {
  pevId?: string,
  month?: string
}) {
  let query = supabase.from("eco_pev_material_monthly_rollups").select("*")
  
  if (params.pevId) {
    query = query.eq("pev_id", params.pevId)
  }
  if (params.month) {
    query = query.eq("month_ref", `${params.month}-01T00:00:00Z`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as PevMaterialMonthlyRollup[]
}

// 3. Público: Sanitizado (Sem PII)
export async function getPevPublicMonthlyReport(params: {
  pevSlug: string,
  month?: string
}) {
  let query = supabase.from("eco_pev_public_monthly_rollups")
    .select("*")
    .eq("pev_slug", params.pevSlug)
  
  if (params.month) {
    query = query.eq("month_ref", `${params.month}-01T00:00:00Z`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as PevPublicMonthlyRollup[]
}

// 4. Update Transparency Status
export async function togglePevTransparency(pevId: string, status: boolean) {
  const { error } = await supabase
    .from("eco_pev_sites")
    .update({ public_transparency: status })
    .eq("id", pevId)
  
  if (error) throw new Error(error.message)
}
