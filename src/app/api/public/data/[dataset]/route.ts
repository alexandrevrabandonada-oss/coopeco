import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
// Reusing A34 basic privacy sweeps or doing inline depending on architecture
// (Assuming a simple stripper here as requested by Zero PII rules)

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// A34 Basic Guardrail Inline
function assertNoPII(data: any) {
    const piiKeys = ['cpf', 'rg', 'phone', 'email', 'address', 'lat', 'lng', 'latitude', 'longitude', 'name_patient'];
    const strData = JSON.stringify(data).toLowerCase();

    for (const key of piiKeys) {
        if (strData.includes(`"${key}"`) || strData.includes(`'${key}'`)) {
            console.warn(`[A34] Possible PII leak detected: ${key}`);
            return false;
        }
    }
    return true;
}

function stripPrivateFields(row: any) {
    const safeRow = { ...row };
    // Remove internal IDs that aren't public slugs if present
    delete safeRow.id;
    delete safeRow.created_by;
    delete safeRow.user_id;
    delete safeRow.cell_id; // Keep neighborhood context, drop cell if too granular (or keep if scope allows, let's keep for now but strip sensitive)
    return safeRow;
}

function toCSV(data: any[]) {
    if (data.length === 0) return "";
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(",")];

    for (const row of data) {
        const values = headers.map(header => {
            const val = row[header];
            if (val === null || val === undefined) return "";
            if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
            let str = String(val);
            if (str.includes(',') || str.includes('\n') || str.includes('"')) {
                str = `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        });
        csvRows.push(values.join(","));
    }
    return csvRows.join("\n");
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ dataset: string }> }) {
    const { dataset: fullDataset } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const neighborhoodSlug = searchParams.get("neighborhood_slug"); // optional

    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    // Extract format from dataset name (e.g. impact_weekly.csv or impact_weekly.json)
    const parts = fullDataset.split('.');
    const dataset = parts[0];
    const format = parts[1] || 'json';

    const supabase = createClient(supabaseUrl!, serviceRoleKey!);

    // 1. Validate Token & Configuration
    const { data: config } = await supabase
        .from("eco_open_data_feeds")
        .select("*, neighborhoods(slug)")
        .eq("public_token", token)
        .eq("is_enabled", true)
        .eq("dataset", dataset)
        .single();

    // Anti-enumeration: Return 404 if token invalid or disabled
    if (!config) {
        return NextResponse.json({ error: "Dataset not found or access revoked." }, { status: 404 });
    }

    // Double check neighborhood scope if applicable
    let queryNeighborhoodId = config.neighborhood_id;
    if (neighborhoodSlug && config.neighborhoods?.slug !== neighborhoodSlug && config.scope !== 'cell') {
        return NextResponse.json({ error: "Scope mismatch." }, { status: 403 });
    }

    // 2. Fetch Data Based on Dataset
    let rawData: any[] = [];

    try {
        if (dataset === 'impact_weekly') {
            const q = supabase.from("v_impact_public_weekly").select("*").order("week_start", { ascending: false }).limit(52);
            if (queryNeighborhoodId) q.eq("neighborhood_id", queryNeighborhoodId);
            else if (config.cell_id) q.eq("cell_id", config.cell_id);

            const { data } = await q;
            rawData = data || [];
        }
        else if (dataset === 'wins_weekly') {
            const q = supabase.from("v_collective_wins_public").select("*").order("week_start", { ascending: false }).limit(12);
            if (queryNeighborhoodId) q.eq("neighborhood_id", queryNeighborhoodId);
            else if (config.cell_id) q.eq("cell_id", config.cell_id);

            const { data } = await q;
            rawData = data || [];
        }
        else if (dataset === 'bulletins') {
            const q = supabase.from("eco_bulletins").select("id, title, content, published_at").eq("status", "published").order("published_at", { ascending: false }).limit(20);
            if (queryNeighborhoodId) q.eq("neighborhood_id", queryNeighborhoodId);

            const { data } = await q;
            rawData = data || [];
        }
        else {
            return NextResponse.json({ error: "Unsupported dataset." }, { status: 400 });
        }
    } catch (err: any) {
        return NextResponse.json({ error: "Internal Error compiling dataset" }, { status: 500 });
    }

    // 3. A34 Guardrails
    const cleanData = rawData.map(stripPrivateFields);

    // Final sanity check before serialization
    if (!assertNoPII(cleanData)) {
        // Log alert internal (omitted complex logger here, just console)
        return NextResponse.json({ error: "A34 Privacy Assert Failed. Payload blocked." }, { status: 500 });
    }

    // 4. Formatting and Headers
    const headers = new Headers();
    // Cache for 5 minutes, stale while revalidate 1 min
    headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");

    if (format === 'csv') {
        headers.set("Content-Type", "text/csv; charset=utf-8");
        headers.set("Content-Disposition", `attachment; filename="${dataset}.csv"`);
        return new NextResponse(toCSV(cleanData), { status: 200, headers });
    }

    headers.set("Content-Type", "application/json");
    return new NextResponse(JSON.stringify(cleanData, null, 2), { status: 200, headers });
}
