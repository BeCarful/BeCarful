import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AssessmentApi,
  parseClaimExport,
  type ClaimExportV1,
} from "@/lib/assessment/assessment-api";

import { AssessmentPanel } from "./assessment-panel";

function makeBundle(
  status: "needs_more_photos" | "needs_human_review" = "needs_human_review",
): ClaimExportV1 {
  return parseClaimExport({
    export_schema_version: "1.0",
    claim_id: "clm_test",
    analysis_run_id: status === "needs_more_photos" ? "run_one" : "run_two",
    source_images: ["front", "rear", "left", "right"].map((name) => ({
      image_id: `img_${name}`,
      file_name: `${name}.jpg`,
      content_type: "image/jpeg",
      size_bytes: 5,
    })),
    assessment: {
      schema_version: "1.0",
      claim_id: "clm_test",
      analysis_run_id: status === "needs_more_photos" ? "run_one" : "run_two",
      status,
      findings:
        status === "needs_more_photos"
          ? []
          : [
              {
                finding_id: "finding_one",
                part_id: "hood",
                damage_type: "dent",
                visual_severity: "moderate",
              },
            ],
      coverage: {
        missing: status === "needs_more_photos" ? ["right"] : [],
        complete: status !== "needs_more_photos",
      },
      review_reasons: ["confidence_unvalidated"],
      limitations: ["Evaluation only"],
    },
    raw_gemini: {
      intake: { same_vehicle: true },
      assessment: status === "needs_more_photos" ? null : { findings: [] },
    },
  });
}

function photos(count: number, prefix = "view"): File[] {
  return Array.from(
    { length: count },
    (_, index) =>
      new File([`${prefix}-${index}`], `${prefix}-${index}.jpg`, {
        type: "image/jpeg",
      }),
  );
}

beforeEach(() => {
  let objectId = 0;
  const NativeUrl = URL;
  class MockUrl extends NativeUrl {
    static createObjectURL = vi.fn(() => `blob:preview-${objectId++}`);
    static revokeObjectURL = vi.fn();
  }
  vi.stubGlobal("URL", MockUrl);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function configuredApi(bundle: ClaimExportV1) {
  const api = new AssessmentApi("http://backend.test");
  vi.spyOn(api, "createClaim").mockResolvedValue({
    claim_id: "clm_test",
    status: "draft",
    active_run_id: null,
    image_count: 0,
    failure_code: null,
  });
  vi.spyOn(api, "uploadPhoto").mockResolvedValue("img_test");
  vi.spyOn(api, "submitClaim").mockResolvedValue({
    claim_id: "clm_test",
    analysis_run_id: bundle.analysis_run_id,
    claim_status: "queued",
    run_status: "queued",
  });
  vi.spyOn(api, "getClaim").mockResolvedValue({
    claim_id: "clm_test",
    status: bundle.assessment.status,
    active_run_id: bundle.analysis_run_id,
    image_count: bundle.source_images.length,
    failure_code: null,
  });
  vi.spyOn(api, "getExport").mockResolvedValue(bundle);
  return api;
}

describe("AssessmentPanel", () => {
  it("uses a laptop multi-file picker and accepts a single photo", () => {
    const api = configuredApi(makeBundle());
    render(
      <AssessmentPanel
        api={api}
        onAssessmentStarted={vi.fn()}
        onAssessmentReady={vi.fn()}
      />,
    );
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    expect(input).toHaveAttribute("multiple");
    expect(input).not.toHaveAttribute("capture");
    fireEvent.change(input, { target: { files: photos(1) } });

    expect(
      screen.getByText("1 of 12 photos · 20 MiB maximum each"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload and assess" }),
    ).toBeEnabled();
  });

  it("uploads four photos, displays both JSON forms, and downloads the bundle", async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    const api = configuredApi(bundle);
    const onReady = vi.fn();
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    render(
      <AssessmentPanel
        api={api}
        onAssessmentStarted={vi.fn()}
        onAssessmentReady={onReady}
      />,
    );
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: photos(4) } });

    await user.click(screen.getByRole("button", { name: "Upload and assess" }));
    await waitFor(() => expect(onReady).toHaveBeenCalledWith(bundle));

    expect(api.createClaim).toHaveBeenCalledOnce();
    expect(api.uploadPhoto).toHaveBeenCalledTimes(4);
    expect(api.submitClaim).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("tab", { name: "Validated assessment" }),
    ).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Raw Gemini" }));
    expect(screen.getByText(/same_vehicle/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Download JSON" }));
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("allows one additional photo on a claim that needs more views", async () => {
    const user = userEvent.setup();
    const firstBundle = makeBundle("needs_more_photos");
    const finalBundle = makeBundle("needs_human_review");
    const api = configuredApi(firstBundle);
    vi.mocked(api.getClaim)
      .mockResolvedValueOnce({
        claim_id: "clm_test",
        status: "needs_more_photos",
        active_run_id: "run_one",
        image_count: 4,
        failure_code: null,
      })
      .mockResolvedValueOnce({
        claim_id: "clm_test",
        status: "needs_human_review",
        active_run_id: "run_two",
        image_count: 5,
        failure_code: null,
      });
    vi.mocked(api.getExport)
      .mockResolvedValueOnce(firstBundle)
      .mockResolvedValueOnce(finalBundle);
    render(
      <AssessmentPanel
        api={api}
        onAssessmentStarted={vi.fn()}
        onAssessmentReady={vi.fn()}
      />,
    );
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: photos(4) } });
    await user.click(screen.getByRole("button", { name: "Upload and assess" }));
    await screen.findByText(/Coverage suggestion: add right/);

    fireEvent.change(input, { target: { files: photos(1, "extra") } });
    await user.click(
      screen.getByRole("button", { name: "Upload and reassess" }),
    );

    await waitFor(() => expect(api.submitClaim).toHaveBeenCalledTimes(2));
    expect(api.createClaim).toHaveBeenCalledOnce();
    expect(api.uploadPhoto).toHaveBeenCalledTimes(5);
  });
});
