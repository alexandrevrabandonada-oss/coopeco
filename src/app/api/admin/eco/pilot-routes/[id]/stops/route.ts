import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const { demand_ids } = body;

    if (!Array.isArray(demand_ids) || demand_ids.length === 0) {
      return NextResponse.json({ error: 'demand_ids required' }, { status: 400 });
    }

    const { data: route } = await supabase.from('eco_recycling_pilot_routes').select('id').eq('id', routeId).single();
    if (!route) return NextResponse.json({ error: 'Route not found' }, { status: 404 });

    const inserts = demand_ids.map((d_id: string, idx: number) => ({
      route_id: routeId,
      demand_id: d_id,
      stop_order: idx + 1
    }));

    const { data: stops, error } = await supabase.from('eco_recycling_pilot_route_stops').insert(inserts).select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Mark demands as route candidates
    await supabase.from('eco_recycling_demands').update({ route_candidate: true }).in('id', demand_ids);

    // Register event
    await supabase.from('eco_recycling_pilot_route_events').insert([{
      route_id: routeId,
      event_type: 'stop_added',
      note: `${demand_ids.length} paradas adicionadas à rota`
    }]);

    return NextResponse.json(stops, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
