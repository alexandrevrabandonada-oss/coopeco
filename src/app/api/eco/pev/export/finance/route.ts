import { createClient } from "@/lib/supabase"

const supabase = createClient()
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get("month")
    const pevId = searchParams.get("pevId")

    if (!month) {
      return NextResponse.json({ error: "Month parameter is required" }, { status: 400 })
    }

    let query = supabase.from("eco_pev_monthly_rollups").select("*").eq("month_ref", `${month}-01T00:00:00Z`)
    
    if (pevId) {
      query = query.eq("pev_id", pevId)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    let csv = "PEV_ID,MES_REF,TOTAL_LOTES,RECEITA_BRUTA,CUSTOS_DIRETOS,FUNDO_ECO,VALOR_DISTRIBUIVEL\n"
    
    data.forEach((r: any) => {
      csv += `${r.pev_id},${r.month_ref},${r.total_lots},${r.gross_value_total},${r.direct_costs_total},${r.eco_fund_total},${r.distributable_total}\n`
    })

    const response = new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="finance-export-${month}.csv"`
      }
    })

    return response
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to generate CSV" }, { status: 500 })
  }
}
