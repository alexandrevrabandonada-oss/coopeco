import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string, stopId: string }> }) {
  const resolvedParams = await params;
  const routeId = resolvedParams.id;
  const stopId = resolvedParams.stopId;
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
    
    const { data: oldStop } = await supabase.from('eco_recycling_pilot_route_stops').select('*').eq('id', stopId).single();

    const { data: updated, error } = await supabase
      .from('eco_recycling_pilot_route_stops')
      .update(body)
      .eq('id', stopId)
      .eq('route_id', routeId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (oldStop && body.status && oldStop.status !== body.status) {
      await supabase.from('eco_recycling_pilot_route_events').insert([{
        route_id: routeId,
        stop_id: stopId,
        event_type: 'stop_status_changed',
        old_value: oldStop.status,
        new_value: body.status,
      }]);
    }

    if (oldStop && body.confirmation_status && oldStop.confirmation_status !== body.confirmation_status) {
      await supabase.from('eco_recycling_pilot_route_events').insert([{
        route_id: routeId,
        stop_id: stopId,
        event_type: 'stop_confirmed',
        old_value: oldStop.confirmation_status,
        new_value: body.confirmation_status,
      }]);
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
