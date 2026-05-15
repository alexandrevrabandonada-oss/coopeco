import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const neighborhood = searchParams.get('neighborhood');
  
  let query = supabase.from('eco_recycling_pilot_routes').select('*').order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (neighborhood) query = query.eq('neighborhood', neighborhood);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary = {
    total: data.length,
    draft: data.filter(d => d.status === 'draft').length,
    scheduled: data.filter(d => d.status === 'scheduled').length,
    in_progress: data.filter(d => d.status === 'in_progress').length,
    completed: data.filter(d => d.status === 'completed').length,
    estimated_stops_total: data.reduce((acc, curr) => acc + (curr.estimated_stops || 0), 0)
  };

  return NextResponse.json({ items: data, summary });
}

export async function POST(request: Request) {
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
    const { title, description, neighborhood, zone_id, planned_date, time_window_start, time_window_end, material_focus, vehicle_type, operator_name, estimated_duration_minutes, estimated_distance_km, estimated_cost_brl, estimated_stops } = body;

    const { data: routeData, error } = await supabase
      .from('eco_recycling_pilot_routes')
      .insert([{
        title, description, neighborhood, zone_id,
        planned_date, time_window_start, time_window_end,
        material_focus: material_focus || [],
        vehicle_type, operator_name,
        estimated_duration_minutes, estimated_distance_km, estimated_cost_brl, estimated_stops,
        status: 'draft'
      }])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Register event
    await supabase.from('eco_recycling_pilot_route_events').insert([{
      route_id: routeData.id,
      event_type: 'route_created',
      note: 'Rota piloto criada no sistema'
    }]);

    return NextResponse.json(routeData, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
