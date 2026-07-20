import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SupabaseBudgetRepository } from "@/lib/data/supabase-repository";
import {
  buildFullExportPayload,
  exportFilename,
  serializeBudgetJson,
  serializeTransactionsCsv,
  type ExportFormat,
} from "@/lib/data/export";

function parseFormat(raw: string | null): ExportFormat {
  return raw === "csv" ? "csv" : "json";
}

/**
 * GET /api/export?format=json|csv
 * Pełny backup budżetu (JSON) lub lista transakcji (CSV).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = parseFormat(searchParams.get("format"));

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Brak sesji" }, { status: 401 });
    }

    const { data: membership, error: memberError } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (memberError || !membership?.household_id) {
      return NextResponse.json(
        { error: "Brak przypisanego gospodarstwa" },
        { status: 404 },
      );
    }

    const repo = new SupabaseBudgetRepository(supabase, membership.household_id);
    const state = await repo.load();
    const exportedAt = new Date().toISOString();
    const filename = exportFilename(format);

    if (format === "csv") {
      const csv = serializeTransactionsCsv(state);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const payload = buildFullExportPayload(state, {
      exportedAt,
      appVersion: "1.0",
      dataSource: "supabase",
    });
    const json = serializeBudgetJson(payload);

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Błąd eksportu";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
