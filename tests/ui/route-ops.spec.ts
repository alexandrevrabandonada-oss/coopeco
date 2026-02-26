import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInWithPassword } from "./helpers/auth";
import type { Page } from "@playwright/test";

const TEST_PW = "EcoTest123!";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY nao definidos.");
}

const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAILS = {
  resident: "eco.resident.alt@local",
  cooperado: "eco.cooperado.test@local",
  operator: "eco.operator.test@local",
};

let centroId = "";
let residentId = "";
let cooperadoId = "";

function dayAfter(weekday: number): number {
  return (weekday + 1) % 7;
}

async function loginAs(page: Page, email: string, role: "resident" | "operator") {
  const session = await signInWithPassword(email, TEST_PW);
  await page.addInitScript(
    ({ authPayload, accessToken }) => {
      window.localStorage.setItem("eco_e2e_auth", JSON.stringify(authPayload));
      window.localStorage.setItem("eco_e2e_access_token", accessToken);
    },
    {
      authPayload: {
        user: {
          id: session.user.id,
          email: session.user.email,
        },
        profile: {
          user_id: session.user.id,
          role,
          display_name: session.user.email || role.toUpperCase(),
          neighborhood_id: centroId,
          created_at: new Date().toISOString(),
        },
      },
      accessToken: session.access_token,
    },
  );
}

test.beforeAll(async () => {
  const { data: centerData, error: centerError } = await serviceClient
    .from("neighborhoods")
    .select("id")
    .eq("slug", "centro")
    .single<{ id: string }>();
  if (centerError || !centerData) throw centerError || new Error("Bairro centro nao encontrado.");
  centroId = centerData.id;

  const { data: usersData, error: usersError } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw usersError;

  const resident = usersData.users.find((user) => user.email === EMAILS.resident);
  const cooperado = usersData.users.find((user) => user.email === EMAILS.cooperado);
  const operator = usersData.users.find((user) => user.email === EMAILS.operator);
  if (!resident || !cooperado || !operator) throw new Error("Usuarios de teste nao encontrados.");

  residentId = resident.id;
  cooperadoId = cooperado.id;

  await serviceClient.auth.admin.updateUserById(resident.id, { password: TEST_PW });
  await serviceClient.auth.admin.updateUserById(operator.id, { password: TEST_PW });

  await serviceClient.from("profiles").upsert(
    {
      user_id: resident.id,
      role: "resident",
      display_name: "RESIDENTE ALT TESTE",
      neighborhood_id: centroId,
    },
    { onConflict: "user_id" },
  );
});

test("resident cria recorrencia com janela preferida", async ({ page }) => {
  const uniqueNote = `PW-REC-${Date.now()}`;

  const { data: windowRow, error: windowError } = await serviceClient
    .from("route_windows")
    .insert({
      neighborhood_id: centroId,
      weekday: 2,
      start_time: "09:00:00",
      end_time: "12:00:00",
      capacity: 25,
      active: true,
    })
    .select("id")
    .single<{ id: string }>();
  if (windowError || !windowRow) throw windowError || new Error("Falha ao criar janela para recorrencia.");

  await loginAs(page, EMAILS.resident, "resident");
  await page.goto("/recorrencia");
  await expect(page.getByRole("heading", { name: "RECORRÊNCIA", exact: true })).toBeVisible({ timeout: 60_000 });
  await page.getByPlaceholder("Ex.: portaria A / loja 12").fill(uniqueNote);
  await page.getByRole("button", { name: "Criar assinatura" }).click();

  await expect
    .poll(async () => {
      const { data } = await serviceClient
        .from("recurring_subscriptions")
        .select("id, status, preferred_window_id")
        .eq("created_by", residentId)
        .eq("notes", uniqueNote)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; status: string; preferred_window_id: string | null }>();
      return data || null;
    }, { timeout: 45_000 })
    .toEqual(expect.objectContaining({ status: "active", preferred_window_id: expect.any(String) }));
});

