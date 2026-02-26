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
let cooperadoId = "";

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
  cooperadoId = cooperado.id;
  await serviceClient.auth.admin.updateUserById(resident.id, { password: TEST_PW });
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

test("fluxo drop_point: resident cria sem endereco, cooperado aceita em Pontos e finaliza com qualidade", async ({ page }) => {
  const uniqueSuffix = Date.now().toString(36);
  const pointName = `Ponto ECO PW ${uniqueSuffix}`;
  const note = `PW-DROP-${uniqueSuffix}`;

  const now = new Date();
  const startDate = new Date(now.getTime() + 15 * 60 * 1000);
  const endDate = new Date(now.getTime() + 75 * 60 * 1000);
  const startTime = `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}:00`;
  const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}:00`;

  const { data: point, error: pointError } = await serviceClient
    .from("eco_drop_points")
    .insert({
      neighborhood_id: centroId,
      name: pointName,
      address_public: "Rua E2E, n. aproximado 100",
      hours: "Seg-Sex 09h-18h",
      accepted_materials: ["paper", "plastic"],
      active: true,
    })
    .select("id")
    .single<{ id: string }>();
  if (pointError || !point) throw pointError || new Error("Falha ao criar Ponto ECO de teste.");

  const { error: windowError } = await serviceClient.from("route_windows").insert({
    neighborhood_id: centroId,
    weekday: now.getDay(),
    start_time: startTime,
    end_time: endTime,
    capacity: 20,
    active: true,
  });
  if (windowError) throw windowError;

  await loginAs(page, EMAILS.resident, "resident");
  await serviceClient
    .from("request_rate_limits")
    .delete()
    .eq("user_id", residentId)
    .eq("day", new Date().toISOString().slice(0, 10));
  await page.goto("/pedir-coleta");

  await page.getByRole("button", { name: "PRÓXIMO: LOGÍSTICA" }).click();
  await page.getByRole("button", { name: "Entregar em Ponto" }).click();
  await page.locator("select").first().selectOption(point.id);
  await page.getByPlaceholder("EX: DEIXAREI NA PORTARIA...").fill(note);
  await page.getByRole("button", { name: "REVISAR PEDIDO" }).click();
  await page.getByRole("button", { name: "CONFIRMAR E PEDIR AGORA" }).click();

  let pickupRequestId: string | null = null;
  await expect
    .poll(async () => {
      const { data } = await serviceClient
        .from("pickup_requests")
        .select("id, fulfillment_mode, drop_point_id")
        .eq("created_by", residentId)
        .eq("notes", note)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; fulfillment_mode: string; drop_point_id: string | null }>();
      if (!data || data.fulfillment_mode !== "drop_point" || data.drop_point_id !== point.id) return null;
      pickupRequestId = data.id;
      return pickupRequestId;
    }, { timeout: 45_000 })
    .not.toBeNull();
  if (!pickupRequestId) throw new Error("Request drop_point nao encontrado.");
  const { data: privateRow } = await serviceClient
    .from("pickup_request_private")
    .select("request_id")
    .eq("request_id", pickupRequestId)
    .maybeSingle();
  expect(privateRow).toBeNull();

  await loginAs(page, EMAILS.cooperado, "cooperado");
  await page.goto("/cooperado");
  await page.getByRole("button", { name: "Pontos" }).click();
  const pointCard = page.locator("div.card").filter({ hasText: pointName }).first();
  await expect(pointCard).toBeVisible();
  await pointCard.getByRole("button", { name: "ACEITAR" }).first().click();

  await expect
    .poll(async () => {
      const { data } = await serviceClient
        .from("pickup_requests")
        .select("status")
        .eq("id", pickupRequestId)
        .maybeSingle<{ status: string }>();
      return data?.status || null;
    }, { timeout: 30_000 })
    .toBe("accepted");

  await page.goto(`/cooperado/pedido/${pickupRequestId}`);
  await expect(page.getByText("GESTÃO DE COLETA")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "INICIAR DESLOCAMENTO" }).click();
  await expect(page.getByRole("button", { name: "FINALIZAR E GERAR RECIBO" })).toBeVisible({ timeout: 30_000 });

  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "proof-drop-1.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("mock-drop-1"),
    },
    {
      name: "proof-drop-2.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("mock-drop-2"),
    },
  ]);
  await page.getByLabel("Qualidade").selectOption("contaminated");
  await page.getByLabel("RESIDUO ORGANICO").check();
  await page.getByLabel("LIQUIDOS").check();
  await page.locator("textarea").first().fill("Fluxo ponto finalizado no Playwright.");
  await page.locator("textarea").nth(1).fill("Separar por tipo e manter seco.");
  await page.getByRole("button", { name: "FINALIZAR E GERAR RECIBO" }).click();

  let receipt: { id: string; receipt_code: string } | null = null;
  await expect
    .poll(async () => {
      const { data } = await serviceClient
        .from("receipts")
        .select("id, receipt_code")
        .eq("request_id", pickupRequestId)
        .maybeSingle<{ id: string; receipt_code: string }>();
      receipt = data || null;
      return receipt;
    }, { timeout: 45_000 })
    .not.toBeNull();
  if (!receipt) throw new Error("Recibo de drop_point nao encontrado.");
  const { data: tipData } = await serviceClient
    .from("receipt_tip")
    .select("receipt_id")
    .eq("receipt_id", receipt.id)
    .maybeSingle();
  expect(tipData).not.toBeNull();

  await loginAs(page, EMAILS.resident, "resident");
  await page.goto(`/recibos/${receipt.id}`);
  await expect(page.getByText("DICA DO DIA")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("CONTAMINADO")).toBeVisible();

  await serviceClient.from("posts").insert({
    receipt_id: receipt.id,
    created_by: cooperadoId,
    neighborhood_id: centroId,
    kind: "recibo",
    body: "Post de recibo (drop-point-flow e2e).",
  });

  await page.goto("/mural");
  const receiptCard = page.locator("div.card").filter({ hasText: `RECIBO #${receipt.receipt_code}` }).first();
  await expect(receiptCard).toBeVisible({ timeout: 60_000 });
  await expect(receiptCard.getByText("QUALIDADE:", { exact: false })).toBeVisible();
  await expect(receiptCard.getByText("CONTAMINADO")).toBeVisible();

  const { data: assignmentRow } = await serviceClient
    .from("pickup_assignments")
    .select("cooperado_id")
    .eq("request_id", pickupRequestId)
    .maybeSingle<{ cooperado_id: string }>();
  expect(assignmentRow?.cooperado_id).toBe(cooperadoId);
});
