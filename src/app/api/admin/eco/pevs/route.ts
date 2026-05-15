import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { PevSite } from '@/lib/eco/pev';

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  
  const pev_mode = searchParams.get('pev_mode');
  const experiment_status = searchParams.get('experiment_status');
  const neighborhood = searchParams.get('neighborhood');

  let query = supabase.from('eco_pev_sites').select('*');

  if (pev_mode) query = query.eq('pev_mode', pev_mode);
  if (experiment_status) query = query.eq('experiment_status', experiment_status);
  if (neighborhood) query = query.ilike('neighborhood', `%${neighborhood}%`);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Summary stats
  const summary = {
    total: data.length,
    experimental: data.filter(p => p.pev_mode === 'experimental').length,
    evaluating: data.filter(p => p.experiment_status === 'evaluating').length,
    active_test: data.filter(p => p.experiment_status === 'active_test').length,
    paused: data.filter(p => p.experiment_status === 'paused').length,
    converted: data.filter(p => p.experiment_status === 'converted_to_regular').length,
  };

  return NextResponse.json({ items: data, summary });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const body = await request.json();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('eco_pev_sites')
    .insert({
      ...body,
      pev_mode: body.pev_mode || 'experimental',
      experiment_status: body.experiment_status || 'draft',
      created_by: user.id
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Record event
  await supabase.from('eco_pev_experiment_events').insert({
    pev_site_id: data.id,
    event_type: 'experiment_created',
    new_value: 'draft',
    note: 'PEV Experimental criado via Admin',
    actor_id: user.id
  });

  return NextResponse.json(data);
}
