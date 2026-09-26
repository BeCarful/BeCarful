import { isPartId, type PartId } from "@/lib/car/car-parts";
import type { VisualSeverity } from "@/lib/damage/damage-report";

export const DEFAULT_CV_API_BASE_URL = "http://127.0.0.1:8000";
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const MIN_PHOTOS = 1;
export const MAX_PHOTOS = 12;

const SUPPORTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MIME_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export type ClaimStatus =
  | "draft"
  | "queued"
  | "preprocessing"
  | "assessing"
  | "completed"
  | "needs_more_photos"
  | "needs_human_review"
  | "failed"
  | "deleted";

export type AssessmentFinding = {
  finding_id: string;
  part_id: PartId;
  damage_type: string;
  visual_severity: VisualSeverity;
};

export type AssessmentV1 = Record<string, unknown> & {
  schema_version: "1.0";
  claim_id: string;
  analysis_run_id: string;
  status: ClaimStatus;
  findings: AssessmentFinding[];
  coverage: {
    missing: string[];
    complete: boolean;
  };
  review_reasons: string[];
  limitations: string[];
};

export type SourceImageExport = {
  image_id: string;
  file_name: string | null;
  content_type: string;
  size_bytes: number;
};

export type ClaimExportV1 = {
  export_schema_version: "1.0";
  claim_id: string;
  analysis_run_id: string;
  source_images: SourceImageExport[];
  assessment: AssessmentV1;
  raw_gemini: {
    intake: Record<string, unknown>;
    assessment: Record<string, unknown> | null;
  };
};

export type ClaimResponse = {
  claim_id: string;
  status: ClaimStatus;
  active_run_id: string | null;
  image_count: number;
  failure_code: string | null;
};

export type SubmissionResponse = {
  claim_id: string;
  analysis_run_id: string;
  claim_status: ClaimStatus;
  run_status: string;
};

type UploadTicket = {
  image_id: string;
  upload_url: string;
  method: string;
  required_headers: Record<string, string>;
};

type Fetch = typeof fetch;

export class AssessmentApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "AssessmentApiError";
  }
}

