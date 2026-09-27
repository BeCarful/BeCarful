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
      processing: {
        model_id: "gemini-3.8-flash",
        prompt_version: "v2",
      },
      images: [
        {
          image_id: "img_test",
          view: "front",
          usable: true,
          quality_reasons: [],
        },
      ],
      findings: [
        {
          finding_id: "finding_test",
          part_id: partId,
          damage_type: "dent",
          visual_severity: "moderate",
          confidence: {
            score: null,
            band: "unvalidated",
            calibration_version: null,
          },
          evidence: [
            {
              image_id: "img_test",
              bbox: { x_min: 0.1, y_min: 0.2, x_max: 0.3, y_max: 0.4 },
            },
          ],
        },
      ],
      coverage: {
        observed: ["front"],
        missing: [],
        recommended_missing: ["front_left"],
        complete: true,
      },
      needs_human_review: true,
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
  it("calls the default browser fetch with the global receiver", async () => {
    const browserFetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(function (this: unknown) {
        if (this !== globalThis) {
          throw new TypeError(
            "Failed to execute 'fetch' on 'Window': Illegal invocation",
          );
        }
        return Promise.resolve(Response.json(claim("draft"), { status: 201 }));
      });

    try {
      const api = new AssessmentApi("http://backend.test");
      const { signal } = new AbortController();

      await expect(api.createClaim(signal)).resolves.toEqual(claim("draft"));
      expect(browserFetch).toHaveBeenCalledWith(
        "http://backend.test/v1/claims",
        {
          method: "POST",
          signal,
        },
      );
    } finally {
      browserFetch.mockRestore();
    }
  });

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
    expect(JSON.parse(serializeClaimExport(bundle))).toEqual({
      export_schema_version: "2.0",
      claim_id: "clm_test",
      analysis_run_id: "run_test",
      images: [
        {
          image_id: "img_test",
          file_name: "front.jpg",
          view: "front",
          usable: true,
        },
      ],
      assessment: {
        status: "needs_human_review",
        model: { id: "gemini-3.8-flash", prompt_version: "v2" },
        coverage: {
          observed_views: ["front"],
          suggested_views: ["front_left"],
        },
        findings: [
          {
            part_id: "front_bumper",
            damage_type: "dent",
            visual_severity: "moderate",
            confidence: { band: "unvalidated" },
            evidence: [
              {
                image_id: "img_test",
                bbox: {
                  x_min: 0.1,
                  y_min: 0.2,
                  x_max: 0.3,
                  y_max: 0.4,
                },
              },
            ],
          },
        ],
        review_reasons: ["confidence_unvalidated"],
        limitations: ["Evaluation only"],
      },
      raw_gemini: {
        intake: { same_vehicle: true },
        assessment: { findings: [] },
      },
    });
  });

  it("rejects unknown model values", () => {
    expect(() => parseClaimExport(exportPayload("spoiler"))).toThrow(
      AssessmentApiError,
    );
  });

  it("keeps actionable image warnings and an intentionally skipped raw assessment", () => {
    const payload = exportPayload();
    const assessment = payload.assessment as unknown as {
      images: { quality_reasons: string[] }[];
      findings: unknown[];
    };
    const rawGemini = payload.raw_gemini as unknown as {
      assessment: Record<string, unknown> | null;
    };
    assessment.images[0].quality_reasons = ["low_resolution"];
    assessment.findings = [];
    rawGemini.assessment = null;

    const concise = JSON.parse(
      serializeClaimExport(parseClaimExport(payload)),
    ) as Record<string, unknown>;

    expect(concise.images).toEqual([
      {
        image_id: "img_test",
        file_name: "front.jpg",
        view: "front",
        usable: true,
        quality_reasons: ["low_resolution"],
      },
    ]);
    expect(concise.raw_gemini).toEqual({
      intake: { same_vehicle: true },
      assessment: null,
    });
  });
});