test("admin cria janela e ve metricas por janela", async ({ page }) => {
  const now = new Date();
  const startDate = new Date(now.getTime() + 5 * 60 * 1000);
  const endDate = new Date(now.getTime() + 65 * 60 * 1000);
  const startTime = `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}:00`;
  const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}:00`;

  const { data: immediateWindow, error: immediateWindowError } = await serviceClient
    .from("route_windows")
    .insert({
      neighborhood_id: centroId,
      weekday: now.getDay(),
      start_time: startTime,
      end_time: endTime,
      capacity: 15,
      active: true,
    })
    .select("id")
    .single<{ id: string }>();
  if (immediateWindowError || !immediateWindow) throw immediateWindowError || new Error("Falha ao criar janela imediata.");

  const { data: request, error: requestError } = await serviceClient
    .from("pickup_requests")
    .insert({
      created_by: residentId,
      neighborhood_id: centroId,
      route_window_id: immediateWindow.id,
      scheduled_for: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      status: "accepted",
      notes: "PW admin metricas janela",
    })
    .select("id")
    .single<{ id: string }>();
  if (requestError || !request) throw requestError || new Error("Falha ao criar request para metricas.");

  await serviceClient.from("pickup_assignments").upsert(
    {
      request_id: request.id,
      cooperado_id: cooperadoId,
    },
    { onConflict: "request_id" },
  );

  await serviceClient.from("receipts").insert({
    request_id: request.id,
    cooperado_id: cooperadoId,
    receipt_code: `PW${Date.now().toString(36).toUpperCase()}`,
    quality_status: "ok",
  });

  await expect
    .poll(async () => {
      const { data } = await serviceClient
        .from("v_route_window_queue_7d")
        .select("window_id")
        .eq("window_id", immediateWindow.id)
        .limit(1)
        .maybeSingle<{ window_id: string }>();
      return data?.window_id || null;
    }, { timeout: 45_000 })
    .toBe(immediateWindow.id);

  await loginAs(page, EMAILS.operator, "operator");
  await page.goto("/admin/rotas");
  await expect(page.getByText("ADMIN / ROTAS")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Fila por janela (7 dias)")).toBeVisible();
  await expect(page.getByText("Qualidade por janela (7 dias)")).toBeVisible();
  await expect(page.getByText("Sem fila recente para este bairro.")).toHaveCount(0);
});

test("operator gera recorrentes por janela sem duplicar ocorrencia", async ({ page }) => {
  const todayWeekday = new Date().getDay();
  const recurringWeekday = dayAfter(todayWeekday);

  const { data: targetWindow, error: targetWindowError } = await serviceClient
    .from("route_windows")
    .insert({
      neighborhood_id: centroId,
      weekday: recurringWeekday,
      start_time: "13:00:00",
      end_time: "16:00:00",
      capacity: 10,
      active: true,
    })
    .select("id")
    .single<{ id: string }>();
  if (targetWindowError || !targetWindow) throw targetWindowError || new Error("Falha ao criar janela alvo para recorrencia.");

  const { error: addressError } = await serviceClient.from("pickup_address_profiles").upsert(
    {
      user_id: residentId,
      address_full: "Rua Recorrencia UI, 100",
      contact_phone: "000000000",
    },
    { onConflict: "user_id" },
  );
  if (addressError) throw addressError;

  const { data: recurringSubscription, error: recurringSubscriptionError } = await serviceClient
    .from("recurring_subscriptions")
    .insert({
      created_by: residentId,
      neighborhood_id: centroId,
      scope: "resident",
      fulfillment_mode: "doorstep",
      cadence: "weekly",
      preferred_weekday: recurringWeekday,
      preferred_window_id: targetWindow.id,
      status: "active",
      notes: `PW-GEN-${Date.now()}`,
    })
    .select("id")
    .single<{ id: string }>();
  if (recurringSubscriptionError || !recurringSubscription) {
    throw recurringSubscriptionError || new Error("Falha ao criar assinatura para geração recorrente.");
  }

  await loginAs(page, EMAILS.operator, "operator");
  await page.goto("/admin/rotas");
  await expect(page.getByText("ADMIN / ROTAS")).toBeVisible({ timeout: 60_000 });

  await page.locator("select.field").first().selectOption(centroId);

  const recurringCard = page.locator(".card").filter({ hasText: "Recorrência operacional" }).first();
  await expect(recurringCard).toBeVisible();
  await recurringCard.locator("select.field").first().selectOption(targetWindow.id);
  await recurringCard.getByRole("button", { name: "Gerar pedidos recorrentes (próxima janela)" }).click();

  await expect(recurringCard.getByText("Resultado da geração")).toBeVisible();

  await expect
    .poll(async () => {
      const { data, error } = await serviceClient
        .from("recurring_occurrences")
        .select("id")
        .eq("subscription_id", recurringSubscription.id);
      if (error) throw error;
      return (data || []).length;
    }, { timeout: 45_000 })
    .toBe(1);

  await expect
    .poll(async () => {
      const { data, error } = await serviceClient
        .from("v_route_window_queue_7d")
        .select("requests_count")
        .eq("window_id", targetWindow.id)
        .limit(1)
        .maybeSingle<{ requests_count: number }>();
      if (error) throw error;
      return data?.requests_count || 0;
    }, { timeout: 45_000 })
    .toBeGreaterThan(0);

  await recurringCard.getByRole("button", { name: "Gerar pedidos recorrentes (próxima janela)" }).click();

  await expect
    .poll(async () => {
      const { data, error } = await serviceClient
        .from("recurring_occurrences")
        .select("id")
        .eq("subscription_id", recurringSubscription.id);
      if (error) throw error;
      return (data || []).length;
    }, { timeout: 45_000 })
    .toBe(1);
});

test("resident recebe alerta de recorrencia invalida e navega para /perfil/endereco", async ({ page }) => {
  const weekday = (new Date().getDay() + 2) % 7;
  const startHour = "14:00:00";

  const { data: windowRow, error: windowError } = await serviceClient
    .from("route_windows")
    .insert({
      neighborhood_id: centroId,
      weekday,
      start_time: startHour,
      end_time: "17:00:00",
      capacity: 8,
      active: true,
    })
    .select("id")
    .single<{ id: string }>();
  if (windowError || !windowRow) throw windowError || new Error("Falha ao criar janela para alerta recorrente.");

  await serviceClient.from("pickup_address_profiles").delete().eq("user_id", residentId);

  const { data: sub, error: subError } = await serviceClient
    .from("recurring_subscriptions")
    .insert({
      created_by: residentId,
      neighborhood_id: centroId,
      scope: "resident",
      fulfillment_mode: "doorstep",
      cadence: "weekly",
      preferred_weekday: weekday,
      preferred_window_id: windowRow.id,
      status: "active",
      notes: `PW-NOTIF-INVALID-${Date.now()}`,
    })
    .select("id")
    .single<{ id: string }>();
  if (subError || !sub) throw subError || new Error("Falha ao criar assinatura sem endereco.");

  const operatorSession = await signInWithPassword(EMAILS.operator, TEST_PW);
  const operatorRls = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${operatorSession.access_token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const scheduled = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { error: rpcError } = await operatorRls.rpc("rpc_generate_recurring_requests", {
    window_id: windowRow.id,
    scheduled_for: scheduled,
  });
  if (rpcError) throw rpcError;

  await expect
    .poll(async () => {
      const { data } = await serviceClient
        .from("user_notifications")
        .select("id")
        .eq("user_id", residentId)
        .eq("kind", "recurring_skipped_invalid")
        .eq("entity_type", "subscription")
        .eq("entity_id", sub.id)
        .limit(1)
        .maybeSingle<{ id: string }>();
      return data?.id || null;
    }, { timeout: 45_000 })
    .not.toBeNull();

  await loginAs(page, EMAILS.resident, "resident");
  await page.goto("/notificacoes");
  const recurringCard = page.locator(".card").filter({ hasText: "Faltou um dado pra sua recorrencia" }).first();
  await expect(recurringCard).toBeVisible({ timeout: 60_000 });
  await recurringCard.getByRole("link", { name: "Ir para ação" }).click();
  await expect(page).toHaveURL(/\/perfil\/endereco$/);
});

test("resident recebe notificacao de recibo pronto e abre /recibos/[id]", async ({ page }) => {
  const now = new Date();
  const { data: windowRow, error: windowError } = await serviceClient
    .from("route_windows")
    .insert({
      neighborhood_id: centroId,
      weekday: now.getDay(),
      start_time: "10:00:00",
      end_time: "13:00:00",
      capacity: 20,
      active: true,
    })
    .select("id")
    .single<{ id: string }>();
  if (windowError || !windowRow) throw windowError || new Error("Falha ao criar janela para request de recibo.");

  const scheduledFor = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  const { data: requestRow, error: requestError } = await serviceClient
    .from("pickup_requests")
    .insert({
      created_by: residentId,
      neighborhood_id: centroId,
      route_window_id: windowRow.id,
      scheduled_for: scheduledFor,
      status: "collected",
      notes: `PW-RECEIPT-NOTIF-${Date.now()}`,
    })
    .select("id")
    .single<{ id: string }>();
  if (requestError || !requestRow) throw requestError || new Error("Falha ao criar request para notificacao de recibo.");

  await serviceClient.from("pickup_assignments").upsert(
    { request_id: requestRow.id, cooperado_id: cooperadoId },
    { onConflict: "request_id" },
  );

  const { data: receiptRow, error: receiptError } = await serviceClient
    .from("receipts")
    .insert({
      request_id: requestRow.id,
      cooperado_id: cooperadoId,
      receipt_code: `PWN${Date.now().toString(36).toUpperCase()}`,
      quality_status: "ok",
    })
    .select("id")
    .single<{ id: string }>();
  if (receiptError || !receiptRow) throw receiptError || new Error("Falha ao criar recibo para notificacao.");

  await expect
    .poll(async () => {
      const { data } = await serviceClient
        .from("user_notifications")
        .select("id")
        .eq("user_id", residentId)
        .eq("kind", "receipt_ready")
        .eq("entity_type", "receipt")
        .eq("entity_id", receiptRow.id)
        .limit(1)
        .maybeSingle<{ id: string }>();
      return data?.id || null;
    }, { timeout: 45_000 })
    .not.toBeNull();

  await loginAs(page, EMAILS.resident, "resident");
  await page.goto("/notificacoes");
  const receiptCard = page.locator(".card").filter({ hasText: "Seu Recibo ECO esta pronto" }).first();
  await expect(receiptCard).toBeVisible({ timeout: 60_000 });
  await receiptCard.getByRole("link", { name: "Ir para ação" }).click();
  await expect(page).toHaveURL(new RegExp(`/recibos/${receiptRow.id}$`));
});
