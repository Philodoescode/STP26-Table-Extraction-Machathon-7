import { useState } from "react";
import { type Detection, parseCSV, MOCK_DATA } from "@/lib/extract-utils";

export const useExtractProcessor = (files: any[], onComplete?: () => void) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [tableData, setTableData] = useState<Record<string, string[][]>>({});

  const processFiles = (onStart?: () => void) => {
    if (files.length === 0) return;

    if (onStart) onStart();
    setIsProcessing(true);
    setHasProcessed(false);
    setProgress(0);

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 10;
      setProgress(currentProgress);
      
      if (currentProgress >= 100) {
        clearInterval(interval);
        
        const fileName = files[0].file instanceof File ? files[0].file.name : files[0].file.name || "";
        const mock = MOCK_DATA[fileName] || { detections: [], csv: "" };
        
        const parsedRows = parseCSV(mock.csv);
        const tableIndexToId: Record<string, string> = {};
        mock.detections.forEach((d: any) => {
          tableIndexToId[d.table_index.toString()] = d.id;
        });

        const newTableData: Record<string, string[][]> = {};
        parsedRows.forEach(row => {
          if (row.length < 3) return;
          const tableIndexStr = row[1];
          const regionId = tableIndexToId[tableIndexStr];
          if (regionId) {
            if (!newTableData[regionId]) newTableData[regionId] = [];
            newTableData[regionId].push(row.slice(3));
          }
        });
        
        setTableData(newTableData);
        
        const mappedDetections = mock.detections.map((d: any) => ({
          id: d.id,
          bbox: d.bbox,
          label: "Table",
          confidence: d.detection_confidence,
          type: 'table' as const,
          page: (d.page_num || 0) + 1
        }));
        setDetections(mappedDetections);

        setIsProcessing(false);
        setHasProcessed(true);
        if (onComplete) onComplete();
      }
    }, 300);
  };

  return {
    isProcessing,
    hasProcessed,
    progress,
    detections,
    tableData,
    setTableData,
    setDetections,
    processFiles
  };
};