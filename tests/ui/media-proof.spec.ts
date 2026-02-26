import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInWithPassword } from "./helpers/auth";
import type { Page } from "@playwright/test";

const TEST_PW = "EcoTest123!";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TINY_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
  "base64",
);

const EMAILS = {
  resident: "eco.resident.test@local",
  residentAlt: "eco.resident.alt@local",
  cooperado: "eco.cooperado.test@local",
  operator: "eco.operator.test@local",
} as const;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY nao definidos.");
}

const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface TestUser {
  id: string;
  email: string;
  role: "resident" | "cooperado" | "operator";
}

const users = {
  resident: null as TestUser | null,
  residentAlt: null as TestUser | null,
  cooperado: null as TestUser | null,
  operator: null as TestUser | null,
};

let centroId = "";

function makeReceiptCode(prefix: string) {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function ensureUser(email: string, role: TestUser["role"], displayName: string): Promise<TestUser> {
  const { data: listed, error: listedError } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listedError) throw listedError;

  let authUser = listed.users.find((entry) => entry.email === email) || null;
  if (!authUser) {
    const { data: created, error: createdError } = await serviceClient.auth.admin.createUser({
      email,
      password: TEST_PW,
      email_confirm: true,
    });
    if (createdError || !created.user) throw createdError || new Error("Falha ao criar usuario de teste.");
    authUser = created.user;
  } else {
    const { error: resetError } = await serviceClient.auth.admin.updateUserById(authUser.id, { password: TEST_PW });
    if (resetError) throw resetError;
  }

  const { error: profileError } = await serviceClient.from("profiles").upsert(
    {
      user_id: authUser.id,
      role,
      display_name: displayName,
      neighborhood_id: centroId,
    },
    { onConflict: "user_id" },
  );
  if (profileError) throw profileError;

  return {
    id: authUser.id,
    email: authUser.email || email,
    role,
  };
}

async function loginAs(page: Page, email: string, role: TestUser["role"]) {
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
          created_at: new Date().toISOString(),
        },
      },
      accessToken: session.access_token,
    },
  );
  return session;
}

async function createAssignedRequest(residentId: string, cooperadoId: string, status: "accepted" | "en_route" | "collected") {
  const { data: activeWindow } = await serviceClient
    .from("route_windows")
    .select("id, weekday, start_time")
    .eq("neighborhood_id", centroId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; weekday: number; start_time: string }>();

  const startTime = String(activeWindow?.start_time || "09:00");
  const hour = Number(startTime.slice(0, 2));
  const minute = Number(startTime.slice(3, 5));
  const now = new Date();
  const candidate = new Date(now);
  const diff = ((activeWindow?.weekday ?? now.getDay()) - candidate.getDay() + 7) % 7;
  candidate.setDate(candidate.getDate() + diff);
  candidate.setHours(hour, minute, 0, 0);
  if (diff === 0 && candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 7);

  const { data: request, error: requestError } = await serviceClient
    .from("pickup_requests")
    .insert({
      created_by: residentId,
      neighborhood_id: centroId,
      route_window_id: activeWindow?.id ?? null,
      scheduled_for: activeWindow ? candidate.toISOString() : null,
      status,
      notes: "playwright-media-proof",
    })
    .select("id")
    .single<{ id: string }>();

  if (requestError || !request) throw requestError || new Error("Falha ao criar pickup_request.");

  const { error: privateError } = await serviceClient.from("pickup_request_private").upsert(
    {
      request_id: request.id,
      address_full: "Rua Playwright, 100",
      contact_phone: "000000000",
    },
    { onConflict: "request_id" },
  );
  if (privateError) throw privateError;

  const { error: assignmentError } = await serviceClient.from("pickup_assignments").upsert(
    {
      request_id: request.id,
      cooperado_id: cooperadoId,
    },
    { onConflict: "request_id" },
  );
  if (assignmentError) throw assignmentError;

  const { error: itemsError } = await serviceClient.from("pickup_request_items").insert({
    request_id: request.id,
    material: "plastic",
    unit: "bag_m",
    qty: 3,
  });
  if (itemsError) throw itemsError;

  return request.id;
}

