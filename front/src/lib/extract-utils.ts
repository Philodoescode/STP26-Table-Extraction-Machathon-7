import JSZip from "jszip";

export interface Detection {
  id: string;
  bbox: [number, number, number, number];
  label: string;
  confidence: number;
  type: 'table' | 'cell' | 'header';
  page?: number;
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

export const handleExportCSV = async (
  hasProcessed: boolean,
  files: any[],
  detections: Detection[],
  tableData: Record<string, string[][]>
) => {
  if (!hasProcessed || files.length === 0) return;

  const zip = new JSZip();
  const fileObj = files[0].file;
  const isPdf = fileObj instanceof File && fileObj.type === "application/pdf";
  const uploadedFileName = fileObj instanceof File ? fileObj.name : fileObj.name || "document";
  const baseName = uploadedFileName.includes('.') ? uploadedFileName.substring(0, uploadedFileName.lastIndexOf('.')) : uploadedFileName;

  const regionPageMap = new Map<string, number>();
  detections.forEach(det => {
    if (det.page) regionPageMap.set(det.id, det.page);
  });

  let tableNo = 1;
  for (const [regionId, rows] of Object.entries(tableData)) {
    const csvRows = rows.map(row => {
      return row.map(val => {
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(",");
    });
    const csvContent = csvRows.join("\n");
    
    const page = regionPageMap.get(regionId) || 1;
    let filePath = `${baseName}_table_${tableNo}.csv`;
    
    if (isPdf) {
      filePath = `page_${page}/${filePath}`;
    }
    
    zip.file(filePath, csvContent);
    tableNo++;
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}_extracted_tables.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
