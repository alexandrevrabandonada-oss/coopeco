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
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Ignored in server components
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Ignored in server components
          }
        },
      },
    }
  );

  const { searchParams } = new URL(request.url);
  const neighborhood = searchParams.get('neighborhood');
  const materialType = searchParams.get('material_type');
  const preference = searchParams.get('preference');
  const priority = searchParams.get('priority');
  const status = searchParams.get('status');
  const routeCandidate = searchParams.get('route_candidate');
  const pevCandidate = searchParams.get('pev_candidate');
  const onlyRecurring = searchParams.get('only_recurring');
  const onlyWithGeo = searchParams.get('only_with_geo');

  let query = supabase
    .from('eco_recycling_demand_map_internal')
    .select('*');

  if (neighborhood) query = query.eq('neighborhood', neighborhood);
  if (materialType) query = query.contains('material_types', [materialType]);
  if (preference) query = query.eq('preference', preference);
  if (priority) query = query.eq('priority', priority);
  if (status) query = query.eq('status', status);
  if (routeCandidate === 'true') query = query.eq('route_candidate', true);
  if (pevCandidate === 'true') query = query.eq('pev_candidate', true);
  if (onlyRecurring === 'true') query = query.eq('is_recurring_generator', true);
  if (onlyWithGeo === 'true') query = query.not('geo_lat', 'is', null).not('geo_lng', 'is', null);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate summary
  const summary = {
    total: data.length,
    with_geo: data.filter(d => d.geo_lat && d.geo_lng).length,
    without_geo: data.filter(d => !d.geo_lat || !d.geo_lng).length,
    route_candidates: data.filter(d => d.route_candidate).length,
    pev_candidates: data.filter(d => d.pev_candidate).length,
    recurring_generators: data.filter(d => d.is_recurring_generator).length,
    neighborhoods_count: new Set(data.map(d => d.neighborhood)).size,
  };

  return NextResponse.json({ items: data, summary });
}
