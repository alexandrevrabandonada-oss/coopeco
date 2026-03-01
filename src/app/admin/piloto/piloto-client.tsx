"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { Neighborhood, PilotProgram, PilotProgramNeighborhood, PilotChecklist, PilotChecklistItem } from "@/types/eco";
import { LoadingBlock } from "@/components/loading-block";
import { Save, Target, Layout, Rocket, ArrowRight, CheckCircle2, Circle, Clock, Package, AlertTriangle, AlertCircle, QrCode, Copy, RefreshCw, Download, ShieldCheck, TrendingUp, Megaphone, ClipboardList } from "lucide-react";
import Link from "next/link";
import { VRBadge } from "@/components/vr-badge";
import { CommSection } from "@/components/comm-section";
import { isAnchorsFeatureEnabled, isGalpaoFeatureEnabled } from "@/lib/features";
import { reportObsEvent } from "@/lib/obs";

export default function PilotoClient() {
  const [programs, setPrograms] = useState<PilotProgram[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [neighborhoods, setNeighborhoods] = useState<PilotProgramNeighborhood[]>([]);
  const [checklists, setChecklists] = useState<PilotChecklist[]>([]);
  const [items, setItems] = useState<PilotChecklistItem[]>([]);
  const [opsSummary, setOpsSummary] = useState<any>(null);
  const [opsAlerts, setOpsAlerts] = useState<any[]>([]);
  const [inactivePoints, setInactivePoints] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [inviteCodes, setInviteCodes] = useState<any[]>([]);
  const [communityMissions, setCommunityMissions] = useState<any[]>([]);
  const [inviteStats, setInviteStats] = useState<{ opened: number, created: number }>({ opened: 0, created: 0 });
  const [recentFeedback, setRecentFeedback] = useState<any[]>([]);
  const [logisticsDeficits, setLogisticsDeficits] = useState<any[]>([]);
  const [activeAnchors, setActiveAnchors] = useState<any[]>([]);
  const [launchStatus, setLaunchStatus] = useState<any>(null);
  const [goLiveItems, setGoLiveItems] = useState<any[]>([]);
  const [improvementPlan, setImprovementPlan] = useState<any[]>([]);
  const [taskRollup, setTaskRollup] = useState<any>(null);
  const [goLiveLoading, setGoLiveLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadInitial() {
      setLoading(true);
      const { data: pData } = await supabase.from("pilot_programs").select("*").order("status", { ascending: false });
      const availablePrograms = pData || [];
      setPrograms(availablePrograms);

      if (availablePrograms.length > 0) {
        const active = availablePrograms.find(p => p.status === 'active') || availablePrograms[0];
        setSelectedProgramId(active.id);
        await loadProgramData(active.id);
      } else {
        setLoading(false);
      }
    }
    loadInitial();
  }, [supabase]);

  const loadProgramData = async (programId: string) => {
    setLoading(true);
    const [{ data: nData }, { data: cData }] = await Promise.all([
      supabase.from("pilot_program_neighborhoods").select("*, neighborhood:neighborhoods(*)").eq("program_id", programId),
      supabase.from("pilot_checklists").select("*").eq("program_id", programId)
    ]);

    setNeighborhoods(nData || []);
    setChecklists(cData || []);

    // Fetch items for these checklists
    if (cData && cData.length > 0) {
      const { data: iData } = await supabase
        .from("pilot_checklist_items")
        .select("*")
        .in("checklist_id", cData.map(c => c.id));
      setItems(iData || []);
    } else {
      setItems([]);
    }
    // Fetch intelligence summary (using the first neighborhood associated with the program)
    if (nData && nData.length > 0) {
      const neighborId = nData[0].neighborhood_id;

      // Refresh alerts in DB and trigger webhooks if critical
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/admin/health/refresh-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ neighborhood_id: neighborId })
      });

      const { data: summaryData } = await supabase
        .from("v_neighborhood_ops_summary_7d")
        .select("*")
        .eq("neighborhood_id", neighborId)
        .maybeSingle();
      setOpsSummary(summaryData);

      const { data: alertsData } = await supabase
        .from("ops_alerts")
        .select("*")
        .eq("neighborhood_id", neighborId)
        .eq("active", true);
      setOpsAlerts(alertsData || []);

      const { data: inactData } = await supabase
        .from("v_drop_point_inactivity_14d")
        .select("*")
        .eq("neighborhood_id", neighborId)
        .in("status", ["stale", "inactive"]);
      setInactivePoints(inactData || []);

      // Fetch Launch Status for display
      const { data: lData } = await supabase
        .from("eco_launch_controls")
        .select("*")
        .or(`scope.eq.global,and(scope.eq.neighborhood,neighborhood_id.eq.${neighborId})`)
        .order("scope", { ascending: false })
        .limit(1);

      const { count: gCount } = await supabase
        .from("eco_access_grants")
        .select("*", { count: 'exact', head: true })
        .eq("neighborhood_id", neighborId)
        .eq("active", true);

      setLaunchStatus({
        ...(lData?.[0] || {}),
        grants_count: gCount || 0
      });

      const { data: promoData } = await supabase
        .from("drop_point_promotions")
        .select("*, drop_point:eco_drop_points(name)")
        .eq("neighborhood_id", neighborId)
        .gte("expires_at", new Date().toISOString());
      setPromotions(promoData || []);

      const { data: inviteData } = await supabase
        .from("invite_codes")
        .select("*")
        .eq("neighborhood_id", neighborId)
        .eq("active", true);
      setInviteCodes(inviteData || []);

      const { data: missionData } = await supabase
        .from("community_missions")
        .select("*, progress:mission_progress(*)")
        .eq("neighborhood_id", neighborId)
        .eq("active", true);
      setCommunityMissions(missionData || []);

      // Simples invite stats 7d
      const { count: openedCount } = await supabase
        .from("invite_events")
        .select("*", { count: 'exact', head: true })
        .eq("event_kind", "opened")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      setInviteStats({ opened: openedCount || 0, created: inviteData?.length || 0 });

      // Fetch recent feedback 7d
      const { data: feedbackData } = await supabase
        .from("eco_feedback_items")
        .select("*, profile:profiles!eco_feedback_items_created_by_fkey(name, role)")
        .eq("neighborhood_id", neighborId)
        .order("created_at", { ascending: false })
        .limit(3);
      setRecentFeedback(feedbackData || []);

      // Fetch logistics deficits for this neighborhood
      const { data: logData } = await supabase
        .from("v_asset_restock_needed")
        .select("*")
        .eq("neighborhood_id", neighborId);
      setLogisticsDeficits(logData || []);

      // Fetch active anchors for bulletin
      const { data: anchorsData } = await supabase
        .from("eco_partner_status")
        .select("*, partner:partners(name)")
        .eq("status", "anchor")
        .eq("partner:partners.neighborhood_id", neighborId);
      setActiveAnchors(anchorsData || []);
      // Fetch Go-Live Checklist
      const { data: glChecklist } = await supabase
        .from("eco_go_live_checklist")
        .select("id, items:eco_go_live_items(*)")
        .eq("neighborhood_id", neighborId)
        .maybeSingle();

      if (glChecklist) {
        setGoLiveItems(glChecklist.items || []);
      } else {
        setGoLiveItems([]);
      }

      // Fetch Improvement Plan (A28)
      const { data: cellData } = await supabase
        .from("eco_cell_neighborhoods")
        .select("cell_id")
        .eq("neighborhood_id", neighborId)
        .maybeSingle();

      if (cellData) {
        const { data: cycles } = await supabase
          .from("eco_improvement_cycles")
          .select("id")
          .eq("cell_id", cellData.cell_id)
          .eq("cycle_kind", 'weekly')
          .eq("status", 'open')
          .order("period_start", { ascending: false })
          .limit(1);

        if (cycles?.[0]) {
          const { data: iPlanItems } = await supabase
            .from("eco_improvement_items")
            .select("*")
            .eq("cycle_id", cycles[0].id)
            .neq("status", 'done')
            .order("severity", { ascending: false })
            .limit(3);
          setImprovementPlan(iPlanItems || []);
        } else {
          setImprovementPlan([]);
        }

        // Fetch Weekly Task Rollup (A50)
        const monday = new Date();
        monday.setDate(monday.getDate() - monday.getDay() + (monday.getDay() === 0 ? -6 : 1));
        const mondayStr = monday.toISOString().split('T')[0];

        const { data: rollupData } = await supabase
          .from("eco_task_rollups_weekly")
          .select("*")
          .eq("cell_id", cellData.cell_id)
          .eq("week_start", mondayStr)
          .maybeSingle();
        setTaskRollup(rollupData);
      } else {
        setImprovementPlan([]);
        setTaskRollup(null);
      }
    } else {
      setOpsSummary(null);
      setOpsAlerts([]);
      setInactivePoints([]);
      setPromotions([]);
      setInviteCodes([]);
      setCommunityMissions([]);
      setInviteStats({ opened: 0, created: 0 });
      setRecentFeedback([]);
      setLogisticsDeficits([]);
      setGoLiveItems([]);
    }

    setLoading(false);
  };

  const initGoLive = async () => {
    if (!neighborhoods[0]) return;
    setGoLiveLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/go-live/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ neighborhood_id: neighborhoods[0].neighborhood_id })
      });
      if (!res.ok) throw new Error("Falha ao inicializar checklist.");
      await loadProgramData(selectedProgramId);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGoLiveLoading(false);
    }
  };

  const toggleGoLiveItem = async (itemId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/go-live/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ item_id: itemId, status: newStatus })
      });
      if (!res.ok) throw new Error("Falha ao atualizar item.");
      setGoLiveItems(goLiveItems.map(i => i.id === itemId ? { ...i, status: newStatus } : i));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleProgramChange = (id: string) => {
    setSelectedProgramId(id);
    loadProgramData(id);
  };

  const generateBulletinContent = () => {
    if (!opsSummary) return;
    const blocks = [];

    // Performance
    blocks.push(`### 📟 Desempenho Logístico`);
    if (opsSummary.busiest_window_label) {
      blocks.push(`🕒 Janela preferida: ${opsSummary.busiest_window_label}`);
    }
    const okRate = Math.round((opsSummary.ok_rate || 0) * 100);
    blocks.push(`✅ Qualidade da semana: ${okRate}% (recebimentos: ${opsSummary.total_receipts || 0})`);

    // Inactivity Awareness
    if (inactivePoints.length > 0) {
      blocks.push(`\n### 🚨 Pontos Precisando de Energia`);
      inactivePoints.slice(0, 3).forEach(p => {
        blocks.push(`📍 ${p.name} (${p.status}) - sem pedidos há ${p.days_since_last_request} dias`);
      });
    }

    // Active Promotions
    if (promotions.length > 0) {
      blocks.push(`\n### ⚡ Campanhas de Reativação`);
      promotions.forEach(p => {
        blocks.push(`🔗 **${p.title}** no Ponto ${p.drop_point?.name || 'ECO'}`);
      });
    }

    if (opsSummary.top_flags && opsSummary.top_flags.length > 0) {
      blocks.push(`\n⚠️ Fique atento: ${opsSummary.top_flags.join(', ')}`);
    }

    // Community Growth & Missions
    blocks.push(`\n### 🌱 Crescimento do Comum`);
    blocks.push(`📈 Novos convites abertos: ${inviteStats.opened}`);

    if (communityMissions.length > 0) {
      blocks.push(`\n🎯 Missões em Foco:`);
      communityMissions.forEach(m => {
        const p = m.progress?.[0] || { progress_count: 0, goal_count: 10 };
        blocks.push(`- **${m.title}**: ${p.progress_count}/${p.goal_count}`);
      });
    }

    // Partnership Policy & Anchors
    if (activeAnchors.length > 0) {
      blocks.push(`\n### ⚓ Parcerias do Comum (Política v1.0)`);
      activeAnchors.forEach(a => {
        blocks.push(`- **${a.partner?.name}**: Status Âncora (${a.tier || 'Base'}) - Consistência auditada.`);
      });
    }

    const text = blocks.join('\n');
    alert(`Copiado para o boletim:\n\n${text}`);
    navigator.clipboard.writeText(text);
  };
  const toggleItemStatus = async (item: PilotChecklistItem) => {
    const newStatus = item.status === 'done' ? 'todo' : 'done';
    const { error } = await supabase
      .from("pilot_checklist_items")
      .update({
        status: newStatus,
        completed_at: newStatus === 'done' ? new Date().toISOString() : null
      })
      .eq("id", item.id);

    if (error) alert(error.message);
    else {
      setItems(items.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
    }
  };

  const createInvite = async (scope: 'neighborhood' | 'drop_point', dropPointId?: string) => {
    if (!neighborhoods[0]) return;
    const neighborId = neighborhoods[0].neighborhood_id;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    setSaving(true);
    const { data, error } = await supabase
      .from("invite_codes")
      .insert({
        code,
        scope,
        neighborhood_id: neighborId,
        drop_point_id: dropPointId || null,
        active: true
      })
      .select()
      .single();

    if (error) alert(error.message);
    else setInviteCodes([...inviteCodes, data]);
    setSaving(false);
  };

  const recalculateMissions = async () => {
    setSaving(true);
    const { error } = await supabase.rpc('rpc_apply_mission_events', {
      p_since: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      p_until: new Date().toISOString()
    });

    if (error) {
      alert("Erro ao recalcular: " + error.message);
      reportObsEvent({
        event_kind: 'rpc_error',
        severity: 'error',
        context_kind: 'rpc',
        context_key: 'rpc_apply_mission_events',
        message: `Falha ao recalcular missões: ${error.message}`,
        neighborhood_id: neighborhoods[0]?.neighborhood_id
      });
    }
    else {
      alert("Missões recalculadas com sucesso!");
      // Reload data to show updated progress
      if (neighborhoods[0]) {
        loadProgramData(selectedProgramId);
      }
    }
    setSaving(false);
  };

  const program = programs.find(p => p.id === selectedProgramId);

  if (loading) return <LoadingBlock text="Carregando painel do piloto..." />;

  const statsByChecklist = checklists.map(c => {
    const cItems = items.filter(i => i.checklist_id === c.id);
    const done = cItems.filter(i => i.status === 'done').length;
    return {
      id: c.id,
      title: c.title,
      total: cItems.length,
      done,
      pct: cItems.length > 0 ? (done / cItems.length) * 100 : 0
    };
  });

  return (
    <div className="animate-slide-up pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2">
          <Rocket className="text-primary" size={32} />
          <h1 className="stencil-text text-3xl">PILOT PACK VR</h1>
        </div>

        <select
          className="field max-w-xs"
          value={selectedProgramId}
          onChange={(e) => handleProgramChange(e.target.value)}
        >
          {programs.map(p => (
            <option key={p.id} value={p.id}>{p.city} ({p.status.toUpperCase()})</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-8">
          {/* Resumo do Programa */}
          <section className="card">
            <h2 className="stencil-text text-lg mb-4 flex items-center gap-2">
              <Layout size={20} /> PROGRAMA: {program?.city}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <span className="font-black text-[10px] uppercase text-muted">Bairros Cobertos</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {neighborhoods.map(pn => (
                    <span key={pn.id} className="bg-primary/10 border border-primary px-2 py-1 font-bold text-xs uppercase">
                      {pn.neighborhood?.name}
                    </span>
                  ))}
                  {neighborhoods.length === 0 && <span className="text-muted-foreground text-xs font-bold uppercase italic">Nenhum bairro vinculado</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-black text-[10px] uppercase text-muted">Status do Programa</span>
                <p className="font-black text-xl uppercase text-primary">{program?.status}</p>
                {program?.starts_on && (
                  <p className="font-bold text-[10px] uppercase">Lançamento: {new Date(program.starts_on).toLocaleDateString()}</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 border-2 border-foreground ${launchStatus?.is_open ? 'bg-primary' : 'bg-muted'}`}>
                    ABERTURA: {launchStatus?.is_open ? 'ON' : 'OFF'} ({launchStatus?.open_mode === 'invite_only' ? 'CONVITE' : 'ABERTO'})
                  </span>
                  <span className="text-[10px] font-black uppercase underline cursor-help" title="Total de acessos concedidos">
                    GRANTS: {launchStatus?.grants_count || 0}
                  </span>
                </div>
              </div>
            </div>
            {program?.notes_public && (
              <div className="mt-6 p-4 bg-muted/20 border-l-4 border-foreground">
                <span className="font-black text-[10px] uppercase text-muted d-block mb-1">Nota Pública</span>
                <p className="font-bold text-sm italic">{program.notes_public}</p>
              </div>
            )}
          </section>

          {/* Alertas e Sugestões Operacionais */}
          {opsAlerts.length > 0 && (
            <section className="animate-slide-up">
              <h3 className="stencil-text text-sm mb-4 flex items-center gap-2">
                <AlertTriangle size={16} className="text-accent" /> SUGESTÕES DE AÇÃO
              </h3>
              <div className="flex flex-col gap-3">
                {opsAlerts.map((alert, i) => (
                  <div key={i} className="card border-2 border-accent bg-accent/5 p-4 flex gap-4 items-center">
                    <div className="p-2 bg-accent text-white border-2 border-foreground shrink-0">
                      <AlertCircle size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-xs uppercase leading-tight">{alert.message}</p>
                      <div className="mt-2 flex gap-2">
                        {alert.kind.includes('capacity') && (
                          <button className="text-[9px] font-black uppercase bg-primary px-2 py-1 border-2 border-foreground hover:translate-x-0.5 hover:translate-y-0.5">
                            Abrir Vaga Extra
                          </button>
                        )}
                        {alert.kind === 'quality_drop' && (
                          <button className="text-[9px] font-black uppercase bg-white px-2 py-1 border-2 border-foreground hover:translate-x-0.5 hover:translate-y-0.5">
                            Notificar Educativo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Plano da Semana (A28) */}
          {improvementPlan.length > 0 && (
            <section className="animate-slide-up">
              <h3 className="stencil-text text-sm mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-secondary" /> PLANO DA SEMANA (ESTADO DA NAÇÃO)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {improvementPlan.map(item => (
                  <div key={item.id} className="card bg-white border-2 border-foreground/10 p-4 hover:border-secondary transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 border border-foreground ${item.severity === 'blocker' ? 'bg-red-600 text-white' :
                        item.severity === 'high' ? 'bg-yellow-400' : 'bg-foreground text-white'
                        }`}>
                        {item.severity}
                      </span>
                      <span className="text-[8px] font-black uppercase opacity-60">{item.category}</span>
                    </div>
                    <h4 className="font-black text-[11px] uppercase leading-tight mb-2">{item.title}</h4>
                    <p className="text-[9px] font-bold uppercase opacity-50 line-clamp-2">{item.summary}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tarefas do Comum (A50) */}
          {taskRollup && (
            <section className="animate-slide-up">
              <h3 className="stencil-text text-sm mb-4 flex items-center gap-2">
                <ClipboardList size={16} className="text-primary" /> FORÇA DE TRABALHO DO COMUM (SEMANA)
              </h3>
              <div className="card bg-foreground text-white border-foreground p-6 flex flex-col md:flex-row items-center justify-between gap-8 shadow-[4px_4px_0_0_rgba(255,193,7,1)]">
                <div className="flex flex-col items-center md:items-start shrink-0">
                  <span className="text-[10px] font-black uppercase opacity-60">Tarefas Concluídas</span>
                  <span className="stencil-text text-5xl text-primary">{taskRollup.done_count}</span>
                </div>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                  {Object.entries(taskRollup.kinds || {}).map(([kind, count]: [string, any]) => (
                    <div key={kind} className="flex flex-col border-l-2 border-white/20 pl-3">
                      <span className="text-[8px] font-black uppercase opacity-60 line-clamp-1">{kind}</span>
                      <span className="font-black text-xl">{count}</span>
                    </div>
                  ))}
                </div>
                <Link href="/admin/tarefas" className="cta-button tiny bg-primary text-black whitespace-nowrap">
                  VER DETALHES
                </Link>
              </div>
            </section>
          )}

          {/* Go-Live Checklist (A25) */}
          <section className="card border-2 border-primary bg-primary/5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="stencil-text text-xl flex items-center gap-2">
                <ShieldCheck size={24} /> CHECKLIST GO-LIVE
              </h2>
              {goLiveItems.length === 0 && (
                <button
                  className="cta-button tiny"
                  onClick={initGoLive}
                  disabled={goLiveLoading}
                >
                  {goLiveLoading ? 'INICIANDO...' : 'INICIAR CHECKLIST'}
                </button>
              )}
            </div>

            {goLiveItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                {goLiveItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 hover:bg-white/50 transition-colors border-b border-primary/10">
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleGoLiveItem(item.id, item.status)}>
                        {item.status === 'done' ? (
                          <CheckCircle2 size={18} className="text-primary" />
                        ) : (
                          <Circle size={18} className="text-muted" />
                        )}
                      </button>
                      <span className={`text-xs font-black uppercase ${item.status === 'done' ? 'line-through opacity-50' : ''}`}>
                        {item.title}
                      </span>
                    </div>
                    {item.status === 'todo' && (
                      <button
                        className="text-[9px] font-bold text-red-500 uppercase hover:underline"
                        onClick={() => {
                          const note = prompt("Motivo do bloqueio:");
                          if (note) {
                            fetch('/api/admin/go-live/update', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ item_id: item.id, status: 'blocked', notes: note })
                            }).then(() => {
                              setGoLiveItems(goLiveItems.map(i => i.id === item.id ? { ...i, status: 'blocked', notes: note } : i));
                            });
                          }
                        }}
                      >
                        Bloquear
                      </button>
                    )}
                    {item.status === 'blocked' && (
                      <span className="text-[9px] font-bold text-red-500 uppercase bg-red-100 px-1 border border-red-500">
                        BLOQUEADO: {item.notes}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-bold text-muted uppercase">Nenhum checklist de abertura encontrado para este bairro.</p>
            )}
          </section>

          {/* Rituais e Checklists */}
          <section className="flex flex-col gap-6">
            <h2 className="stencil-text text-xl flex items-center gap-2">
              <CheckCircle2 size={24} /> RITUAIS OPERACIONAIS
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {statsByChecklist.map(s => (
                <div key={s.id} className="card bg-white hover:border-primary transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-black text-sm uppercase">{s.title}</h3>
                    <span className="font-black text-xs">{s.done}/{s.total}</span>
                  </div>
                  <div className="w-full bg-muted h-2 border border-foreground/10 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                  <div className="flex flex-col gap-2 mt-4">
                    {items.filter(i => i.checklist_id === s.id).map(item => (
                      <button
                        key={item.id}
                        onClick={() => toggleItemStatus(item)}
                        className={`flex items-center gap-2 text-left p-1 rounded hover:bg-muted/10 transition-colors ${item.status === 'done' ? 'opacity-60' : ''}`}
                      >
                        {item.status === 'done' ? <CheckCircle2 size={16} className="text-primary" /> : <Circle size={16} />}
                        <span className={`text-xs font-bold uppercase ${item.status === 'done' ? 'line-through' : ''}`}>
                          {item.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {checklists.length === 0 && (
                <div className="card md:col-span-2 border-dashed flex flex-col items-center py-12 text-muted">
                  <p className="font-black text-xs uppercase">Nenhum ritual definido para este programa</p>
                  <button className="cta-button small mt-4">Criar Rituais Padrão</button>
                </div>
              )}
            </div>
          </section>

          {/* Comunicação Operacional */}
          {neighborhoods[0] && (
            <CommSection
              neighborhoodId={neighborhoods[0].neighborhood_id}
              neighborhoodSlug={neighborhoods[0].neighborhood?.slug || ""}
            />
          )}
        </div>

        {/* Sidebar: Atalhos e Resumo 7 dias */}
        <div className="flex flex-col gap-8">
          <section className="card bg-foreground text-white border-foreground shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
            <h3 className="stencil-text text-sm mb-4 uppercase text-primary">Ações de Comando</h3>
            <div className="flex flex-col gap-3">
              <button className="cta-button small w-full justify-between" style={{ background: 'white' }}>
                GERAR PEDIDOS RECORRENTES
                <Rocket size={16} />
              </button>
              <Link href="/admin/galpao" className="cta-button small w-full justify-between" style={{ background: 'white' }}>
                ABRIR GALPÃO
                <Layout size={16} />
              </Link>
              <button className="cta-button small w-full justify-between" style={{ background: 'white' }} onClick={generateBulletinContent}>
                PUBLICAR BOLETIM
                <Package size={16} />
              </button>
              <Link href="/admin/campanha" className="cta-button small w-full justify-between bg-secondary text-white">
                GERAR CAMPANHA DE CULTURA
                <Megaphone size={16} />
              </Link>
              {neighborhoods[0] && (
                <a
                  href={`/api/print/placa?kind=neighborhood&id=${neighborhoods[0].neighborhood?.slug}&format=a4`}
                  target="_blank"
                  className="cta-button small w-full justify-between bg-primary text-black"
                >
                  BAIXAR PLACA DO BAIRRO (A4)
                  <Download size={16} />
                </a>
              )}
            </div>
          </section>

          {/* Feedback da Semana */}
          <section className="card border-2 border-secondary bg-secondary/5">
            <h3 className="stencil-text text-sm mb-4 uppercase flex items-center justify-between">
              <span>Feedback da Semana</span>
              <Link href="/admin/feedback" className="text-[10px] underline">Ver todos</Link>
            </h3>
            <div className="flex flex-col gap-3">
              {recentFeedback.length === 0 ? (
                <p className="text-[10px] font-bold uppercase text-center opacity-50 py-4">Sem feedback esta semana.</p>
              ) : (
                recentFeedback.map((f: any) => (
                  <div key={f.id} className="bg-white p-2 border border-foreground/10">
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-[8px] font-black uppercase px-1 border border-foreground ${f.severity === 'blocker' ? 'bg-red-500 text-white' :
                        f.severity === 'high' ? 'bg-orange-400' : 'bg-yellow-400'
                        }`}>
                        {f.severity}
                      </span>
                      <span className="text-[8px] font-bold text-muted uppercase">
                        {new Date(f.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[10px] font-black uppercase leading-tight line-clamp-2">{f.summary}</p>
                    <p className="text-[8px] font-bold uppercase text-muted mt-1">{f.profile?.name || 'ANÔNIMO'}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Logística Física */}
          <section className="card border-2 border-foreground bg-white">
            <h3 className="stencil-text text-sm mb-4 uppercase flex items-center justify-between">
              <span>Logística Física</span>
              <Link href="/admin/logistica" className="text-[10px] underline">Painel Completo</Link>
            </h3>
            <div className="flex flex-col gap-3">
              {logisticsDeficits.length === 0 ? (
                <div className="flex flex-col items-center py-4 text-green-600">
                  <CheckCircle2 size={32} className="opacity-40 mb-2" />
                  <p className="text-[10px] font-bold uppercase">Kits e Placas em dia</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-black uppercase text-accent mb-2">Reposição Necessária:</p>
                  {logisticsDeficits.map((d: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-2 border-l-4 border-accent bg-accent/5">
                      <span className="text-[10px] font-bold uppercase">{d.asset_name}</span>
                      <span className="text-xs font-black">-{d.deficit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="card border-2 border-primary bg-primary/5">
            <h3 className="stencil-text text-sm mb-4 uppercase flex items-center gap-2">
              <Target size={16} className="text-primary" /> MISSÕES DO COMUM
            </h3>
            <div className="flex flex-col gap-4">
              {communityMissions.length === 0 ? (
                <p className="text-[10px] font-bold uppercase text-center opacity-50 py-4">Sem missões ativas no bairro.</p>
              ) : (
                communityMissions.slice(0, 3).map(m => {
                  const p = m.progress?.[0] || { progress_count: 0, goal_count: 10 };
                  const pct = Math.min(100, (p.progress_count / p.goal_count) * 100);
                  return (
                    <div key={m.id} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase">
                        <span>{m.title}</span>
                        <span>{p.progress_count}/{p.goal_count}</span>
                      </div>
                      <div className="w-full h-2 bg-white border border-foreground/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <p className="text-[8px] font-bold uppercase mt-4 opacity-50 text-center">Progresso atualizado via eventos automáticos.</p>
          </section>

          <section className="card bg-muted/10 border-foreground/20">
            <h3 className="stencil-text text-sm mb-4 uppercase flex items-center gap-2">
              <Package size={16} /> Kit de Rua ECO
            </h3>
            <div className="flex flex-col gap-3">
              <a
                href={`/api/print/kit?kind=operator_badge&format=card&neighborhood_slug=${neighborhoods[0]?.neighborhood?.slug}`}
                target="_blank"
                className="cta-button small w-full justify-between bg-white text-black"
              >
                CRACHÁ DO OPERADOR
                <Download size={16} />
              </a>
              <a
                href={`/api/print/kit?kind=pilot_day_script&format=a4&neighborhood_slug=${neighborhoods[0]?.neighborhood?.slug}`}
                target="_blank"
                className="cta-button small w-full justify-between bg-white text-black"
              >
                ROTEIRO RÁPIDO (A4)
                <Download size={16} />
              </a>
              <a
                href={`/api/print/kit?kind=operator_checklist&format=a4&neighborhood_slug=${neighborhoods[0]?.neighborhood?.slug}`}
                target="_blank"
                className="cta-button small w-full justify-between bg-white text-black"
              >
                RITUAL DO DIA (A4)
                <Download size={16} />
              </a>
            </div>
          </section>

          <section className="card">
            <h3 className="stencil-text text-sm mb-4 uppercase flex items-center gap-2">
              <QrCode size={16} /> Crescimento do Comum
            </h3>
            <div className="flex flex-col gap-4">
              <button
                onClick={() => createInvite('neighborhood')}
                disabled={saving}
                className="cta-button small w-full justify-center"
              >
                GERAR CONVITE DO BAIRRO
              </button>

              <button
                onClick={recalculateMissions}
                disabled={saving}
                className="cta-button small w-full justify-center"
                style={{ background: 'white' }}
              >
                RECALCULAR MISSÕES (14D)
                <RefreshCw size={14} className={saving ? 'animate-spin' : ''} />
              </button>

              <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                {inviteCodes.map(inv => {
                  const url = `${window.location.origin}/i/${inv.code}`;
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;
                  return (
                    <div key={inv.id} className="p-2 border-2 border-foreground bg-muted/5 flex flex-col gap-2">
                      <div className="flex justify-between items-center px-1">
                        <span className="font-black text-[10px] uppercase">{inv.code}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(url);
                              alert('Link copiado!');
                            }}
                            className="p-1 hover:text-primary"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                      <img src={qrUrl} alt="QR Code" className="w-full aspect-square border border-foreground/10" />
                      <p className="text-[8px] font-bold text-center break-all opacity-60 uppercase">{url}</p>
                    </div>
                  );
                })}
                {inviteCodes.length === 0 && (
                  <p className="text-[10px] font-bold uppercase text-center opacity-50 py-4">Nenhum convite gerado hoje.</p>
                )}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="stencil-text text-sm uppercase flex items-center gap-2">
                <Clock size={16} /> RESUMO 7 DIAS
              </h3>
              <button
                onClick={generateBulletinContent}
                disabled={!opsSummary}
                className="text-[9px] font-black uppercase bg-primary px-2 py-1 border-2 border-foreground hover:translate-x-0.5 hover:translate-y-0.5"
              >
                Gerar Blocos do Boletim
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-foreground/5 pb-2">
                <span className="font-bold text-[10px] uppercase">Total de Coletas</span>
                <span className="font-black text-sm">{opsSummary?.total_receipts || 0}</span>
              </div>
              <div className="flex justify-between items-center border-b border-foreground/5 pb-2">
                <span className="font-bold text-[10px] uppercase">Qualidade Média</span>
                <span className="font-black text-sm">{Math.round((opsSummary?.ok_rate || 0) * 100)}%</span>
              </div>
              <div className="flex justify-between items-center border-b border-foreground/5 pb-2">
                <span className="font-bold text-[10px] uppercase">Fila Prevista (7d)</span>
                <span className="font-black text-sm">{opsSummary?.total_requests || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-[10px] uppercase">Cobertura Recorrência</span>
                <span className="font-black text-sm">{Math.round((opsSummary?.recurring_coverage_pct || 0) * 100)}%</span>
              </div>
            </div>

            {inactivePoints.length > 0 && (
              <div className="mt-6 pt-4 border-t-2 border-dashed border-foreground/20">
                <span className="font-black text-[10px] uppercase text-accent d-block mb-3">Pontos Parados ({inactivePoints.length})</span>
                <div className="flex flex-col gap-2">
                  {inactivePoints.map(p => (
                    <div key={p.id} className="flex justify-between items-center text-[10px]">
                      <span className="font-bold uppercase truncate max-w-[120px]">{p.name}</span>
                      <span className={`font-black uppercase px-1 ${p.status === 'inactive' ? 'bg-accent text-white' : 'bg-yellow-400'}`}>{p.status}</span>
                    </div>
                  ))}
                  <Link href="/admin/inteligencia" className="text-[9px] font-black uppercase underline mt-2 hover:text-accent">
                    Ver Inteligência
                  </Link>
                </div>
              </div>
            )}
          </section>

          <div className="flex flex-col gap-3">
            <Link href="/admin/rotas" className="card hover:bg-muted/5 transition-colors flex items-center justify-between py-3 px-4 bg-white/50">
              <span className="font-black text-[10px] uppercase">Logística & Rotas</span>
              <ArrowRight size={14} />
            </Link>
            <Link href="/admin/ancoras" className="card hover:bg-muted/5 transition-colors flex items-center justify-between py-3 px-4 bg-white/50">
              <span className="font-black text-[10px] uppercase">Monitor Âncoras</span>
              <ArrowRight size={14} />
            </Link>
            <Link href="/governança" className="card hover:bg-muted/5 transition-colors flex items-center justify-between py-3 px-4 bg-white/50">
              <span className="font-black text-[10px] uppercase">Livro de Decisões</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
