import { updateDemandStatus } from "@/lib/eco/demand"
import { NextResponse } from "next/server"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json()
    const { id } = await params
    const action = body.action

    const updates: any = {}
    let note = `Ação rápida: ${action}`

    switch(action) {
      case 'mark_contacted':
        updates.status = 'contacted'
        updates.contacted_at = new Date().toISOString()
        break
      case 'mark_route_candidate':
        updates.route_candidate = true
        updates.status = 'converted_to_route'
        updates.converted_at = new Date().toISOString()
        break
      case 'mark_pev_candidate':
        updates.pev_candidate = true
        updates.status = 'converted_to_pev_candidate'
        updates.converted_at = new Date().toISOString()
        break
      case 'archive':
        updates.status = 'archived'
        break
      case 'restore':
        updates.status = 'new'
        break
      case 'set_high_priority':
        updates.priority = 'high'
        break
      case 'set_guidance_only':
        updates.preference = 'guidance_only'
        break
      default:
        return NextResponse.json({ error: "Ação inválida." }, { status: 400 })
    }

    const data = await updateDemandStatus(id, updates, undefined, note)
    return NextResponse.json({ ok: true, data })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 })
  }
}
