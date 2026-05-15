import { createClient } from "@/lib/supabase"

const supabase = createClient()
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get("month")

    if (!month) {
      return NextResponse.json({ error: "Month parameter is required" }, { status: 400 })
    }

    // Usando a view pública (zero PII, apenas PEVs com public_transparency = true)
    const { data, error } = await supabase
      .from("eco_pev_public_monthly_rollups")
      .select("*")
      .eq("month_ref", `${month}-01T00:00:00Z`)
    
    if (error) throw new Error(error.message)

    let csv = "PEV,BAIRRO,MES_REF,ENTRADAS,ACEITAS,LOTES_VENDIDOS,PESO_FINAL_KG,RECEITA_BRUTA,FUNDO_ECO\n"
    
    data.forEach((r: any) => {
      csv += `"${r.pev_name}","${r.pev_neighborhood}",${r.month_ref},${r.total_entries},${r.accepted_entries},${r.sold_lots},${r.final_weight_kg_total},${r.gross_value_total},${r.eco_fund_total}\n`
    })

    const response = new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="public-summary-${month}.csv"`
      }
    })

    return response
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to generate CSV" }, { status: 500 })
  }
}
