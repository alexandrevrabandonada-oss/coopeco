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
    const { action } = body;

    const actionMap: Record<string, string> = {
      prepare_route: 'preparing',
      start_confirmation: 'confirming',
      schedule_route: 'scheduled',
      start_route: 'in_progress',
      complete_route: 'completed',
      cancel_route: 'canceled',
      archive_route: 'archived'
    };

    const newStatus = actionMap[action];
    if (!newStatus) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    const { data: oldRoute } = await supabase.from('eco_recycling_pilot_routes').select('status').eq('id', routeId).single();

    const { data: updated, error } = await supabase
      .from('eco_recycling_pilot_routes')
      .update({ status: newStatus, ...(action === 'complete_route' ? { completed_at: new Date().toISOString() } : {}) })
      .eq('id', routeId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('eco_recycling_pilot_route_events').insert([{
      route_id: routeId,
      event_type: 'status_changed',
      old_value: oldRoute?.status,
      new_value: newStatus,
      note: `Quick action: ${action}`
    }]);

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
