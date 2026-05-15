import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

const supabase = createClient()

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const neighborhood = searchParams.get("neighborhood")
    const material_type = searchParams.get("material_type")
    const preference = searchParams.get("preference")

    let query = supabase.from("eco_recycling_demand_rollup_public").select("*")

    if (neighborhood) query = query.eq("neighborhood", neighborhood)
    if (material_type) query = query.eq("material_type", material_type)
    if (preference) query = query.eq("preference", preference)

    const { data, error } = await query
    
    if (error) {
      console.error(error)
      return NextResponse.json({ error: "Erro ao buscar dados agregados." }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 })
  }
}
