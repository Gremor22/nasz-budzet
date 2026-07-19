import { createClient } from "@/lib/supabase/client";
import type { ClassificationRule, OcrSuggestion } from "@/lib/receipts/types";

export type ReceiptRow = {
  id: string;
  household_id: string;
  storage_path: string;
  mime_type: string;
  status: string;
  merchant_name: string | null;
  receipt_date: string | null;
  total_grosze: number | null;
  suggested_category: string | null;
  ocr_provider: string | null;
  ocr_error: string | null;
  transaction_id: string | null;
};

/**
 * Upload zdjęcia → Storage + wiersz receipts (status uploaded).
 */
export async function uploadReceiptPhoto(input: {
  householdId: string;
  file: File;
}): Promise<{ receiptId: string; storagePath: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Musisz być zalogowany.");

  const receiptId = crypto.randomUUID();
  const ext = extensionForMime(input.file.type) || "jpg";
  const storagePath = `${input.householdId}/${receiptId}/original.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(storagePath, input.file, {
      contentType: input.file.type || "image/jpeg",
      upsert: false,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { error: insertError } = await supabase.from("receipts").insert({
    id: receiptId,
    household_id: input.householdId,
    storage_path: storagePath,
    mime_type: input.file.type || "image/jpeg",
    status: "uploaded",
    created_by: user.id,
  });

  if (insertError) {
    await supabase.storage.from("receipts").remove([storagePath]);
    throw new Error(insertError.message);
  }

  return { receiptId, storagePath };
}

export async function fetchReceipt(receiptId: string): Promise<ReceiptRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", receiptId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Nie znaleziono paragonu");
  return data as ReceiptRow;
}

export async function getReceiptImageUrl(storagePath: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(storagePath, 60 * 30);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Nie udało się otworzyć zdjęcia");
  }
  return data.signedUrl;
}

export async function requestOcr(
  receiptId: string,
  opts?: { focusTotalBase64?: string; focusMimeType?: string },
): Promise<OcrSuggestion> {
  const res = await fetch("/api/receipts/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      receiptId,
      focusTotalBase64: opts?.focusTotalBase64,
      focusMimeType: opts?.focusMimeType,
    }),
  });
  const body = (await res.json()) as OcrSuggestion & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Błąd OCR");
  return body;
}

export async function updateReceiptReview(input: {
  receiptId: string;
  merchantName: string;
  receiptDate: string;
  totalGrosze: number;
  suggestedCategory: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("receipts")
    .update({
      merchant_name: input.merchantName,
      receipt_date: input.receiptDate,
      total_grosze: input.totalGrosze,
      suggested_category: input.suggestedCategory,
      status: "review",
    })
    .eq("id", input.receiptId);
  if (error) throw new Error(error.message);
}

export async function replaceReceiptItems(input: {
  householdId: string;
  receiptId: string;
  items: { name: string; totalGrosze: number; categoryName: string }[];
}): Promise<void> {
  const supabase = createClient();
  await supabase.from("receipt_items").delete().eq("receipt_id", input.receiptId);
  if (input.items.length === 0) return;
  const { error } = await supabase.from("receipt_items").insert(
    input.items.map((item, index) => ({
      household_id: input.householdId,
      receipt_id: input.receiptId,
      name: item.name,
      total_grosze: item.totalGrosze,
      category_name: item.categoryName,
      sort_order: index,
    })),
  );
  if (error) throw new Error(error.message);
}

export async function markReceiptConfirmed(
  receiptId: string,
  transactionId: string | null,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("receipts")
    .update({
      status: "confirmed",
      transaction_id: transactionId,
    })
    .eq("id", receiptId);
  if (error) throw new Error(error.message);
}

export async function loadHouseholdRules(
  householdId: string,
): Promise<ClassificationRule[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("classification_rules")
    .select("match_type, pattern, category_name, priority, active")
    .eq("household_id", householdId)
    .eq("active", true);
  if (error) return [];
  return (data ?? []).map((r) => ({
    matchType: r.match_type as ClassificationRule["matchType"],
    pattern: r.pattern as string,
    categoryName: r.category_name as string,
    priority: r.priority as number,
    active: r.active as boolean,
  }));
}

export async function upsertCategoryRule(input: {
  householdId: string;
  pattern: string;
  categoryName: string;
}): Promise<void> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("classification_rules")
    .select("id")
    .eq("household_id", input.householdId)
    .eq("match_type", "contains")
    .ilike("pattern", input.pattern)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("classification_rules")
      .update({
        category_name: input.categoryName,
        priority: 5,
        active: true,
      })
      .eq("id", existing.id);
    return;
  }

  await supabase.from("classification_rules").insert({
    household_id: input.householdId,
    match_type: "contains",
    pattern: input.pattern.toLowerCase(),
    category_name: input.categoryName,
    priority: 5,
    active: true,
  });
}

function extensionForMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  return "jpg";
}