export class AssessmentPollTimeoutError extends Error {
  constructor() {
    super("Assessment is still running. Check its status again in a moment.");
    this.name = "AssessmentPollTimeoutError";
  }
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AssessmentApiError(`${name} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new AssessmentApiError(`${key} must be a string`);
  }
  return value;
}

function requireStringArray(
  record: Record<string, unknown>,
  key: string,
): string[] {
  const value = record[key];
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new AssessmentApiError(`${key} must be a string array`);
  }
  return value;
}

const CLAIM_STATUSES = new Set<ClaimStatus>([
  "draft",
  "queued",
  "preprocessing",
  "assessing",
  "completed",
  "needs_more_photos",
  "needs_human_review",
  "failed",
  "deleted",
]);

const SEVERITIES = new Set<VisualSeverity>(["minor", "moderate", "severe"]);

function parseClaimStatus(value: unknown): ClaimStatus {
  if (typeof value !== "string" || !CLAIM_STATUSES.has(value as ClaimStatus)) {
    throw new AssessmentApiError("Unknown claim status");
  }
  return value as ClaimStatus;
}

function parseAssessment(value: unknown): AssessmentV1 {
  const assessment = asRecord(value, "assessment");
  if (assessment.schema_version !== "1.0") {
    throw new AssessmentApiError("Unsupported assessment schema version");
  }
  requireString(assessment, "claim_id");
  requireString(assessment, "analysis_run_id");
  parseClaimStatus(assessment.status);

  if (!Array.isArray(assessment.findings)) {
    throw new AssessmentApiError("assessment.findings must be an array");
  }
  for (const rawFinding of assessment.findings) {
    const finding = asRecord(rawFinding, "finding");
    const partId = requireString(finding, "part_id");
    const severity = requireString(finding, "visual_severity");
    requireString(finding, "finding_id");
    requireString(finding, "damage_type");
    if (!isPartId(partId)) {
      throw new AssessmentApiError(`Unknown assessment part: ${partId}`);
    }
    if (!SEVERITIES.has(severity as VisualSeverity)) {
      throw new AssessmentApiError(`Unknown visual severity: ${severity}`);
    }
  }

  const coverage = asRecord(assessment.coverage, "assessment.coverage");
  requireStringArray(coverage, "missing");
  if (typeof coverage.complete !== "boolean") {
    throw new AssessmentApiError(
      "assessment.coverage.complete must be a boolean",
    );
  }
  requireStringArray(assessment, "review_reasons");
  requireStringArray(assessment, "limitations");
  return assessment as AssessmentV1;
}

export function parseClaimExport(value: unknown): ClaimExportV1 {
  const bundle = asRecord(value, "claim export");
  if (bundle.export_schema_version !== "1.0") {
    throw new AssessmentApiError("Unsupported export schema version");
  }
  requireString(bundle, "claim_id");
  requireString(bundle, "analysis_run_id");
  if (!Array.isArray(bundle.source_images)) {
    throw new AssessmentApiError("source_images must be an array");
  }
  for (const rawImage of bundle.source_images) {
    const image = asRecord(rawImage, "source image");
    requireString(image, "image_id");
    requireString(image, "content_type");
    if (image.file_name !== null && typeof image.file_name !== "string") {
      throw new AssessmentApiError(
        "source image file_name must be a string or null",
      );
    }
    if (typeof image.size_bytes !== "number" || image.size_bytes <= 0) {
      throw new AssessmentApiError("source image size_bytes must be positive");
    }
  }
  parseAssessment(bundle.assessment);
  const rawGemini = asRecord(bundle.raw_gemini, "raw_gemini");
  asRecord(rawGemini.intake, "raw_gemini.intake");
  if (rawGemini.assessment !== null) {
    asRecord(rawGemini.assessment, "raw_gemini.assessment");
  }
  return bundle as ClaimExportV1;
}

function parseClaim(value: unknown): ClaimResponse {
  const claim = asRecord(value, "claim");
  const activeRunId = claim.active_run_id;
  const failureCode = claim.failure_code;
  if (activeRunId !== null && typeof activeRunId !== "string") {
    throw new AssessmentApiError("active_run_id must be a string or null");
  }
  if (failureCode !== null && typeof failureCode !== "string") {
    throw new AssessmentApiError("failure_code must be a string or null");
  }
  if (typeof claim.image_count !== "number") {
    throw new AssessmentApiError("image_count must be a number");
  }
  return {
    claim_id: requireString(claim, "claim_id"),
    status: parseClaimStatus(claim.status),
    active_run_id: activeRunId,
    image_count: claim.image_count,
    failure_code: failureCode,
  };
}

async function responseJson(response: Response): Promise<unknown> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const record =
      typeof payload === "object" && payload !== null
        ? (payload as Record<string, unknown>)
        : null;
    const message =
      typeof record?.message === "string"
        ? record.message
        : `Backend request failed with status ${response.status}`;
    throw new AssessmentApiError(message, response.status);
  }
  return payload;
}

export function photoContentType(file: File): string | null {
  const declared = file.type.toLowerCase();
  if (SUPPORTED_TYPES.has(declared)) {
    return declared;
  }
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  return MIME_TYPE_BY_EXTENSION[extension] ?? null;
}

export function validatePhoto(file: File): string | null {
  if (file.size === 0) {
    return `${file.name} is empty.`;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `${file.name} exceeds the 20 MiB limit.`;
  }
  if (photoContentType(file) === null) {
    return `${file.name} is not a supported JPEG, PNG, WebP, HEIC, or HEIF image.`;
  }
  return null;
}

export function claimExportFileName(bundle: ClaimExportV1): string {
  return `becarful-${bundle.claim_id}-${bundle.analysis_run_id}.json`;
}

export function serializeClaimExport(bundle: ClaimExportV1): string {
  return JSON.stringify(bundle, null, 2);
}

export class AssessmentApi {
  readonly baseUrl: string;

  constructor(
    baseUrl = process.env.NEXT_PUBLIC_CV_API_BASE_URL ??
      DEFAULT_CV_API_BASE_URL,
    private readonly fetcher: Fetch = fetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async createClaim(signal?: AbortSignal): Promise<ClaimResponse> {
    const response = await this.fetcher(`${this.baseUrl}/v1/claims`, {
      method: "POST",
      signal,
    });
    return parseClaim(await responseJson(response));
  }

  async getClaim(
    claimId: string,
    signal?: AbortSignal,
  ): Promise<ClaimResponse> {
    const response = await this.fetcher(
      `${this.baseUrl}/v1/claims/${encodeURIComponent(claimId)}`,
      { signal },
    );
    return parseClaim(await responseJson(response));
  }

  async uploadPhoto(
    claimId: string,
    file: File,
    signal?: AbortSignal,
  ): Promise<string> {
    const contentType = photoContentType(file);
    if (contentType === null) {
      throw new AssessmentApiError(`Unsupported photo format: ${file.name}`);
    }
    const prepared = await this.fetcher(
      `${this.baseUrl}/v1/claims/${encodeURIComponent(claimId)}/images:prepare-upload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_type: contentType,
          size_bytes: file.size,
          file_name: file.name,
        }),
        signal,
      },
    );
    const rawTicket = asRecord(await responseJson(prepared), "upload ticket");
    const requiredHeaders = asRecord(
      rawTicket.required_headers,
      "required_headers",
    );
    if (
      !Object.values(requiredHeaders).every(
        (value) => typeof value === "string",
      )
    ) {
      throw new AssessmentApiError("Upload headers must contain string values");
    }
    const ticket: UploadTicket = {
      image_id: requireString(rawTicket, "image_id"),
      upload_url: requireString(rawTicket, "upload_url"),
      method: requireString(rawTicket, "method"),
      required_headers: requiredHeaders as Record<string, string>,
    };
    const uploaded = await this.fetcher(ticket.upload_url, {
      method: ticket.method,
      headers: ticket.required_headers,
      body: file,
      signal,
    });
    if (!uploaded.ok) {
      throw new AssessmentApiError(
        `Uploading ${file.name} failed with status ${uploaded.status}`,
        uploaded.status,
      );
    }
    return ticket.image_id;
  }

  async submitClaim(
    claimId: string,
    signal?: AbortSignal,
  ): Promise<SubmissionResponse> {
    const response = await this.fetcher(
      `${this.baseUrl}/v1/claims/${encodeURIComponent(claimId)}:submit`,
      { method: "POST", signal },
    );
    const submission = asRecord(await responseJson(response), "submission");
    return {
      claim_id: requireString(submission, "claim_id"),
      analysis_run_id: requireString(submission, "analysis_run_id"),
      claim_status: parseClaimStatus(submission.claim_status),
      run_status: requireString(submission, "run_status"),
    };
  }

  async getExport(
    claimId: string,
    signal?: AbortSignal,
  ): Promise<ClaimExportV1> {
    const response = await this.fetcher(
      `${this.baseUrl}/v1/claims/${encodeURIComponent(claimId)}/export`,
      { signal },
    );
    return parseClaimExport(await responseJson(response));
  }
}

const TERMINAL_STATUSES = new Set<ClaimStatus>([
  "completed",
  "needs_more_photos",
  "needs_human_review",
  "failed",
  "deleted",
]);

export async function pollClaimUntilTerminal(
  api: AssessmentApi,
  claimId: string,
  options: {
    signal?: AbortSignal;
    onStatus?: (claim: ClaimResponse) => void;
    intervalMs?: number;
    timeoutMs?: number;
  } = {},
): Promise<ClaimResponse> {
  const intervalMs = options.intervalMs ?? 2_000;
  const timeoutMs = options.timeoutMs ?? 20 * 60 * 1_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const claim = await api.getClaim(claimId, options.signal);
    options.onStatus?.(claim);
    if (TERMINAL_STATUSES.has(claim.status)) {
      return claim;
    }
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timeout);
        reject(
          options.signal?.reason ?? new DOMException("Aborted", "AbortError"),
        );
      };
      const timeout = setTimeout(() => {
        options.signal?.removeEventListener("abort", onAbort);
        resolve();
      }, intervalMs);
      options.signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
  throw new AssessmentPollTimeoutError();
}
