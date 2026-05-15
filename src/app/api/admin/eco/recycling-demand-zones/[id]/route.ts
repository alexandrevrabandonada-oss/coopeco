import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const zoneId = resolvedParams.id;
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
    // Only update allowed fields
    const { zone_name, status, notes, radius_m } = body;
    
    const updates: any = {};
    if (zone_name !== undefined) updates.zone_name = zone_name;
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (radius_m !== undefined) updates.radius_m = radius_m;

    const { data, error } = await supabase
      .from('eco_recycling_demand_zones')
      .update(updates)
      .eq('id', zoneId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