async function createReceiptWithMedia(residentId: string, cooperadoId: string, mediaCount: number = 1) {
  const requestId = await createAssignedRequest(residentId, cooperadoId, "collected");

  const { data: receipt, error: receiptError } = await serviceClient
    .from("receipts")
    .insert({
      request_id: requestId,
      cooperado_id: cooperadoId,
      receipt_code: makeReceiptCode("UI"),
      items: [{ material: "plastic", unit: "bag_m", quantity: 3 }],
      final_notes: "receipt media test",
    })
    .select("id")
    .single<{ id: string }>();

  if (receiptError || !receipt) throw receiptError || new Error("Falha ao criar recibo de teste.");

  const mediaIds: string[] = [];
  let firstMediaPath: string | null = null;
  for (let index = 0; index < mediaCount; index += 1) {
    const mediaPath = `receipts/${receipt.id}/${makeReceiptCode(`IMG${index}`).toLowerCase()}.png`;
    const content = TINY_PNG_BUFFER;

    const { error: uploadError } = await serviceClient.storage.from("eco-media").upload(mediaPath, content, {
      contentType: "image/png",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data: mediaObject, error: mediaObjectError } = await serviceClient
      .from("media_objects")
      .insert({
        bucket: "eco-media",
        path: mediaPath,
        owner_id: cooperadoId,
        entity_type: "receipt",
        entity_id: receipt.id,
        mime: "image/png",
        bytes: content.length,
        is_public: false,
      })
      .select("id")
      .single<{ id: string }>();
    if (mediaObjectError || !mediaObject) throw mediaObjectError || new Error("Falha ao criar media_objects.");

    if (!firstMediaPath) firstMediaPath = mediaPath;
    mediaIds.push(mediaObject.id);
  }

  const { error: receiptUpdateError } = await serviceClient
    .from("receipts")
    .update({ proof_photo_path: firstMediaPath })
    .eq("id", receipt.id);
  if (receiptUpdateError) throw receiptUpdateError;

  return {
    requestId,
    receiptId: receipt.id,
    mediaIds,
  };
}

test.beforeAll(async () => {
  const { data: centro, error: centroError } = await serviceClient
    .from("neighborhoods")
    .select("id")
    .eq("slug", "centro")
    .single<{ id: string }>();
  if (centroError || !centro) throw centroError || new Error("Bairro centro nao encontrado.");
  centroId = centro.id;

  users.resident = await ensureUser(EMAILS.resident, "resident", "RESIDENTE TESTE");
  users.residentAlt = await ensureUser(EMAILS.residentAlt, "resident", "RESIDENTE ALT TESTE");
  users.cooperado = await ensureUser(EMAILS.cooperado, "cooperado", "COOPERADO TESTE");
  users.operator = await ensureUser(EMAILS.operator, "operator", "OPERADOR TESTE");
});

test("cooperado cria receipt e sobe 2 imagens (mock upload)", async ({ page }) => {
  const resident = users.resident!;
  const cooperado = users.cooperado!;
  const requestId = await createAssignedRequest(resident.id, cooperado.id, "en_route");

  await loginAs(page, cooperado.email, "cooperado");
  await page.goto(`/cooperado/pedido/${requestId}`);

  await expect(page.getByText("GESTÃO DE COLETA")).toBeVisible({ timeout: 60_000 });

  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "proof-1.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("mock-image-proof-1"),
    },
    {
      name: "proof-2.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("mock-image-proof-2"),
    },
  ]);
  await page.locator("textarea").first().fill("Playwright upload proof");
  await page.getByRole("button", { name: "FINALIZAR E GERAR RECIBO" }).click();

  await expect
    .poll(async () => {
      const { data } = await serviceClient
        .from("receipts")
        .select("id")
        .eq("request_id", requestId)
        .maybeSingle<{ id: string }>();
      return data?.id || null;
    }, { timeout: 45_000 })
    .not.toBeNull();

  const { data: receipt } = await serviceClient
    .from("receipts")
    .select("id")
    .eq("request_id", requestId)
    .single<{ id: string }>();
  if (!receipt) {
    throw new Error("Recibo nao encontrado apos finalizacao da coleta.");
  }

  await expect
    .poll(
      async () => {
        const { data } = await serviceClient
          .from("media_objects")
          .select("id")
          .eq("entity_type", "receipt")
          .eq("entity_id", receipt.id);
        return data?.length ?? 0;
      },
      { timeout: 45_000 },
    )
    .toBe(2);
});

test("cooperado finaliza recibo com qualidade e resident ve dica", async ({ page }) => {
  const resident = users.resident!;
  const cooperado = users.cooperado!;
  const requestId = await createAssignedRequest(resident.id, cooperado.id, "en_route");

  await loginAs(page, cooperado.email, "cooperado");
  await page.goto(`/cooperado/pedido/${requestId}`);
  await expect(page.getByText("GESTÃO DE COLETA")).toBeVisible({ timeout: 60_000 });

  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "proof-quality.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("mock-image-quality"),
    },
  ]);

  await page.getByLabel("Qualidade").selectOption("contaminated");
  await page.getByLabel("RESIDUO ORGANICO").check();
  await page.locator("textarea").first().fill("Teste de qualidade A8");
  await page.locator("textarea").nth(1).fill("Separar e enxaguar antes da coleta.");
  await page.getByRole("button", { name: "FINALIZAR E GERAR RECIBO" }).click();

  let receiptIdValue: string | null = null;
  await expect
    .poll(async () => {
      const { data } = await serviceClient
        .from("receipts")
        .select("id")
        .eq("request_id", requestId)
        .maybeSingle<{ id: string }>();
      receiptIdValue = data?.id || null;
      return receiptIdValue;
    }, { timeout: 45_000 })
    .not.toBeNull();

  if (!receiptIdValue) {
    throw new Error("Recibo com qualidade nao foi criado.");
  }

  await loginAs(page, resident.email, "resident");
  await page.goto(`/recibos/${receiptIdValue}`);
  await expect(page.getByText("DICA DO DIA")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("CONTAMINADO")).toBeVisible();
});

