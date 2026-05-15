import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  
  const neighborhood = searchParams.get('neighborhood');
  const material = searchParams.get('material');

  let query = supabase.from('eco_pev_sites_public').select('*');

  if (neighborhood) query = query.eq('neighborhood', neighborhood);
  if (material) query = query.contains('accepted_materials', [material]);

  const { data, error } = await query.order('neighborhood');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
