import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PERIOD_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PayoutRow {
  cooperado_id: string;
  total_cents: number;
  status: "pending" | "paid";
  payout_reference: string | null;
}

interface LedgerRow {
  cooperado_id: string;
  total_cents: number;
}

interface AdjustmentRow {
  cooperado_id: string;
  amount_cents: number;
}

interface ProfileRow {
  user_id: string;
  display_name: string | null;
}

interface PeriodRow {
  id: string;
  period_start: string;
  period_end: string;
}

function csvEscape(value: string | number | null): string {
  const raw = value === null ? "" : String(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export async function GET(request: NextRequest) {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Server env is missing Supabase configuration." },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
  }

  const periodId = request.nextUrl.searchParams.get("period_id");
  if (!periodId || !PERIOD_ID_REGEX.test(periodId)) {
    return NextResponse.json({ error: "Invalid period_id." }, { status: 400 });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Invalid auth token." }, { status: 401 });
  }

  const actorId = userData.user.id;
  const { data: actorProfile, error: actorProfileError } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", actorId)
    .single();

  if (actorProfileError || !actorProfile || actorProfile.role !== "operator") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data: period, error: periodError } = await admin
    .from("coop_payout_periods")
    .select("id, period_start, period_end")
    .eq("id", periodId)
    .single<PeriodRow>();

  if (periodError || !period) {
    return NextResponse.json({ error: "Period not found." }, { status: 404 });
  }

  const periodStartIso = `${period.period_start}T00:00:00.000Z`;
  const periodEndIso = `${period.period_end}T23:59:59.999Z`;

  const [
    { data: payouts, error: payoutsError },
    { data: ledgerRows, error: ledgerError },
    { data: adjustmentRows, error: adjustmentError },
  ] = await Promise.all([
    admin
      .from("coop_payouts")
      .select("cooperado_id, total_cents, status, payout_reference")
      .eq("period_id", period.id)
      .order("cooperado_id", { ascending: true }),
    admin
      .from("coop_earnings_ledger")
      .select("cooperado_id, total_cents")
      .gte("created_at", periodStartIso)
      .lte("created_at", periodEndIso),
    admin
      .from("coop_earning_adjustments")
      .select("cooperado_id, amount_cents")
      .eq("period_id", period.id),
  ]);

  if (payoutsError || ledgerError || adjustmentError) {
    return NextResponse.json(
      {
        error:
          payoutsError?.message ||
          ledgerError?.message ||
          adjustmentError?.message ||
          "Failed to fetch payout export data.",
      },
      { status: 500 },
    );
  }

  const payoutRows = (payouts || []) as PayoutRow[];
  const ledgerByCooperado = new Map<string, number>();
  const adjustmentsByCooperado = new Map<string, number>();

  for (const row of (ledgerRows || []) as LedgerRow[]) {
    ledgerByCooperado.set(
      row.cooperado_id,
      (ledgerByCooperado.get(row.cooperado_id) || 0) + row.total_cents,
    );
  }

  for (const row of (adjustmentRows || []) as AdjustmentRow[]) {
    adjustmentsByCooperado.set(
      row.cooperado_id,
      (adjustmentsByCooperado.get(row.cooperado_id) || 0) + row.amount_cents,
    );
  }

  const cooperadoIds = Array.from(new Set(payoutRows.map((row) => row.cooperado_id)));
  let profiles: ProfileRow[] = [];
  if (cooperadoIds.length > 0) {
    const { data: profileRows, error: profileError } = await admin
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", cooperadoIds);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
    profiles = (profileRows || []) as ProfileRow[];
  }

  const displayNameById = new Map<string, string>();
  for (const profile of profiles) {
    displayNameById.set(profile.user_id, profile.display_name || "");
  }

  const headers = [
    "cooperado_display_name",
    "cooperado_id",
    "period_start",
    "period_end",
    "ledger_sum_cents",
    "adjustments_sum_cents",
    "payout_total_cents",
    "payout_status",
    "payout_reference",
  ];

  const lines = payoutRows.map((row) =>
    [
      csvEscape(displayNameById.get(row.cooperado_id) || ""),
      csvEscape(row.cooperado_id),
      csvEscape(period.period_start),
      csvEscape(period.period_end),
      csvEscape(ledgerByCooperado.get(row.cooperado_id) || 0),
      csvEscape(adjustmentsByCooperado.get(row.cooperado_id) || 0),
      csvEscape(row.total_cents),
      csvEscape(row.status),
      csvEscape(row.payout_reference),
    ].join(","),
  );

  const csvBody = `\uFEFF${[headers.join(","), ...lines].join("\n")}`;
  const safeFilePeriodStart = period.period_start.replaceAll("-", "");
  const safeFilePeriodEnd = period.period_end.replaceAll("-", "");

  const { error: auditError } = await admin.from("admin_audit_log").insert({
    actor_id: actorId,
    action: "export_payout_csv",
    target_type: "period",
    target_id: period.id,
    meta: {
      period_id: period.id,
      rows: payoutRows.length,
    },
  });

  if (auditError) {
    return NextResponse.json({ error: auditError.message }, { status: 500 });
  }

  return new NextResponse(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payouts_${safeFilePeriodStart}_${safeFilePeriodEnd}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
