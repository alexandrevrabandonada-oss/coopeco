import { getDemandEvents } from "@/lib/eco/demand"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const events = await getDemandEvents(id)
    return NextResponse.json({ ok: true, data: events })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 })
  }
}
