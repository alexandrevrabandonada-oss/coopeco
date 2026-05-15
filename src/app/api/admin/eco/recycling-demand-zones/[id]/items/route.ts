import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(
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
    const { demand_ids, added_reason } = body; // expect an array of demand_ids

    if (!Array.isArray(demand_ids)) {
      return NextResponse.json({ error: 'demand_ids must be an array' }, { status: 400 });
    }

    const itemsToInsert = demand_ids.map((demand_id: string) => ({
      zone_id: zoneId,
      demand_id,
      added_reason
    }));

    const { data, error } = await supabase
      .from('eco_recycling_demand_zone_items')
      .upsert(itemsToInsert, { onConflict: 'zone_id, demand_id' })
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
