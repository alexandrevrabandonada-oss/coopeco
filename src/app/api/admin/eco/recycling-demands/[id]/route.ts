import { updateDemandStatus } from "@/lib/eco/demand"
import { NextResponse } from "next/server"
import sanitizeHtml from "sanitize-html"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json()
    const { id } = await params
    
    const updates: any = {}
    if (body.status) updates.status = body.status
    if (body.priority) updates.priority = body.priority
    if (body.next_action !== undefined) updates.next_action = body.next_action
    if (body.next_action_at !== undefined) updates.next_action_at = body.next_action_at
    if (body.route_candidate !== undefined) updates.route_candidate = body.route_candidate
    if (body.pev_candidate !== undefined) updates.pev_candidate = body.pev_candidate
    if (body.estimated_weekly_volume_score !== undefined) updates.estimated_weekly_volume_score = body.estimated_weekly_volume_score

    if (body.operator_notes !== undefined) {
      updates.operator_notes = body.operator_notes ? sanitizeHtml(String(body.operator_notes), { allowedTags: [], allowedAttributes: {} }) : null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nenhum dado para atualizar." }, { status: 400 })
    }

    // Pass a fake actor ID for MVP since we are not extracting auth user ID fully here. 
    // In production, extract from supabase.auth.getUser()
    const data = await updateDemandStatus(id, updates, undefined, body.event_note)

    return NextResponse.json({ ok: true, data })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 })
  }
}
