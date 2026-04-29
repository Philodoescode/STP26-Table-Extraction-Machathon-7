import { useState, useEffect } from "react";
import { type Detection } from "@/lib/extract-utils";
import { api, transformPreviewTo2DArray } from "@/lib/api";

export const useExtractProcessor = (files: any[], onComplete?: () => void) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [tableData, setTableData] = useState<Record<string, string[][]>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsProcessing(false);
    setHasProcessed(false);
    setProgress(0);
    setDetections([]);
    setTableData({});
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
      while (currentJob.status !== "completed" && currentJob.status !== "failed") {
        await new Promise(resolve => setTimeout(resolve, 1000));
        currentJob = await api.getJob(job.job_id);
        setProgress(currentJob.progress || 0);
      }

      if (currentJob.status === "failed") {
        throw new Error(currentJob.error || "Job processing failed");
      }

      setProgress(100);

      const tables = await api.getTables(job.job_id);
      
      const newDetections: Detection[] = tables.map((t, i) => ({
        id: t.id,
        bbox: (t.bbox as [number, number, number, number]) || [0, 0, 0, 0],
        label: `Table ${i + 1}`,
        confidence: t.detection_confidence,
        type: 'table' as const,
        page: (t.page_num || 0) + 1
      }));
      setDetections(newDetections);

      const newTableData: Record<string, string[][]> = {};
      for (const t of tables) {
        try {
          const preview = await api.getTablePreview(job.job_id, t.id);
          newTableData[t.id] = transformPreviewTo2DArray(preview);
        } catch (e) {
          console.error(`Failed to fetch preview for table ${t.id}`, e);
        }
      }
      setTableData(newTableData);

      setIsProcessing(false);
      setHasProcessed(true);
      if (onComplete) onComplete();
    } catch (err: any) {
      console.error("Extraction error:", err);
      setError(err.message || "An error occurred during processing");
      setIsProcessing(false);
      setHasProcessed(false);
    }
  };

  return {
    isProcessing,
    hasProcessed,
    progress,
    detections,
    tableData,
    jobId,
    error,
    setTableData,
    setDetections,
    processFiles
  };
};
