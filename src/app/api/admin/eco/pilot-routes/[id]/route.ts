import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const routeId = resolvedParams.id;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: any) { try { cookieStore.set({ name, value, ...options }); } catch (error) {} },
        remove(name: string, options: any) { try { cookieStore.set({ name, value: '', ...options }); } catch (error) {} },
      },
    }
  );

  const { data: route, error: routeError } = await supabase
    .from('eco_recycling_pilot_routes')
    .select('*')
    .eq('id', routeId)
    .single();

  if (routeError) return NextResponse.json({ error: routeError.message }, { status: 500 });

  const { data: stops } = await supabase
    .from('eco_recycling_pilot_route_stops')
    .select('*, demand:eco_recycling_demands(neighborhood, participant_type, material_types, volume_level, preference, contact_phone)')
    .eq('route_id', routeId)
    .order('stop_order', { ascending: true });

  const { data: events } = await supabase
    .from('eco_recycling_pilot_route_events')
    .select('*')
    .eq('route_id', routeId)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    route,
    stops: stops || [],
    events: events || []
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const routeId = resolvedParams.id;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: any) { try { cookieStore.set({ name, value, ...options }); } catch (error) {} },
        remove(name: string, options: any) { try { cookieStore.set({ name, value: '', ...options }); } catch (error) {} },
      },
    }
  );

  try {
    const body = await request.json();
    
    // Fetch old to compare
    const { data: oldRoute } = await supabase.from('eco_recycling_pilot_routes').select('status').eq('id', routeId).single();

    const { data: updated, error } = await supabase
      .from('eco_recycling_pilot_routes')
      .update(body)
      .eq('id', routeId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (oldRoute && body.status && oldRoute.status !== body.status) {
      await supabase.from('eco_recycling_pilot_route_events').insert([{
        route_id: routeId,
        event_type: 'status_changed',
        old_value: oldRoute.status,
        new_value: body.status,
        note: 'Status da rota atualizado via PATCH'
      }]);
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
