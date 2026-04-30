import { api, type ExportFormat } from "./api";

export interface Detection {
  id: string;
  bbox: [number, number, number, number];
  label: string;
  confidence: number;
  type: 'table' | 'cell' | 'header';
  page?: number;
  crop_url?: string;
}

export const parseCSV = (csvText: string): string[][] => {
  if (!csvText) return [];
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentRow.length > 0 || currentCell !== '') {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }
  return rows.filter(row => row.length > 1 || row[0] !== '');
};

export const getColor = (confidence: number) => {
  if (confidence > 0.9) return { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.1)', hoverFill: 'rgba(34, 197, 94, 0.25)' };
  if (confidence >= 0.7) return { stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.1)', hoverFill: 'rgba(249, 115, 22, 0.25)' };
  return { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.1)', hoverFill: 'rgba(239, 68, 68, 0.25)' };
};

export const handleExportFile = async (
  jobId: string | null,
  hasProcessed: boolean,
  files: any[],
  format: ExportFormat = "csv",
  baseFileName: string = "document"
) => {
  if (!hasProcessed || files.length === 0 || !jobId) return;

  try {
    const exportRes = await api.exportJob(jobId, format);
    
    // Create download link from the backend's download URL
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
    // Fetch as blob so the UI can control the final filename.
    const res = await fetch(`${baseUrl.replace(/\/api\/v1\/?$/, '')}${exportRes.download_url}`);
    if (!res.ok) throw new Error(`Failed to download ${format.toUpperCase()}`);
    
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    
    const uploadedFileName = files[0]?.file?.name || baseFileName;
    const baseName = uploadedFileName.includes('.') 
      ? uploadedFileName.substring(0, uploadedFileName.lastIndexOf('.')) 
      : uploadedFileName;
      
    a.download = `tables_${baseName}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Export failed:", error);
    // Let the component handle UI error toast if needed
    throw error;
  }
};
