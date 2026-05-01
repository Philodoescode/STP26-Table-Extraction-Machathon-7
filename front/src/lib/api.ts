export interface JobResponse {
  job_id: string;
  filename: string;
  status: string;
  stage?: string;
  progress: number;
  error?: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  latency_ms?: number;
}

export interface CreateJobResponse extends JobResponse {
  tables?: TableResponse[];
}

export interface UploadProgressEvent {
  type: "progress";
  status: string;
  stage?: string;
  progress?: number;
  job_id?: string;
  error?: string;
}

export interface UploadDoneEvent {
  type: "done";
  job: CreateJobResponse;
}

export interface UploadErrorEvent {
  type: "error";
  status_code?: number;
  detail?: ApiErrorDetail;
}

export type UploadStreamEvent = UploadProgressEvent | UploadDoneEvent | UploadErrorEvent;

export interface TableResponse {
  id: string;
  job_id: string;
  page_num: number;
  table_index: number;
  bbox?: number[];
  detection_confidence: number;
  crop_url: string;
}

export interface CellPreview {
  text: string;
  confidence?: number;
  bbox?: number[];
}

export interface PreviewResponse {
  rows: CellPreview[][];
}

export interface CellOverrideItem {
  row: number;
  col: number;
  text: string;
}

export interface PreviewUpdateRequest {
  cells: CellOverrideItem[];
}

export interface PreviewUpdateResponse {
  overrides_saved: number;
  table_id: string;
}

export interface ExportResponse {
  job_id: string;
  download_url: string;
  cached: boolean;
}

export type ExportFormat = "csv" | "xlsx";

export interface MetricsSnapshot {
  total_jobs: number;
  success_count: number;
  failure_count: number;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
  gpu_available: boolean;
  gpu_name: string | null;
  gpu_utilization_pct: number | null;
  gpu_memory_used_mb: number | null;
  gpu_memory_total_mb: number | null;
  gpu_containers_up: number;
  gpu_containers_active: number;
  gpu_active_calls: number;
  gpu_routes_up: number;
  gpu_max_containers: number | null;
  gpu_min_containers: number | null;
  gpu_buffer_containers: number | null;
  gpu_scaledown_window_s: number | null;
  gpu_routing_mode: string | null;
  gpu_shards: number | null;
  jobs_per_minute: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

type ApiErrorDetail = {
  detail?: string;
  code?: string;
};

class ApiError extends Error {
  status: number;
  code?: string;
  transient: boolean;

  constructor(message: string, status: number, code?: string, transient = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.transient = transient;
  }
}

const TRANSIENT_CODES = new Set(["TEMPORARY_UNAVAILABLE", "NOT_FOUND", "FILE_MISSING"]);
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toApiError(status: number, detail?: ApiErrorDetail): ApiError {
  const code = detail?.code;
  const message = detail?.detail || `Request failed with status ${status}`;
  const transient = RETRYABLE_STATUS.has(status) || (status === 404 && !!code && TRANSIENT_CODES.has(code));
  return new ApiError(message, status, code, transient);
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  options?: { retries?: number; retryDelayMs?: number },
): Promise<T> {
  const retries = options?.retries ?? 3;
  const retryDelayMs = options?.retryDelayMs ?? 250;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, init);
      if (res.ok) return res.json() as Promise<T>;

      let detail: ApiErrorDetail | undefined;
      try {
        detail = await res.json();
      } catch {
        detail = undefined;
      }

      const apiErr = toApiError(res.status, detail);
      if (!apiErr.transient || attempt === retries) throw apiErr;
      await sleep(retryDelayMs * attempt);
      continue;
    } catch (err) {
      const networkErr = err instanceof TypeError || (err instanceof Error && err.name === "AbortError");
      if (networkErr) {
        if (attempt === retries) {
          throw new ApiError("Network error while contacting API", 0, "NETWORK_ERROR", true);
        }
        await sleep(retryDelayMs * attempt);
        continue;
      }
      throw err;
    }
  }
  throw new ApiError("Request failed", 0, "UNKNOWN");
}

export const api = {
  async getJob(jobId: string): Promise<JobResponse> {
    return requestJson<JobResponse>(`/jobs/${jobId}`);
  },

  async getTables(jobId: string): Promise<TableResponse[]> {
    return requestJson<TableResponse[]>(`/jobs/${jobId}/tables`);
  },

  async getTablePreview(jobId: string, tableId: string): Promise<PreviewResponse> {
    return requestJson<PreviewResponse>(`/jobs/${jobId}/tables/${tableId}/preview`);
  },

  async updateTablePreview(jobId: string, tableId: string, overrides: PreviewUpdateRequest): Promise<PreviewUpdateResponse> {
    return requestJson<PreviewUpdateResponse>(`/jobs/${jobId}/tables/${tableId}/preview`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(overrides),
    });
  },

  async exportJob(jobId: string, format: ExportFormat = "csv"): Promise<ExportResponse> {
    return requestJson<ExportResponse>(
      `/jobs/${jobId}/export?format=${encodeURIComponent(format)}`,
      { method: "POST" }
    );
  },
  
  async createJob(file: File, mode: "fast" | "accurate" = "accurate"): Promise<CreateJobResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);
    return requestJson<CreateJobResponse>("/upload", {
      method: "POST",
      body: formData,
    });
  },

  async getMetrics(): Promise<MetricsSnapshot> {
    return requestJson<MetricsSnapshot>("/metrics", undefined, { retries: 4, retryDelayMs: 300 });
  }
};

export { ApiError };

export async function streamCreateJob(
  file: File,
  mode: "fast" | "accurate",
  onEvent: (event: UploadStreamEvent) => void,
): Promise<CreateJobResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);

  const res = await fetch(`${API_BASE_URL}/upload/stream`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let detail: ApiErrorDetail | undefined;
    try {
      detail = await res.json();
    } catch {
      detail = undefined;
    }
    throw toApiError(res.status, detail);
  }

  if (!res.body) {
    throw new ApiError("Streaming response body is not available", 0, "STREAM_UNAVAILABLE");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalJob: CreateJobResponse | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let sepIndex = buffer.indexOf("\n\n");
    while (sepIndex !== -1) {
      const chunk = buffer.slice(0, sepIndex).trim();
      buffer = buffer.slice(sepIndex + 2);
      sepIndex = buffer.indexOf("\n\n");

      if (!chunk) continue;
      const lines = chunk.split("\n");
      const dataLines = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart());
      if (dataLines.length === 0) continue;

      let evt: UploadStreamEvent;
      try {
        evt = JSON.parse(dataLines.join("\n")) as UploadStreamEvent;
      } catch {
        // ignore malformed chunks
        continue;
      }
      onEvent(evt);
      if (evt.type === "done") {
        finalJob = evt.job;
      } else if (evt.type === "error") {
        throw toApiError(evt.status_code ?? 500, evt.detail);
      }
    }
  }

  if (!finalJob) {
    throw new ApiError("Streaming upload completed without a final job payload", 0, "STREAM_MISSING_FINAL");
  }

  return finalJob;
}

export const transformPreviewTo2DArray = (preview: PreviewResponse): string[][] => {
  return preview.rows.map(row => row.map(cell => cell.text));
};

export const transform2DArrayToOverrides = (data: string[][]): CellOverrideItem[] => {
  const cells: CellOverrideItem[] = [];
  data.forEach((row, rIdx) => {
    row.forEach((text, cIdx) => {
      cells.push({ row: rIdx, col: cIdx, text });
    });
  });
  return cells;
};
