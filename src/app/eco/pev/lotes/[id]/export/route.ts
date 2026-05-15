import { getLotById, getLotEntries, getLotCosts, getLotPayouts } from "@/lib/eco/pev"
import { NextResponse } from "next/server"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [lot, entries, costs, payouts] = await Promise.all([
      getLotById(id),
      getLotEntries(id),
      getLotCosts(id),
      getLotPayouts(id)
    ])

    let csv = "TIPO,DATA,DESCRICAO,VALOR/QTD,UNIDADE,DETALHE\n"
    
    // Header info
    csv += `LOTE,${lot.opened_at},${lot.code},${lot.gross_value || 0},BRL,STATUS:${lot.status}\n`
    
    // Entries
    entries.forEach(e => {
      csv += `ENTRADA,${e.received_at},${e.material_type},${e.quantity},${e.unit},${e.condition}\n`
    })

    // Costs
    costs.forEach(c => {
      csv += `CUSTO,${c.created_at},${c.cost_type},${c.amount},BRL,${c.paid_to_label}\n`
    })

    // Payouts
    payouts.forEach(p => {
      csv += `PAGAMENTO,${p.paid_at || ''},${p.worker_label},${p.total_payment},BRL,${p.status}\n`
    })

    const response = new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="lote-${lot.code}.csv"`
      }
    })

    return response
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to generate CSV" }, { status: 500 })
  }
}
