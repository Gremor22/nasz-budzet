import type { BudgetState, Transaction } from "@/lib/data/types";
import { groszeToZl } from "@/lib/money/format";

export type ExportFormat = "json" | "csv";

export interface ExportMeta {
  exportedAt: string;
  appVersion: string;
  dataSource: "supabase" | "local";
  householdName: string;
}

export interface FullExportPayload {
  meta: ExportMeta;
  data: BudgetState;
}

const PERSON_LABELS: Record<string, string> = {
  pawel: "Paweł",
  milena: "Milena",
  shared: "Wspólne",
};

const TYPE_LABELS: Record<Transaction["type"], string> = {
  expense: "Wydatek",
  income: "Przychód",
};

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[;"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function accountName(state: BudgetState, accountId: string): string {
  return state.accounts.find((a) => a.id === accountId)?.name ?? accountId;
}

export function buildFullExportPayload(
  state: BudgetState,
  meta: Omit<ExportMeta, "householdName"> & { householdName?: string },
): FullExportPayload {
  return {
    meta: {
      ...meta,
      householdName: meta.householdName ?? state.household.name,
    },
    data: state,
  };
}

export function serializeBudgetJson(payload: FullExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function serializeTransactionsCsv(state: BudgetState): string {
  const header = [
    "data",
    "typ",
    "opis",
    "kategoria",
    "kwota_zl",
    "konto",
    "osoba",
    "zaplacil",
    "wspolny",
    "status",
    "notatka",
  ].join(";");

  const rows = [...state.transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .map((tx) =>
      [
        tx.date,
        TYPE_LABELS[tx.type],
        tx.description,
        tx.category,
        groszeToZl(tx.amountGrosze).toFixed(2).replace(".", ","),
        accountName(state, tx.accountId),
        PERSON_LABELS[tx.person] ?? tx.person,
        PERSON_LABELS[tx.paidBy] ?? tx.paidBy,
        tx.isShared ? "tak" : "nie",
        tx.status,
        tx.note ?? "",
      ]
        .map(csvCell)
        .join(";"),
    );

  return `\uFEFF${[header, ...rows].join("\n")}`;
}

export function exportFilename(format: ExportFormat, date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  return format === "csv"
    ? `nasz-budzet-transakcje-${day}.csv`
    : `nasz-budzet-${day}.json`;
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
