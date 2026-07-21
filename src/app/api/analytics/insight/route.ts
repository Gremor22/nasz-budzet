import { NextResponse } from "next/server";
import type { SpendingInsightInput } from "@/lib/analytics/insight";
import { generateSpendingInsight } from "@/lib/analytics/gemini-insight";
import { createClient } from "@/lib/supabase/server";

function isValidInput(body: unknown): body is SpendingInsightInput {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.monthLabel === "string" &&
    typeof b.expenseTotalGrosze === "number" &&
    Array.isArray(b.byCategory)
  );
}

/**
 * POST /api/analytics/insight
 * Krótkie podsumowanie wydatków (Gemini + fallback lokalny).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Brak sesji" }, { status: 401 });
    }

    const body: unknown = await request.json();
    if (!isValidInput(body)) {
      return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 });
    }

    const result = await generateSpendingInsight(body);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Błąd podsumowania";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
