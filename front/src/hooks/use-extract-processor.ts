import { useState, useEffect } from "react";
import { type Detection } from "@/lib/extract-utils";
import { api, transformPreviewTo2DArray } from "@/lib/api";
import { toast } from "sonner";

export const useExtractProcessor = (files: any[], onComplete?: () => void) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [tableData, setTableData] = useState<Record<string, string[][]>>({});
  const [cellConfidenceData, setCellConfidenceData] = useState<Record<string, number[][]>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsProcessing(false);
    setHasProcessed(false);
    setProgress(0);
    setDetections([]);
    setTableData({});
    setCellConfidenceData({});
    setJobId(null);
    setError(null);
  }, [files]);

  const processFiles = async (onStart?: () => void) => {
    if (files.length === 0) return;

    if (onStart) onStart();
    setIsProcessing(true);
    setHasProcessed(false);
    setProgress(0);
    setError(null);
    setJobId(null);

    try {
      const fileObj = files[0].file;
      const file = fileObj instanceof File ? fileObj : null;
      
      if (!file) {
        throw new Error("No valid file provided");
      }

      const job = await api.createJob(file);
      setJobId(job.job_id);

      let currentJob = job;
      while (currentJob.status !== "done" && currentJob.status !== "failed") {
        await new Promise(resolve => setTimeout(resolve, 1000));
        currentJob = await api.getJob(job.job_id);
        setProgress(currentJob.progress || 0);
      }

      if (currentJob.status === "failed") {
        throw new Error(currentJob.error || "Job processing failed");
      }

      setProgress(100);

      const tablesRaw = await api.getTables(job.job_id);
      const tables = [...tablesRaw].sort((a, b) => {
        if (a.page_num !== b.page_num) return (a.page_num || 0) - (b.page_num || 0);
        if (a.table_index !== b.table_index) return (a.table_index || 0) - (b.table_index || 0);
        if (a.bbox && b.bbox && a.bbox.length >= 2 && b.bbox.length >= 2) return a.bbox[1] - b.bbox[1];
        return 0;
      });
      
      const newDetections: Detection[] = tables.map((t) => ({
        id: t.id,
        bbox: (t.bbox as [number, number, number, number]) || [0, 0, 0, 0],
        label: `Table ${t.table_index + 1}`,
        confidence: t.detection_confidence,
        type: 'table' as const,
        page: (t.page_num ?? 0) + 1,
        crop_url: `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1"}/jobs/${job.job_id}/tables/${t.id}/crop`
      }));
      setDetections(newDetections);

      const newTableData: Record<string, string[][]> = {};
      const newCellConfidenceData: Record<string, number[][]> = {};
      await Promise.all(
        tables.map(async (t) => {
          try {
            const preview = await api.getTablePreview(job.job_id, t.id);
            newTableData[t.id] = transformPreviewTo2DArray(preview);
            newCellConfidenceData[t.id] = preview.rows.map(row => row.map(cell => cell.confidence ?? 1.0));
          } catch (e) {
            console.error(`Failed to fetch preview for table ${t.id}`, e);
          }
        })
      );
      setTableData(newTableData);
      setCellConfidenceData(newCellConfidenceData);

      setIsProcessing(false);
      setHasProcessed(true);
      if (onComplete) onComplete();
    } catch (err: any) {
      console.error("Extraction error:", err);
      setError(err.message || "An error occurred during processing");
      toast.error(err.message || "An error occurred during processing");
      setIsProcessing(false);
      setHasProcessed(false);
    }
  };

  const updateCellOverride = async (tableId: string, row: number, col: number, text: string) => {
    if (!jobId) return;
    try {
      await api.updateTablePreview(jobId, tableId, { cells: [{ row, col, text }] });
    } catch (e: any) {
      console.error("Failed to update cell override", e);
      toast.error(e.message || "Failed to save cell changes");
    }
  };

  return {
    isProcessing,
    hasProcessed,
    progress,
    detections,
    tableData,
    cellConfidenceData,
    jobId,
    error,
    setTableData,
    setDetections,
    processFiles,
    updateCellOverride
  };
};
