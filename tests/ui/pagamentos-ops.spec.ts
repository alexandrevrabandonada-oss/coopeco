import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { signInWithPassword, type AuthSessionPayload } from "./helpers/auth";

const TEST_PW = "EcoTest123!";
const OPERATOR_EMAIL = "eco.operator.test@local";
const COOPERADO_EMAIL = "eco.cooperado.test@local";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY nao definidos para Playwright.");
}

async function loginAs(page: Page, email: string): Promise<AuthSessionPayload> {
  const session = await signInWithPassword(email, TEST_PW);
  const role =
    email === OPERATOR_EMAIL
      ? "operator"
      : email === COOPERADO_EMAIL
        ? "cooperado"
        : "resident";

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

async function ensurePeriodExists(page: Page) {
  const optionCount = await page.locator("select").first().locator("option").count();
  if (optionCount > 0) return;

  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  const formatDate = (date: Date) => date.toISOString().slice(0, 10);

  await page.locator('input[type="date"]').nth(0).fill(formatDate(start));
  await page.locator('input[type="date"]').nth(1).fill(formatDate(today));
  await page.getByRole("button", { name: "Criar período" }).click();
}

test("1) operator acessa /admin/pagamentos e ve periodos", async ({ page }) => {
  await loginAs(page, OPERATOR_EMAIL);
  await page.goto("/admin/pagamentos");

  await expect(page.getByText("ADMIN / PAGAMENTOS")).toBeVisible({ timeout: 60_000 });
  await ensurePeriodExists(page);
  expect(await page.locator("select").first().locator("option").count()).toBeGreaterThan(0);
});

test("2) operator cria ajuste e ve no audit log da tela", async ({ page }) => {
  await loginAs(page, OPERATOR_EMAIL);
  await page.goto("/admin/pagamentos");
  await ensurePeriodExists(page);

  await page.getByRole("button", { name: "Ajustes" }).click();
  await expect(page.getByText("Novo ajuste auditável")).toBeVisible({ timeout: 60_000 });

  const uniqueReason = `PW-${Date.now()}`;
  await page.locator('input[type="number"]').first().fill("-33");
  await page.locator('input[type="text"][placeholder*="correção operacional"]').fill(uniqueReason);
  await page.getByRole("button", { name: "Gravar ajuste" }).click();

  await expect(page.getByText(uniqueReason)).toBeVisible();
});

test("3) operator fecha periodo e gera payout", async ({ page }) => {
  await loginAs(page, OPERATOR_EMAIL);
  await page.goto("/admin/pagamentos");
  await ensurePeriodExists(page);

  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  const formatDate = (date: Date) => date.toISOString().slice(0, 10);

  const previousPeriodId = await page.locator("select").first().inputValue();
  await page.locator('input[type="date"]').nth(0).fill(formatDate(start));
  await page.locator('input[type="date"]').nth(1).fill(formatDate(today));
  await page.getByRole("button", { name: "Criar período" }).click();

  await expect
    .poll(async () => await page.locator("select").first().inputValue(), { timeout: 20_000 })
    .not.toBe(previousPeriodId);

  await page.getByRole("button", { name: "Fechar período" }).click();
  await expect
    .poll(
      async () =>
        await page.locator("select").first().evaluate((el) => {
          const select = el as HTMLSelectElement;
          return select.selectedOptions[0]?.textContent || "";
        }),
      { timeout: 20_000 },
    )
    .toContain("(CLOSED)");
});

test("4) operator exporta CSV com status 200 e header esperado", async ({ page, request }) => {
  const session = await loginAs(page, OPERATOR_EMAIL);
  await page.goto("/admin/pagamentos");
  await ensurePeriodExists(page);

  const periodId = await page.locator("select").first().inputValue();
  const response = await request.get(`/api/admin/payouts/export?period_id=${periodId}`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  expect(response.status()).toBe(200);

  const csv = await response.text();
  expect(csv).toContain(
    "cooperado_display_name,cooperado_id,period_start,period_end,ledger_sum_cents,adjustments_sum_cents,payout_total_cents,payout_status,payout_reference",
  );
  await expect(page.getByRole("button", { name: "Exportar CSV" })).toBeVisible();
});

test("5) cooperado acessa /cooperado/pagamentos e ve apenas o proprio", async ({ page }) => {
  const session = await loginAs(page, COOPERADO_EMAIL);
  await page.goto("/cooperado/pagamentos");

  await expect(page.getByText("COOPERADO / PAGAMENTOS")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Acesso Restrito")).toHaveCount(0);

  const payoutsResponse = await fetch(`${SUPABASE_URL}/rest/v1/coop_payouts?select=cooperado_id`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  expect(payoutsResponse.ok).toBeTruthy();
  const payouts = (await payoutsResponse.json()) as Array<{ cooperado_id: string }>;
  expect(payouts.every((row) => row.cooperado_id === session.user.id)).toBeTruthy();
});
