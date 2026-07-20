import type { BudgetState } from "@/lib/data/types";
import {
  buildFullExportPayload,
  downloadTextFile,
  exportFilename,
  serializeBudgetJson,
  serializeTransactionsCsv,
  type ExportFormat,
} from "@/lib/data/export";

export async function downloadBudgetExport(
  format: ExportFormat,
  options: {
    dataSource: "supabase" | "local";
    state?: BudgetState;
  },
): Promise<void> {
  const filename = exportFilename(format);

  if (options.dataSource === "supabase") {
    const response = await fetch(`/api/export?format=${format}`, {
      credentials: "include",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error ?? `Eksport nie powiódł się (${response.status})`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  if (!options.state) {
    throw new Error("Brak danych do eksportu");
  }

  if (format === "csv") {
    const csv = serializeTransactionsCsv(options.state);
    downloadTextFile(csv, filename, "text/csv;charset=utf-8");
    return;
  }

  const payload = buildFullExportPayload(options.state, {
    exportedAt: new Date().toISOString(),
    appVersion: "1.0",
    dataSource: "local",
  });
  downloadTextFile(
    serializeBudgetJson(payload),
    filename,
    "application/json;charset=utf-8",
  );
}
