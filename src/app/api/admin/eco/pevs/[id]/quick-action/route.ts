import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { applyPevExperimentQuickAction } from '@/lib/eco/pev';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createClient();
  const { id } = await params;
  const { action } = await request.json();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const patch: any = {};
    let note = "";
    let eventType = "status_changed";

    const { data: oldPev } = await supabase.from('eco_pev_sites').select('*').eq('id', id).single();

    switch (action) {
      case 'start_evaluation':
        patch.experiment_status = 'evaluating';
        note = "Iniciada avaliação técnica do local";
        break;
      case 'approve_for_test':
        patch.experiment_status = 'approved_for_test';
        note = "Local aprovado para instalação de teste";
        break;
      case 'activate_test':
        patch.experiment_status = 'active_test';
        patch.status = 'active';
        patch.experiment_started_at = new Date().toISOString();
        note = "Teste de campo iniciado";
        break;
      case 'pause_test':
        patch.experiment_status = 'paused';
        patch.status = 'paused';
        note = "Teste pausado para ajustes";
        break;
      case 'fail_experiment':
        patch.experiment_status = 'failed';
        patch.status = 'archived';
        note = "Experimento encerrado: local inviável";
        break;
      case 'convert_to_regular':
        patch.experiment_status = 'converted_to_regular';
        patch.pev_mode = 'regular';
        note = "Experimento validado: convertido para PEV regular";
        break;
      case 'archive':
        patch.status = 'archived';
        patch.experiment_status = 'archived';
        note = "PEV arquivado";
        break;
      default:
        return NextResponse.json({ error: `Ação desconhecida: ${action}` }, { status: 400 });
    }

    const { data: updatedPev, error } = await supabase
      .from('eco_pev_sites')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('eco_pev_experiment_events').insert({
      pev_site_id: id,
      event_type: eventType,
      old_value: oldPev.experiment_status,
      new_value: patch.experiment_status || oldPev.experiment_status,
      note: note,
      actor_id: user.id
    });

    return NextResponse.json(updatedPev);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
