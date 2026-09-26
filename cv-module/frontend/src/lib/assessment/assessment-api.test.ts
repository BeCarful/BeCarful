import { describe, expect, it, vi } from "vitest";

import {
  AssessmentApi,
  AssessmentApiError,
  AssessmentPollTimeoutError,
  claimExportFileName,
  parseClaimExport,
  photoContentType,
  pollClaimUntilTerminal,
  serializeClaimExport,
  validatePhoto,
} from "./assessment-api";

function claim(status: string, imageCount = 0) {
  return {
    claim_id: "clm_test",
    status,
    active_run_id: status === "draft" ? null : "run_test",
    image_count: imageCount,
    failure_code: null,
  };
}

function exportPayload(partId = "front_bumper") {
  return {
    export_schema_version: "1.0",
    claim_id: "clm_test",
    analysis_run_id: "run_test",
    source_images: [
      {
        image_id: "img_test",
        file_name: "front.jpg",
        content_type: "image/jpeg",
        size_bytes: 5,
      },
    ],
    assessment: {
      schema_version: "1.0",
      claim_id: "clm_test",
      analysis_run_id: "run_test",
      status: "needs_human_review",
      findings: [
        {
          finding_id: "finding_test",
          part_id: partId,
          damage_type: "dent",
          visual_severity: "moderate",
        },
      ],
      coverage: { missing: [], complete: true },
      review_reasons: ["confidence_unvalidated"],
      limitations: ["Evaluation only"],
    },
    raw_gemini: {
      intake: { same_vehicle: true },
      assessment: { findings: [] },
    },
  };
}

describe("photo validation", () => {
  it("accepts supported types and infers HEIC from the extension", () => {
    expect(
      validatePhoto(new File(["jpeg"], "front.jpg", { type: "image/jpeg" })),
    ).toBeNull();
    expect(photoContentType(new File(["heic"], "side.HEIC"))).toBe(
      "image/heic",
    );
  });

  it("rejects empty, unsupported, and oversized files", () => {
    expect(
      validatePhoto(new File([], "empty.jpg", { type: "image/jpeg" })),
    ).toMatch("empty");
    expect(
      validatePhoto(new File(["gif"], "photo.gif", { type: "image/gif" })),
    ).toMatch("not a supported");
    const oversized = new File(["x"], "large.jpg", { type: "image/jpeg" });
    Object.defineProperty(oversized, "size", { value: 20 * 1024 * 1024 + 1 });
    expect(validatePhoto(oversized)).toMatch("20 MiB");
  });
});

describe("AssessmentApi", () => {
  it("creates, prepares, uploads, and submits with the exact backend contract", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(claim("draft"), { status: 201 }))
      .mockResolvedValueOnce(
        Response.json(
          {
            image_id: "img_test",
            upload_url: "http://127.0.0.1:8000/v1/local-uploads/token",
            method: "PUT",
            required_headers: { "Content-Type": "image/jpeg" },
          },
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        Response.json(
          {
            claim_id: "clm_test",
            analysis_run_id: "run_test",
            claim_status: "queued",
            run_status: "queued",
          },
          { status: 202 },
        ),
      );
    const api = new AssessmentApi(
      "http://backend.test",
      fetchMock as typeof fetch,
    );
    const file = new File(["photo"], "front.jpg", { type: "image/jpeg" });

    await api.createClaim();
    await api.uploadPhoto("clm_test", file);
    await api.submitClaim("clm_test");

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0][0]).toBe("http://backend.test/v1/claims");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "http://backend.test/v1/claims/clm_test/images:prepare-upload",
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
      content_type: "image/jpeg",
      size_bytes: 5,
      file_name: "front.jpg",
    });
    expect(fetchMock.mock.calls[2][0]).toBe(
      "http://127.0.0.1:8000/v1/local-uploads/token",
    );
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: file,
    });
    expect(fetchMock.mock.calls[3][0]).toBe(
      "http://backend.test/v1/claims/clm_test:submit",
    );
  });

  it("polls through intermediate states to a terminal state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(claim("queued", 4)))
      .mockResolvedValueOnce(Response.json(claim("assessing", 4)))
      .mockResolvedValueOnce(Response.json(claim("needs_human_review", 4)));
    const api = new AssessmentApi(
      "http://backend.test",
      fetchMock as typeof fetch,
    );
    const statuses: string[] = [];

    const terminal = await pollClaimUntilTerminal(api, "clm_test", {
      intervalMs: 0,
      timeoutMs: 1_000,
      onStatus: (current) => statuses.push(current.status),
    });

    expect(terminal.status).toBe("needs_human_review");
    expect(statuses).toEqual(["queued", "assessing", "needs_human_review"]);
  });

  it("reports a polling timeout", async () => {
    const api = new AssessmentApi(
      "http://backend.test",
      vi.fn() as typeof fetch,
    );
    await expect(
      pollClaimUntilTerminal(api, "clm_test", { timeoutMs: -1 }),
    ).rejects.toBeInstanceOf(AssessmentPollTimeoutError);
  });
});

describe("claim export validation", () => {
  it("validates and serializes the combined export", () => {
    const bundle = parseClaimExport(exportPayload());
    expect(claimExportFileName(bundle)).toBe("becarful-clm_test-run_test.json");
    expect(JSON.parse(serializeClaimExport(bundle))).toEqual(exportPayload());
  });

  it("rejects unknown model values", () => {
    expect(() => parseClaimExport(exportPayload("spoiler"))).toThrow(
      AssessmentApiError,
    );
  });
});
