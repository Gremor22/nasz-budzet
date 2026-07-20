import { describe, expect, it } from "vitest";
import {
  anonymizeGeminiDetails,
  classifyGeminiErrorCode,
  parseGeminiErrorBody,
} from "@/lib/receipts/gemini-errors";

const SAMPLE_429_RPM = `{
  "error": {
    "code": 429,
    "message": "You exceeded your current quota, please check your plan and billing details.",
    "status": "RESOURCE_EXHAUSTED",
    "details": [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        "violations": [
          {
            "quotaMetric": "generativelanguage.googleapis.com/generate_content_free_tier_requests",
            "quotaId": "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
            "quotaDimensions": {
              "model": "gemini-2.5-flash",
              "location": "global"
            }
          }
        ]
      },
      {
        "@type": "type.googleapis.com/google.rpc.Help",
        "links": [
          {
            "description": "Learn more about Gemini API quotas",
            "url": "https://ai.google.dev/gemini-api/docs/rate-limits"
          }
        ]
      }
    ]
  }
}`;

describe("parseGeminiErrorBody", () => {
  it("wyciąga status, message i details", () => {
    const p = parseGeminiErrorBody(429, SAMPLE_429_RPM);
    expect(p.httpStatus).toBe(429);
    expect(p.status).toBe("RESOURCE_EXHAUSTED");
    expect(p.message).toContain("quota");
    expect(Array.isArray(p.details)).toBe(true);
    expect(p.detailsAnonymized).toBeTruthy();
  });
});

describe("classifyGeminiErrorCode", () => {
  it("429 + GenerateRequestsPerMinute → GEMINI_RPM_LIMIT", () => {
    const gemini = parseGeminiErrorBody(429, SAMPLE_429_RPM);
    expect(classifyGeminiErrorCode(429, gemini)).toBe("GEMINI_RPM_LIMIT");
  });

  it("404 model → GEMINI_MODEL_UNAVAILABLE", () => {
    const gemini = parseGeminiErrorBody(
      404,
      '{"error":{"status":"NOT_FOUND","message":"models/gemini-x not found"}}',
    );
    expect(classifyGeminiErrorCode(404, gemini)).toBe(
      "GEMINI_MODEL_UNAVAILABLE",
    );
  });

  it("limit 0 → GEMINI_QUOTA_ZERO", () => {
    const gemini = parseGeminiErrorBody(
      429,
      '{"error":{"status":"RESOURCE_EXHAUSTED","message":"Quota exceeded for metric with limit: 0"}}',
    );
    expect(classifyGeminiErrorCode(429, gemini)).toBe("GEMINI_QUOTA_ZERO");
  });
});

describe("anonymizeGeminiDetails", () => {
  it("redaguje klucz API w stringu", () => {
    const out = anonymizeGeminiDetails(
      "failed key=AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    );
    expect(String(out)).not.toContain("AIzaSy");
    expect(String(out)).toContain("[REDACTED");
  });
});