test("resident abre recibo e ve 2 imagens via signed-url batch", async ({ page }) => {
  const resident = users.resident!;
  const cooperado = users.cooperado!;
  const { receiptId } = await createReceiptWithMedia(resident.id, cooperado.id, 2);

  await loginAs(page, resident.email, "resident");
  const signedBatchPromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/media/signed-url?entity_type=receipt") && response.status() === 200,
  );

  await page.goto(`/recibos/${receiptId}`);
  await expect(page.getByText("RECIBO ECO")).toBeVisible({ timeout: 60_000 });
  await signedBatchPromise;

  await expect(page.getByTestId("media-preview-image")).toHaveCount(2);
});

test("resident tenta acessar imagem de outro e recebe bloqueio", async ({ page }) => {
  const resident = users.resident!;
  const residentAlt = users.residentAlt!;
  const cooperado = users.cooperado!;
  const { receiptId, mediaIds } = await createReceiptWithMedia(residentAlt.id, cooperado.id, 1);
  const mediaId = mediaIds[0];
  if (!mediaId) {
    throw new Error("Media id nao gerado para teste de bloqueio.");
  }

  await loginAs(page, resident.email, "resident");
  await page.goto(`/recibos/${receiptId}`);

  const apiResult = await page.evaluate(async (targetMediaId) => {
    const token = window.localStorage.getItem("eco_e2e_access_token");
    if (!token) return { status: 0 };
    const response = await fetch(`/api/media/signed-url?media_id=${targetMediaId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return { status: response.status };
  }, mediaId);

  expect(apiResult.status).toBe(403);
  await expect(page.getByTestId("media-preview-image")).toHaveCount(0);
});

test("batch endpoint aplica permissoes por papel", async ({ page }) => {
  const resident = users.resident!;
  const residentAlt = users.residentAlt!;
  const cooperado = users.cooperado!;
  const operator = users.operator!;
  const { receiptId } = await createReceiptWithMedia(resident.id, cooperado.id, 2);

  const fetchBatch = async () =>
    page.evaluate(async ({ targetReceiptId }) => {
      const token = window.localStorage.getItem("eco_e2e_access_token");
      if (!token) return { status: 0, count: 0 };
      const response = await fetch(`/api/media/signed-url?entity_type=receipt&entity_id=${targetReceiptId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json().catch(() => null)) as { items?: Array<{ media_id: string }> } | null;
      return {
        status: response.status,
        count: payload?.items?.length ?? 0,
      };
    }, { targetReceiptId: receiptId });

  await loginAs(page, resident.email, "resident");
  await page.goto("/");
  const residentResult = await fetchBatch();
  expect(residentResult.status).toBe(200);
  expect(residentResult.count).toBe(2);

  await loginAs(page, residentAlt.email, "resident");
  await page.goto("/");
  const altResult = await fetchBatch();
  expect([200, 403]).toContain(altResult.status);
  if (altResult.status === 200) {
    expect(altResult.count).toBe(0);
  }

  await loginAs(page, cooperado.email, "cooperado");
  await page.goto("/");
  const cooperadoResult = await fetchBatch();
  expect(cooperadoResult.status).toBe(200);
  expect(cooperadoResult.count).toBe(2);

  await loginAs(page, operator.email, "operator");
  await page.goto("/");
  const operatorResult = await fetchBatch();
  expect(operatorResult.status).toBe(200);
  expect(operatorResult.count).toBe(2);
});

test("renew de signed-url ocorre apos 403 na primeira carga", async ({ page }) => {
  const resident = users.resident!;
  const cooperado = users.cooperado!;
  const { receiptId } = await createReceiptWithMedia(resident.id, cooperado.id, 1);

  await loginAs(page, resident.email, "resident");

  let firstImageBlocked = false;
  await page.route("**/storage/v1/object/sign/eco-media/**", async (route) => {
    if (!firstImageBlocked) {
      firstImageBlocked = true;
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "expired" }),
      });
      return;
    }
    await route.continue();
  });

  let signedApiCallCount = 0;
  page.on("response", (response) => {
    if (response.url().includes("/api/media/signed-url") && response.status() === 200) {
      signedApiCallCount += 1;
    }
  });

  await page.goto(`/recibos/${receiptId}`);
  await expect(page.getByText("RECIBO ECO")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("media-preview-image").first()).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => signedApiCallCount, { timeout: 30_000 }).toBeGreaterThan(1);
});
