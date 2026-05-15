import { getAdminDemands } from "@/lib/eco/demand"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const neighborhood = searchParams.get("neighborhood")
    const status = searchParams.get("status")
    const priority = searchParams.get("priority")
    const route_candidate = searchParams.get("route_candidate")
    const pev_candidate = searchParams.get("pev_candidate")

    const filters: any = {}
    if (neighborhood) filters.neighborhood = neighborhood
    if (status) filters.status = status
    if (priority) filters.priority = priority
    if (route_candidate) filters.route_candidate = route_candidate
    if (pev_candidate) filters.pev_candidate = pev_candidate

    const data = await getAdminDemands(filters)
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 })
  }
}
