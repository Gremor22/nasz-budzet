import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runOcr } from "@/lib/receipts/ocr";
import { suggestCategory } from "@/lib/receipts/categorize";

/**
 * POST /api/receipts/ocr
 * Body: { receiptId: string }
 * Klucz OCR tylko na serwerze. Nigdy nie zapisuje transakcji — tylko propozycję.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      receiptId?: string;
      focusTotalBase64?: string;
      focusMimeType?: string;
    };
    if (!body.receiptId) {
      return NextResponse.json({ error: "Brak receiptId" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Brak sesji" }, { status: 401 });
    }

    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("*")
      .eq("id", body.receiptId)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json(
        { error: receiptError?.message ?? "Nie znaleziono paragonu" },
        { status: 404 },
      );
    }

    await supabase
      .from("receipts")
      .update({ status: "ocr_pending", ocr_error: null })
      .eq("id", receipt.id);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("receipts")
      .download(receipt.storage_path as string);

    if (downloadError || !fileData) {
      const msg = downloadError?.message ?? "Nie udało się pobrać zdjęcia";
      await supabase
        .from("receipts")
        .update({ status: "failed", ocr_error: msg })
        .eq("id", receipt.id);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const mimeType = (receipt.mime_type as string) || "image/jpeg";
    const imageBytes = await fileData.arrayBuffer();

    let suggestion;
    try {
      suggestion = await runOcr({
        imageBytes,
        mimeType,
        focusTotalBase64: body.focusTotalBase64,
        focusMimeType: body.focusMimeType,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Błąd OCR";
      const quotaHit =
        /\b429\b/i.test(msg) ||
        /quota|rate.?limit|resource.?exhausted/i.test(msg);

      await supabase
        .from("receipts")
        .update({
          status: "review",
          ocr_provider: "tesseract",
          ocr_error: quotaHit ? "gemini_quota" : msg.slice(0, 500),
        })
        .eq("id", receipt.id);

      // Cisza dla klienta → telefon zrobi Tesseract; bez straszenia JSON-em
      return NextResponse.json({
        provider: "tesseract",
        merchantName: null,
        receiptDate: null,
        totalGrosze: null,
        suggestedCategory: null,
        items: [],
        note: "use_client_tesseract",
        quotaExceeded: quotaHit,
      });
    }

    if (!suggestion.suggestedCategory && suggestion.merchantName) {
      suggestion = {
        ...suggestion,
        suggestedCategory: suggestCategory(suggestion.merchantName),
      };
    }

    await supabase
      .from("receipts")
      .update({
        status: "review",
        merchant_name: suggestion.merchantName,
        receipt_date: suggestion.receiptDate,
        total_grosze: suggestion.totalGrosze,
        suggested_category: suggestion.suggestedCategory,
        ocr_provider: suggestion.provider,
        ocr_raw: {
          items: suggestion.items,
          note: suggestion.note ?? null,
          rawText: suggestion.rawText ?? null,
        },
        ocr_error: null,
      })
      .eq("id", receipt.id);

    if (suggestion.items.length > 0) {
      await supabase.from("receipt_items").delete().eq("receipt_id", receipt.id);
      await supabase.from("receipt_items").insert(
        suggestion.items.map((item, index) => ({
          household_id: receipt.household_id,
          receipt_id: receipt.id,
          name: item.name,
          total_grosze: item.totalGrosze,
          category_name:
            item.categoryName ??
            suggestion.suggestedCategory ??
            "Inne",
          sort_order: index,
        })),
      );
    }

    return NextResponse.json(suggestion);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Błąd serwera";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
