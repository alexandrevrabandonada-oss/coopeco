import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createClient();
  const { id } = await params;

  const { data: pev, error: pevError } = await supabase
    .from('eco_pev_sites')
    .select('*')
    .eq('id', id)
    .single();

  if (pevError) return NextResponse.json({ error: pevError.message }, { status: 500 });

  const { data: events } = await supabase
    .from('eco_pev_experiment_events')
    .select('*')
    .eq('pev_site_id', id)
    .order('created_at', { ascending: false });

  const { data: entries } = await supabase
    .from('eco_pev_entries')
    .select('*')
    .eq('pev_id', id)
    .order('received_at', { ascending: false })
    .limit(10);

  const { data: lots } = await supabase
    .from('eco_pev_lots')
    .select('*')
    .eq('pev_id', id)
    .order('opened_at', { ascending: false })
    .limit(5);

  return NextResponse.json({ 
    pev, 
    events: events || [], 
    entries: entries || [],
    lots: lots || []
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createClient();
  const { id } = await params;
  const body = await request.json();

  const { data: { user } } = await supabase.auth.getUser();

  // Capture old state for event logging if needed
  const { data: oldPev } = await supabase.from('eco_pev_sites').select('*').eq('id', id).single();

  const { data: updatedPev, error } = await supabase
    .from('eco_pev_sites')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log status change event
  if (body.experiment_status && body.experiment_status !== oldPev.experiment_status) {
    await supabase.from('eco_pev_experiment_events').insert({
      pev_site_id: id,
      event_type: 'status_changed',
      old_value: oldPev.experiment_status,
      new_value: body.experiment_status,
      note: 'Status atualizado via Admin',
      actor_id: user?.id
    });
  }

  return NextResponse.json(updatedPev);
}
