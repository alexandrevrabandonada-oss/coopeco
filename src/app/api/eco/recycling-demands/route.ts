import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"
import sanitizeHtml from "sanitize-html"

const supabase = createClient()

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // Basic required field validation
    if (!body.neighborhood || !body.participant_type || !body.volume_level || !body.frequency || !body.preference || !body.material_types) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 })
    }

    if (!Array.isArray(body.material_types) || body.material_types.length === 0) {
      return NextResponse.json({ error: "Selecione pelo menos um material." }, { status: 400 })
    }

    // Consent required if contact info is provided
    if ((body.contact_phone || body.contact_email) && !body.consent_contact) {
      return NextResponse.json({ error: "Consentimento necessário para contato." }, { status: 400 })
    }

    // Sanitize string inputs
    const sanitize = (str: any) => str ? sanitizeHtml(String(str).trim(), { allowedTags: [], allowedAttributes: {} }) : null

    // Safe payload - ignores internal fields like status or operator_notes
    const safePayload = {
      city: 'Volta Redonda',
      neighborhood: sanitize(body.neighborhood),
      participant_type: sanitize(body.participant_type),
      material_types: body.material_types.map(sanitize).filter(Boolean),
      volume_level: sanitize(body.volume_level),
      frequency: sanitize(body.frequency),
      preference: sanitize(body.preference),
      main_problem: sanitize(body.main_problem),
      
      can_be_pev: !!body.can_be_pev,
      can_volunteer: !!body.can_volunteer,
      is_recurring_generator: !!body.is_recurring_generator,
      
      contact_name: sanitize(body.contact_name),
      contact_phone: sanitize(body.contact_phone),
      contact_email: sanitize(body.contact_email),
      consent_contact: !!body.consent_contact,
      consent_public_aggregate: true, // Default as requested
      
      address_hint: sanitize(body.address_hint),
      status: 'new', // Hardcoded safely
      source: 'public_form'
    }

    // We might need to use a service role key if RLS blocks anon inserts. 
    // Assuming anonymous insert policy allows it or supabase client resolves correctly.
    // If it fails, the project setup handles anon insert policies.
    const { data, error } = await supabase
      .from("eco_recycling_demands")
      .insert(safePayload)
      .select("id")
      .single()

    if (error) {
      console.error(error)
      return NextResponse.json({ error: "Erro ao salvar demanda." }, { status: 500 })
    }

    return NextResponse.json({ 
      ok: true, 
      id: data.id, 
      message: "Recebemos seu cadastro. Isso não garante coleta imediata, mas ajuda a organizar a rede ECO no seu bairro." 
    })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 })
  }
}
