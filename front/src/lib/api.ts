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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export const api = {
  async getJob(jobId: string): Promise<JobResponse> {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
    if (!res.ok) throw new Error("Failed to fetch job");
    return res.json();
  },

  async getTables(jobId: string): Promise<TableResponse[]> {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/tables`);
    if (!res.ok) throw new Error("Failed to fetch tables");
    return res.json();
  },

  async getTablePreview(jobId: string, tableId: string): Promise<PreviewResponse> {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/tables/${tableId}/preview`);
    if (!res.ok) throw new Error("Failed to fetch table preview");
    return res.json();
  },

  async updateTablePreview(jobId: string, tableId: string, overrides: PreviewUpdateRequest): Promise<PreviewUpdateResponse> {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/tables/${tableId}/preview`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(overrides),
    });
    if (!res.ok) throw new Error("Failed to update table preview");
    return res.json();
  },
  
  async createJob(file: File): Promise<JobResponse> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE_URL}/jobs`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Failed to create job");
    return res.json();
  }
};

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
