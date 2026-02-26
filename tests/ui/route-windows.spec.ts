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
};

let centroId = "";
let residentId = "";
const residentName = "RESIDENTE ALT TESTE";

async function loginAs(page: Page, email: string, role: "resident" | "cooperado") {
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
  if (!resident || !cooperado) throw new Error("Usuarios de teste nao encontrados.");
  residentId = resident.id;
  await serviceClient.auth.admin.updateUserById(resident.id, { password: TEST_PW });
  await serviceClient.from("profiles").upsert(
    {
      user_id: resident.id,
      role: "resident",
      display_name: residentName,
      neighborhood_id: centroId,
    },
    { onConflict: "user_id" },
  );

  const { data: existingWindow } = await serviceClient
    .from("route_windows")
    .select("id")
    .eq("neighborhood_id", centroId)
    .eq("active", true)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingWindow?.id) {
    return;
  }

  const { data: createdWindow, error: createdWindowError } = await serviceClient
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
  if (createdWindowError || !createdWindow) throw createdWindowError || new Error("Falha ao criar route_window.");
});

test("resident escolhe janela ao pedir coleta", async ({ page }) => {
  await loginAs(page, EMAILS.resident, "resident");
  await serviceClient
    .from("request_rate_limits")
    .delete()
    .eq("user_id", residentId)
    .eq("day", new Date().toISOString().slice(0, 10));
  const uniqueNote = `PW-ROTA-${Date.now()}`;

  await page.goto("/pedir-coleta");
  await page.getByRole("button", { name: "PRÓXIMO: LOGÍSTICA" }).click();
  await page.getByPlaceholder("RUA, NÚMERO, APTO/BLOCO...").fill("Rua Playwright 100");
  await page.getByPlaceholder("(00) 00000-0000").fill("11999999999");
  await page.getByPlaceholder("EX: DEIXAREI NA PORTARIA...").fill(uniqueNote);

  const firstWindowRadio = page.locator('input[name="route_window"]').first();
  await expect(firstWindowRadio).toBeVisible();
  await firstWindowRadio.check();

  await page.getByRole("button", { name: "REVISAR PEDIDO" }).click();
  await page.getByRole("button", { name: "CONFIRMAR E PEDIR AGORA" }).click();

  await expect
    .poll(async () => {
      const { data } = await serviceClient
        .from("pickup_requests")
        .select("route_window_id, scheduled_for")
        .eq("created_by", residentId)
        .eq("notes", uniqueNote)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ route_window_id: string | null; scheduled_for: string | null }>();
      return {
        routeWindowId: data?.route_window_id || null,
        scheduledFor: data?.scheduled_for || null,
      };
    }, { timeout: 45_000 })
    .toEqual(expect.objectContaining({ routeWindowId: expect.any(String), scheduledFor: expect.any(String) }));
});

test("cooperado ve janela e aceita request", async ({ page }) => {
  await serviceClient
    .from("pickup_requests")
    .update({ status: "collected" })
    .eq("neighborhood_id", centroId)
    .eq("status", "open");

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
      capacity: 10,
      active: true,
    })
    .select("id")
    .single<{ id: string }>();
  if (immediateWindowError || !immediateWindow) throw immediateWindowError || new Error("Falha ao criar janela imediata.");

  const uniqueQty = 49;
  const { data: request, error: requestError } = await serviceClient
    .from("pickup_requests")
    .insert({
      created_by: residentId,
      neighborhood_id: centroId,
      route_window_id: immediateWindow.id,
      scheduled_for: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      notes: "PW rota cooperado",
      status: "open",
    })
    .select("id")
    .single<{ id: string }>();
  if (requestError || !request) throw requestError || new Error("Falha ao criar request para cooperado.");

  await serviceClient.from("pickup_request_items").insert({
    request_id: request.id,
    material: "paper",
    unit: "bag_m",
    qty: uniqueQty,
  });
  await serviceClient.from("pickup_request_private").upsert(
    {
      request_id: request.id,
      address_full: "Rua Janela Playwright",
      contact_phone: "000000000",
    },
    { onConflict: "request_id" },
  );

  await loginAs(page, EMAILS.cooperado, "cooperado");
  await page.goto("/cooperado");
  await page.getByRole("button", { name: "Este bairro" }).click();
  await expect(page.getByRole("button", { name: "ACEITAR COLETA" }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "ACEITAR COLETA" }).first().click();

  await expect
    .poll(async () => {
      const { data } = await serviceClient
        .from("pickup_requests")
        .select("status")
        .eq("id", request.id)
        .maybeSingle<{ status: string }>();
      return data?.status || null;
    }, { timeout: 30_000 })
    .toBe("accepted");
});
