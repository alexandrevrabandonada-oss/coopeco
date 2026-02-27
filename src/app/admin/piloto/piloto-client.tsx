"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { Neighborhood, PilotProgram, PilotProgramNeighborhood, PilotChecklist, PilotChecklistItem } from "@/types/eco";
import { LoadingBlock } from "@/components/loading-block";
import { Save, Target, Layout, Rocket, ArrowRight, CheckCircle2, Circle, Clock, Package, AlertTriangle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { isAnchorsFeatureEnabled, isGalpaoFeatureEnabled } from "@/lib/features";

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

      // Refresh alerts in DB
      await supabase.rpc('rpc_refresh_ops_alerts', { p_neighborhood_id: neighborId });

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

      const { data: promoData } = await supabase
        .from("drop_point_promotions")
        .select("*, drop_point:eco_drop_points(name)")
        .eq("neighborhood_id", neighborId)
        .gte("expires_at", new Date().toISOString());
      setPromotions(promoData || []);
    } else {
      setOpsSummary(null);
      setOpsAlerts([]);
      setInactivePoints([]);
      setPromotions([]);
    }

    setLoading(false);
  };

  const handleProgramChange = (id: string) => {
    setSelectedProgramId(id);
    loadProgramData(id);
  };

  const generateBulletinContent = () => {
    if (!opsSummary) return;
    const blocks = [];
    if (opsSummary.busiest_window_label) {
      blocks.push(`🕒 Janela mais carregada: ${opsSummary.busiest_window_label}`);
    }
    if (opsSummary.busiest_drop_point_name) {
      blocks.push(`📍 Ponto ECO mais movimentado: ${opsSummary.busiest_drop_point_name}`);
    }
    if (opsSummary.top_flags && opsSummary.top_flags.length > 0) {
      blocks.push(`⚠️ Principais alertas de qualidade: ${opsSummary.top_flags.join(', ')}`);
    }
    const okRate = Math.round((opsSummary.ok_rate || 0) * 100);
    blocks.push(`✅ Qualidade geral da semana: ${okRate}%`);

    const text = blocks.join('\n');
    alert(`Copiado para o boletim:\n\n${text}`);
    // In a real scenario, this would update a bulletin field or clipboard
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
              <button className="cta-button small w-full justify-between" style={{ background: 'white' }}>
                PUBLICAR BOLETIM
                <Package size={16} />
              </button>
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
