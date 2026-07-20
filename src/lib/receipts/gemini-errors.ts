/**
 * Diagnostyka błędów Gemini API (serwer).
 * Nigdy nie loguj klucza API ani danych obrazu (base64).
 */

export type GeminiErrorCode =
  | "GEMINI_RPM_LIMIT"
  | "GEMINI_TPM_LIMIT"
  | "GEMINI_DAILY_LIMIT"
  | "GEMINI_QUOTA_ZERO"
  | "GEMINI_MODEL_UNAVAILABLE"
  | "GEMINI_UNKNOWN_ERROR";

export type ParsedGeminiError = {
  httpStatus: number;
  status: string | null;
  message: string;
  details: unknown;
  detailsAnonymized: unknown;
};

export class GeminiOcrError extends Error {
  readonly errorCode: GeminiErrorCode;
  readonly httpStatus: number;
  readonly gemini: ParsedGeminiError;
  readonly model: string;
  readonly attempt: number;
  readonly withSchema: boolean;

  constructor(opts: {
    errorCode: GeminiErrorCode;
    httpStatus: number;
    gemini: ParsedGeminiError;
    model: string;
    attempt: number;
    withSchema: boolean;
  }) {
    super(opts.gemini.message || `Gemini HTTP ${opts.httpStatus}`);
    this.name = "GeminiOcrError";
    this.errorCode = opts.errorCode;
    this.httpStatus = opts.httpStatus;
    this.gemini = opts.gemini;
    this.model = opts.model;
    this.attempt = opts.attempt;
    this.withSchema = opts.withSchema;
  }
}

export function getGeminiOcrModel(): string {
  return process.env.GEMINI_OCR_MODEL ?? "gemini-2.5-flash";
}

/** Usuwa wrażliwe fragmenty z error.details przed logiem / odpowiedzią API. */
export function anonymizeGeminiDetails(details: unknown): unknown {
  if (details == null) return details;

  const redactString = (s: string): string => {
    let out = s;
    // Klucze API w URL lub tekście
    out = out.replace(/key=[A-Za-z0-9_-]+/gi, "key=[REDACTED]");
    out = out.replace(/AIza[A-Za-z0-9_-]{20,}/g, "[REDACTED_API_KEY]");
    // Base64 / długie bloby
    out = out.replace(/[A-Za-z0-9+/]{200,}={0,2}/g, "[REDACTED_BLOB]");
    return out;
  };

  if (typeof details === "string") return redactString(details);

  if (Array.isArray(details)) {
    return details.map((item) => anonymizeGeminiDetails(item));
  }

  if (typeof details === "object") {
    const obj = details as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === "data" && typeof value === "string" && value.length > 80) {
        out[key] = `[REDACTED_${value.length}_chars]`;
        continue;
      }
      if (typeof value === "string") {
        out[key] = redactString(value);
      } else {
        out[key] = anonymizeGeminiDetails(value);
      }
    }
    return out;
  }

  return details;
}

export function parseGeminiErrorBody(
  httpStatus: number,
  rawBody: string,
): ParsedGeminiError {
  let status: string | null = null;
  let message = rawBody.slice(0, 500);
  let details: unknown = null;

  try {
    const json = JSON.parse(rawBody) as {
      error?: {
        code?: number;
        message?: string;
        status?: string;
        details?: unknown;
      };
    };
    if (json.error) {
      status = json.error.status ?? null;
      message = json.error.message ?? message;
      details = json.error.details ?? null;
    }
  } catch {
    // surowy tekst — zostaw message jak jest
  }

  return {
    httpStatus,
    status,
    message,
    details,
    detailsAnonymized: anonymizeGeminiDetails(details),
  };
}

/**
 * Mapuje odpowiedź Google na kod przyczyny dla UI / logów.
 */
export function classifyGeminiErrorCode(
  httpStatus: number,
  gemini: ParsedGeminiError,
): GeminiErrorCode {
  const blob = JSON.stringify({
    status: gemini.status,
    message: gemini.message,
    details: gemini.details,
  }).toLowerCase();

  if (
    httpStatus === 404 ||
    /not found|model.*not.*found|is not supported|invalid model/i.test(blob)
  ) {
    return "GEMINI_MODEL_UNAVAILABLE";
  }

  if (
    /limit:\s*0|quota.*0\b|exceeded.*limit:\s*0|free_tier.*0|quota_value.*0/i.test(
      blob,
    ) ||
    /has no quota|quota id.*unavailable/i.test(blob)
  ) {
    return "GEMINI_QUOTA_ZERO";
  }

  if (
    /perday|per_day|requests_per_day|generate.*perday|_rpd|daily/i.test(blob)
  ) {
    return "GEMINI_DAILY_LIMIT";
  }

  if (
    /tokens_per_minute|perminute.*token|input_token|output_token|_tpm|tpm/i.test(
      blob,
    ) &&
    !/requests_per_minute/i.test(blob)
  ) {
    return "GEMINI_TPM_LIMIT";
  }

  if (
    /requests_per_minute|perminute|_rpm|generate_content.*per.*minute|perprojectpermodel/i.test(
      blob,
    ) ||
    (httpStatus === 429 && /resource_exhausted/i.test(blob))
  ) {
    // Domyślnie 429 na generateContent free tier = RPM (jak w AI Studio usage)
    return "GEMINI_RPM_LIMIT";
  }

  if (httpStatus === 429) {
    return "GEMINI_RPM_LIMIT";
  }

  return "GEMINI_UNKNOWN_ERROR";
}

export function logGeminiOcrFailure(opts: {
  errorCode: GeminiErrorCode;
  gemini: ParsedGeminiError;
  model: string;
  attempt: number;
  withSchema: boolean;
  receiptId?: string;
}): void {
  console.error("[gemini-ocr] failure", {
    errorCode: opts.errorCode,
    httpStatus: opts.gemini.httpStatus,
    errorStatus: opts.gemini.status,
    errorMessage: opts.gemini.message,
    errorDetails: opts.gemini.detailsAnonymized,
    model: opts.model,
    attempt: opts.attempt,
    withSchema: opts.withSchema,
    receiptId: opts.receiptId ?? null,
  });
}
