"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { Loader2, ShieldOff, Package, MapPin, CheckCircle2, Eye, Truck, User, Filter } from "lucide-react";
import Link from "next/link";
import { Profile, PickupRequest, RouteWindow } from "@/types/eco";
import { formatWindowLabel } from "@/lib/route-windows";

type FilterMode = "today" | "next_window" | "bairro";
type CooperadoTab = "requests" | "points" | "doorstep";

interface PickupRequestWithWindow extends PickupRequest {
  route_window?: RouteWindow | null;
}

export default function CooperadoDashboard() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const [openRequests, setOpenRequests] = useState<PickupRequestWithWindow[]>([]);
  const [myAssignments, setMyAssignments] = useState<PickupRequestWithWindow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>("next_window");
  const [activeTab, setActiveTab] = useState<CooperadoTab>("requests");
  const supabase = useMemo(() => createClient(), []);

  const p = profile as Profile;

  const loadData = useCallback(async () => {
    if (!p?.neighborhood_id || !user?.id) return;
    setIsLoading(true);

    const [{ data: open, error: openError }, { data: assignmentRows, error: assignmentsError }] = await Promise.all([
      supabase
        .from("pickup_requests")
        .select(`
          *,
          resident:profiles!pickup_requests_created_by_fkey(display_name),
          items:pickup_request_items(*),
          route_window:route_windows(*),
          drop_point:eco_drop_points(*)
        `)
        .eq("status", "open")
        .eq("neighborhood_id", p.neighborhood_id)
        .order("scheduled_for", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("pickup_assignments")
        .select("request_id")
        .eq("cooperado_id", user.id),
    ]);

    if (!openError && open) setOpenRequests(open as PickupRequestWithWindow[]);

    if (!assignmentsError && assignmentRows) {
      const requestIds = assignmentRows.map((row) => row.request_id);
      if (requestIds.length > 0) {
        const { data: mine } = await supabase
          .from("pickup_requests")
          .select(`
            *,
            resident:profiles!pickup_requests_created_by_fkey(display_name),
            items:pickup_request_items(*),
            private:pickup_request_private(*),
            route_window:route_windows(*),
            drop_point:eco_drop_points(*)
          `)
          .in("status", ["accepted", "en_route"])
          .in("id", requestIds)
          .order("scheduled_for", { ascending: true, nullsFirst: false });
        if (mine) setMyAssignments(mine as PickupRequestWithWindow[]);
      } else {
        setMyAssignments([]);
      }
    }

    setIsLoading(false);
  }, [p?.neighborhood_id, user?.id, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const acceptRequest = async (id: string) => {
    try {
      const { error: assignError } = await supabase
        .from("pickup_assignments")
        .insert({
          request_id: id,
          cooperado_id: user?.id,
        });
      if (assignError) throw assignError;

      const { error: updateError } = await supabase
        .from("pickup_requests")
        .update({ status: "accepted" })
        .eq("id", id);
      if (updateError) throw updateError;

      await loadData();
    } catch (err) {
      console.error(err);
      alert("Erro ao aceitar pedido.");
    }
  };

  const filteredOpenRequests = useMemo(() => {
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);

    if (filterMode === "bairro") {
      return openRequests;
    }

    if (filterMode === "today") {
      return openRequests.filter((request) =>
        request.scheduled_for ? request.scheduled_for.slice(0, 10) === todayKey : false,
      );
    }

    const upcoming = openRequests
      .filter((request) => request.scheduled_for && new Date(request.scheduled_for).getTime() >= now.getTime())
      .sort(
        (a, b) =>
          new Date(a.scheduled_for || 0).getTime() - new Date(b.scheduled_for || 0).getTime(),
      );
    if (upcoming.length === 0) return [];
    const nextRouteWindowId = upcoming[0].route_window_id || null;
    return upcoming.filter((request) => request.route_window_id === nextRouteWindowId);
  }, [openRequests, filterMode]);

  const groupedDropPointRequests = useMemo(() => {
    const groups = new Map<string, PickupRequestWithWindow[]>();
    for (const request of openRequests) {
      if (request.fulfillment_mode !== "drop_point") continue;
      const pointName = request.drop_point?.name || "Ponto ECO";
      const windowLabel = request.route_window ? formatWindowLabel(request.route_window) : "Sem janela";
      const key = `${pointName}__${windowLabel}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(request);
    }
    return Array.from(groups.entries()).map(([key, rows]) => {
      const [pointName, windowLabel] = key.split("__");
      return {
        pointName,
        windowLabel,
        rows: rows.sort(
          (a, b) =>
            new Date(a.scheduled_for || a.created_at).getTime() -
            new Date(b.scheduled_for || b.created_at).getTime(),
        ),
      };
    });
  }, [openRequests]);

  if (authLoading || (profile && isLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!p || !["cooperado", "operator"].includes(p.role)) {
    return (
      <div className="card text-center py-12 animate-slide-up">
        <ShieldOff size={48} className="mx-auto mb-4 text-accent" />
        <h2 className="stencil-text mb-4">ACESSO NEGADO</h2>
        <p className="mb-6 font-bold uppercase">ESTA PÁGINA É RESTRITA AOS COOPERADOS ECO.</p>
        <Link href="/perfil" className="cta-button mx-auto">VOLTAR AO PERFIL</Link>
      </div>
    );
  }

  return (
    <div className="animate-slide-up pb-12">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="stencil-text" style={{ fontSize: "2.5rem", background: "var(--primary)", padding: "0 8px", border: "2px solid var(--foreground)", width: "fit-content" }}>
          PAINEL COOPERADO
        </h1>
        <div className="flex items-center gap-2 font-black text-xs uppercase">
          <MapPin size={14} className="text-primary" /> REGIÃO: {p.neighborhood?.name || "CENTRO"}
        </div>
      </div>

      <section className="mb-10">
        <h2 className="stencil-text text-xl mb-4 flex items-center gap-2">
          <Truck size={24} /> MINHAS ENTREGAS ATIVAS
        </h2>
        {myAssignments.length === 0 ? (
          <div className="card text-center py-8 bg-muted/20 border-dashed">
            <p className="font-bold text-muted uppercase">VOCÊ NÃO TEM ENTREGAS EM ANDAMENTO.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {myAssignments.map((req) => (
              <div key={req.id} className="card p-0 overflow-hidden border-2 border-primary">
                <div className="p-4 bg-primary flex justify-between items-center">
                  <span className="font-black text-xs uppercase">COLETA EM ANDAMENTO</span>
                  <span className="font-bold text-[10px]">{req.status.toUpperCase()}</span>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <User size={16} /> <span className="font-extrabold">{req.resident?.display_name}</span>
                  </div>
                  <div className="flex flex-col gap-1 bg-white p-3 border-2 border-foreground mb-4">
                    <span className="text-[10px] font-black uppercase text-secondary">
                      {req.fulfillment_mode === "drop_point" ? "PONTO ECO:" : "ENDEREÇO DE COLETA:"}
                    </span>
                    <p className="font-bold text-sm uppercase mb-1">
                      {req.fulfillment_mode === "drop_point"
                        ? req.drop_point?.name || "Ponto ECO"
                        : req.private?.[0]?.address_full}
                    </p>
                    {req.fulfillment_mode === "drop_point" ? (
                      <p className="font-bold text-accent">{req.drop_point?.address_public || "-"}</p>
                    ) : (
                      <p className="font-bold text-accent">{req.private?.[0]?.contact_phone}</p>
                    )}
                    <p className="font-bold text-xs uppercase">
                      Janela: {req.route_window ? formatWindowLabel(req.route_window) : "ON-DEMAND"}
                    </p>
                  </div>
                  <Link href={`/cooperado/pedido/${req.id}`} className="cta-button w-full justify-center">
                    GERENCIAR COLETA <Eye size={20} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="stencil-text text-xl mb-4 flex items-center gap-2">
          <Package size={24} /> DISPONÍVEIS NO BAIRRO
        </h2>
        <div className="card mb-4 flex gap-2">
          <button className="cta-button small" style={{ background: activeTab === "requests" ? "var(--primary)" : "white" }} onClick={() => setActiveTab("requests")}>
            Pedidos
          </button>
          <button className="cta-button small" style={{ background: activeTab === "doorstep" ? "var(--primary)" : "white" }} onClick={() => setActiveTab("doorstep")}>
            Porta
          </button>
          <button className="cta-button small" style={{ background: activeTab === "points" ? "var(--primary)" : "white" }} onClick={() => setActiveTab("points")}>
            Pontos
          </button>
        </div>
        {activeTab === "requests" ? (
          <>
        <div className="card mb-4 flex flex-wrap gap-2 items-center">
          <Filter size={16} />
          <button className="cta-button small" style={{ background: filterMode === "today" ? "var(--primary)" : "white" }} onClick={() => setFilterMode("today")}>
            Hoje
          </button>
          <button className="cta-button small" style={{ background: filterMode === "next_window" ? "var(--primary)" : "white" }} onClick={() => setFilterMode("next_window")}>
            Próxima janela
          </button>
          <button className="cta-button small" style={{ background: filterMode === "bairro" ? "var(--primary)" : "white" }} onClick={() => setFilterMode("bairro")}>
            Este bairro
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {filteredOpenRequests.map((req) => (
            <div key={req.id} className="card">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-black text-sm uppercase">PEDIDO DE {req.resident?.display_name}</h3>
                  <p className="text-[10px] text-muted">{new Date(req.created_at).toLocaleTimeString()}</p>
                  <p className="text-[10px] font-bold uppercase">
                    {req.scheduled_for
                      ? `Agendado: ${new Date(req.scheduled_for).toLocaleString("pt-BR")}`
                      : "Sem agendamento (on-demand)"}
                  </p>
                  <p className="text-[10px] font-bold uppercase">
                    Janela: {req.route_window ? formatWindowLabel(req.route_window) : "ON-DEMAND"}
                  </p>
                  <p className="text-[10px] font-bold uppercase">
                    Modo: {req.fulfillment_mode === "drop_point" ? "Entrega em Ponto" : "Retirada em casa"}
                  </p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className="bg-muted text-foreground p-1 text-[10px] font-black uppercase border border-foreground">
                    {req.items?.length || 0} ITENS
                  </span>
                  {req.is_recurring && (
                    <span className="bg-primary text-foreground p-1 text-[10px] font-black uppercase border border-foreground">
                      RECORRENTE
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <ul className="flex flex-wrap gap-2 list-none p-0">
                  {req.items?.slice(0, 3).map((item, i: number) => (
                    <li key={i} className="bg-white border border-foreground/20 px-2 py-1 text-[10px] font-bold uppercase">
                      {item.material} ({item.qty})
                    </li>
                  ))}
                  {(req.items?.length ?? 0) > 3 && <li className="text-[10px] font-bold">+ {(req.items?.length ?? 0) - 3} MAIS</li>}
                </ul>
              </div>

              <button
                onClick={() => acceptRequest(req.id)}
                className="cta-button w-full justify-center py-4"
              >
                ACEITAR COLETA <CheckCircle2 size={20} />
              </button>
            </div>
          ))}
          {filteredOpenRequests.length === 0 && (
            <div className="card text-center py-8">
              <p className="font-bold text-muted uppercase">NÃO HÁ PEDIDOS ABERTOS PARA ESTE FILTRO.</p>
            </div>
          )}
        </div>
          </>
        ) : activeTab === "points" ? (
          <div className="flex flex-col gap-4">
            {groupedDropPointRequests.length === 0 ? (
              <div className="card text-center py-8">
                <p className="font-bold text-muted uppercase">SEM PEDIDOS DE PONTO NO MOMENTO.</p>
              </div>
            ) : (
              groupedDropPointRequests.map((group) => (
                <div key={`${group.pointName}-${group.windowLabel}`} className="card">
                  <h3 className="font-black text-sm uppercase mb-1">{group.pointName}</h3>
                  <p className="font-bold text-[10px] uppercase mb-3">Janela: {group.windowLabel}</p>
                  <div className="flex flex-col gap-2">
                    {group.rows.map((req) => (
                      <div key={req.id} className="border border-foreground p-2 bg-white flex items-center justify-between">
                        <div>
                          <p className="font-black text-[10px] uppercase">{req.resident?.display_name}</p>
                          <p className="font-bold text-[10px] uppercase">
                            {req.scheduled_for ? new Date(req.scheduled_for).toLocaleString("pt-BR") : "Sem horário"}
                          </p>
                        </div>
                        <button onClick={() => acceptRequest(req.id)} className="cta-button small">
                          ACEITAR
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredOpenRequests.filter((req) => req.fulfillment_mode !== "drop_point").length === 0 ? (
              <div className="card text-center py-8">
                <p className="font-bold text-muted uppercase">SEM PEDIDOS DE PORTA NO MOMENTO.</p>
              </div>
            ) : (
              filteredOpenRequests
                .filter((req) => req.fulfillment_mode !== "drop_point")
                .map((req) => (
                  <div key={req.id} className="card">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-black text-sm uppercase">PEDIDO DE {req.resident?.display_name}</h3>
                      {req.is_recurring && (
                        <span className="bg-primary text-foreground p-1 text-[10px] font-black uppercase border border-foreground">
                          RECORRENTE
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold uppercase mb-2">
                      {req.scheduled_for ? new Date(req.scheduled_for).toLocaleString("pt-BR") : "Sem agendamento"}
                    </p>
                    <button onClick={() => acceptRequest(req.id)} className="cta-button w-full justify-center py-4">
                      ACEITAR COLETA <CheckCircle2 size={20} />
                    </button>
                  </div>
                ))
            )}
          </div>
        )}
      </section>

      <style jsx>{`
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .flex-wrap { flex-wrap: wrap; }
        .items-center { align-items: center; }
        .justify-center { justify-content: center; }
        .justify-between { justify-content: space-between; }
        .gap-1 { gap: 0.25rem; }
        .gap-2 { gap: 0.5rem; }
        .gap-4 { gap: 1rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-3 { margin-bottom: 0.75rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-8 { margin-bottom: 2rem; }
        .mb-10 { margin-bottom: 2.5rem; }
        .p-0 { padding: 0; }
        .p-1 { padding: 0.25rem; }
        .p-2 { padding: 0.5rem; }
        .p-3 { padding: 0.75rem; }
        .p-4 { padding: 1rem; }
        .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
        .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
        .text-center { text-align: center; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .text-xs { font-size: 0.75rem; }
        .text-sm { font-size: 0.875rem; }
        .text-xl { font-size: 1.25rem; }
        .text-muted { color: #737373; }
        .text-accent { color: var(--accent); }
        .text-secondary { color: var(--secondary); }
        .bg-muted\/20 { background-color: rgba(115, 115, 115, 0.1); }
        .border-dashed { border-style: dashed; }
        .border-2 { border-width: 2px; }
      `}</style>
    </div>
  );
}
