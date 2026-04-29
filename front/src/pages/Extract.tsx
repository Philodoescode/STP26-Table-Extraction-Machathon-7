"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import JSZip from "jszip";
import { useFileUpload } from "@/hooks/use-file-upload";
import ExtractPaginationBtns from "@/components/extract-pagination-btns";
import ExtractTabs from "@/components/extract-tabs";
import ExtractConfigRadioBtns from "@/components/extract-config-radio-btns";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Empty,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { IconTextRecognition, IconLetterXSmall, IconFileUploadFilled, IconZoomIn, IconXFilled, IconFileTypePdf, IconMoodPuzzled} from '@tabler/icons-react';

export interface Detection {
  id: string;
  bbox: [number, number, number, number];
  label: string;
  confidence: number;
  type: 'table' | 'cell' | 'header';
  page?: number;
}

const parseCSV = (csvText: string): string[][] => {
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

const MOCK_DATA: Record<string, { detections: any[], csv: string }> = {
  "image-test-1.png": {
    detections: [
      {
          "id": "c0d2781c-5f3c-448d-8122-6e3d541efc5e",
          "job_id": "c08c9302-2b14-4661-956e-b95827a68c39",
          "page_num": 0,
          "table_index": 0,
          "bbox": [118, 437, 1182, 1524],
          "detection_confidence": 0.6882,
          "crop_url": "/api/v1/jobs/c08c9302-2b14-4661-956e-b95827a68c39/tables/c0d2781c-5f3c-448d-8122-6e3d541efc5e/crop"
      }
    ],
    csv: `page,table_index,detection_confidence,col_0,col_1,col_2\n0,0,0.6882,DAILY ACCOUNT ACTIVITY,,\n0,0,0.6882,Electronic Payments (continued),,\n0,0,0.6882,POSTING DATE,DESCRIPTION,AMOUNT\n0,0,0.6882,08/03,"INTL DEBIT CARD PUR,******30073995581, AUT 073120 INTL DDA PURNDIE PARTNERS BUDAPEST HU H UN",37.95\n0,0,0.6882,08/03,"INTL DEBIT CARD PUR,******30073995581, AUT 073120 INTL DDA PURNDIE PARTNERS BUDAPEST HU H UN",37.95\n0,0,0.6882,08/03,"INTL DEBIT CARD PUR,****30073995581, AUT 073120 INTL DDA PURNDIE PARTNERS BUDAPEST HU H UN",37.95\n0,0,0.6882,08/03,"DEBIT CARD PURCHASE,****30073995581, AUT 080120 VISA DDA PURONLYFANS COM8886880458 * IL",4.95\n0,0,0.6882,08/03,"DEBIT CARD PURCHASE,****30073995581, AUT 080120 VISA DDA PURONLYFANS COM8886880458 * IL",10.00\n0,0,0.6882,08/03,"DEBIT CARD PURCHASE,****30073995581, AUT 080220 VISA DDA PURONLYFANS COM 8886880458 * IL",3.20\n0,0,0.6882,08/03,"DEBIT CARD PURCHASE,****30073995581, AUT 080220 VISA DDA PURONLYFANS COM8886880458 * IL",3.33\n0,0,0.6882,08/03,"ELECTRONIC PMT-WEB, DISCOVER E-PAYMENT 4580",283.87\n0,0,0.6882,08/04,"DEBIT CARD PURCHASE,****30073995581, AUT 080120 VISA DDA PURONLYFANS 8886880458 * IL",3.00\n0,0,0.6882,08/04,"DEBIT CARD PURCHASE,****30073995581, AUT 080320 VISA DDA PURONLYFANS COM8886880458 * IL",4.50\n0,0,0.6882,08/04,"DEBIT CARD PURCHASE,****30073995581, AUT 080320 VISA DDA PURONLYFANS COM8886880458 * IL",5.00\n0,0,0.6882,08/04,"DEBIT CARD PURCHASE,****30073995581, AUT 080320 VISA DDA PURONLYFANS COM8886880458 * IL",12.50\n0,0,0.6882,08/04,"DEBIT CARD PURCHASE,****30073995581, AUT 080320 VISA DDA PURONLYFANS COM8886880458 * IL",30.00\n0,0,0.6882,08/04,"DEBIT CARD PAYMENT,****30073995581, AUT 080320 VISA DDA PURONLYFANS COM8886880458 * IL",5.50\n0,0,0.6882,08/05,"DEBIT CARD PURCHASE,****30073995581, AUT 080420 VISA DDA PURONLYFANS COM8886880458 * IL",6.99\n0,0,0.6882,08/06,"DEBIT CARD PURCHASE,****30073995581, AUT 080520 VISA DDA PURONLYFANS COM8886880458 * IL",15.00\n0,0,0.6882,08/07,"DEBIT CARD PURCHASE,****30073995581, AUT 080520 VISA DDA PURONLYFANS8886880458 * IL",10.00\n0,0,0.6882,08/07,"DEBIT CARD PURCHASE,****30073995581, AUT 080520 VISA DDA PURONLYFANS8886880458 * IL",10.00\n0,0,0.6882,08/07,"DEBIT CARD PURCHASE,****30073995581, AUT 080620 VISA DDA PURONLYFANS COM8886880458 * IL",24.00\n0,0,0.6882,08/07,"DEBIT CARD PURCHASE,****30073995581, AUT 080620 VISA DDA PURONLYFANS COM8886880458 * IL",24.00\n0,0,0.6882,08/10,"DEBIT CARD PURCHASE,****30073995581, AUT 080520 VISA DDA PURONLYFANS886 2656609 * IL",3.49\n0,0,0.6882,08/10,"NONTD ATM DEBIT,******30073995581, AUT 080820 DDA WITHDRAW",125.99`
  },
  "image-test-2.jpg": {
    detections: [
      {
          "id": "ef8d331e-b875-434c-9535-35bd91b1bd50",
          "job_id": "553a9458-4adc-4b9e-9fba-5bf49718e2fa",
          "page_num": 0,
          "table_index": 0,
          "bbox": [82, 155, 914, 318],
          "detection_confidence": 0.9988,
          "crop_url": "/api/v1/jobs/553a9458-4adc-4b9e-9fba-5bf49718e2fa/tables/ef8d331e-b875-434c-9535-35bd91b1bd50/crop"
      },
      {
          "id": "92d41986-8d37-4822-91e1-fee2b309ab06",
          "job_id": "553a9458-4adc-4b9e-9fba-5bf49718e2fa",
          "page_num": 0,
          "table_index": 1,
          "bbox": [80, 404, 912, 619],
          "detection_confidence": 0.9994,
          "crop_url": "/api/v1/jobs/553a9458-4adc-4b9e-9fba-5bf49718e2fa/tables/92d41986-8d37-4822-91e1-fee2b309ab06/crop"
      },
      {
          "id": "529584b5-fa6f-4cfc-941e-16003068a023",
          "job_id": "553a9458-4adc-4b9e-9fba-5bf49718e2fa",
          "page_num": 0,
          "table_index": 2,
          "bbox": [80, 717, 912, 864],
          "detection_confidence": 0.9995,
          "crop_url": "/api/v1/jobs/553a9458-4adc-4b9e-9fba-5bf49718e2fa/tables/529584b5-fa6f-4cfc-941e-16003068a023/crop"
      }
    ],
    csv: `page,table_index,detection_confidence,col_0,col_1,col_2,col_3,col_4,col_5\n0,0,0.9988,Trait,PC1,PC2,PC3,,\n0,0,0.9988,Log Chol,0.96,0.03,0.08,,\n0,0,0.9988,HDL,-0.17,-0.73,0.21,,\n0,0,0.9988,LDL,0.99,0.01,-0.03,,\n0,0,0.9988,Log TG,-0.11,0.79,0.16,,\n0,0,0.9988,BMI,-0.04,0.44,0.54,,\n0,0,0.9988,Log SBP,0.07,-0.15,0.83,,\n0,1,0.9994,,Trait,Mean (SD),H2rA (SE),,\n0,1,0.9994,1,Log Chol,5.32 (0.17),0.63 (0.04),,\n0,1,0.9994,2,HDL,50.22 (11.64),0.71 (0.03),,\n0,1,0.9994,3,LDL,128.89 (37.90),0.60 (0.04),,\n0,1,0.9994,4,Log TG,4.83 (0.48),0.62 (0.04),,\n0,1,0.9994,5,BMI,26.74 (4.79),0.79 (0.03),,\n0,1,0.9994,6,Log SBP,4.88 (0.12),0.75 (0.03),,\n0,1,0.9994,PC 1,1/2 (Log Chol + LDL),,0.62 (0.04),,\n0,1,0.9994,PC 2,1/2 BMI + (Log TG - HDL),,0.80 (0.03),,\n0,1,0.9994,PC 3,Log SBP + 2/3 BMI,,0.74 (0.03),,\n0,2,0.9995,Component,Peak,Maximum LOD,Chromosome,Position (cM),Marker\n0,2,0.9995,PC 1,- - -,No LOD > 1.0,,,\n0,2,0.9995,PC 2,- - -,No LOD > 1.0,,,\n0,2,0.9995,PC 3,Peak 1,1.18,3,132,False +\n0,2,0.9995,Peak 2,1.07,7,137,b10 @ 124 (height),\n0,2,0.9995,Peak 3,1.16,15,20,False +,`
  },
  "image-test-3.jpeg": {
    detections: [],
    csv: ""
  }
};

const getColor = (confidence: number) => {
  if (confidence > 0.9) return { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.1)', hoverFill: 'rgba(34, 197, 94, 0.25)' };
  if (confidence >= 0.7) return { stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.1)', hoverFill: 'rgba(249, 115, 22, 0.25)' };
  return { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.1)', hoverFill: 'rgba(239, 68, 68, 0.25)' };
};

export default function ExtractPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [extractionMode, setExtractionMode] = useState<"fast" | "advanced">("fast");
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [tableData, setTableData] = useState<Record<string, string[][]>>({});
  
  // PDF Rasterization states
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isRasterizing, setIsRasterizing] = useState(false);
  
  // Overlay specific states
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  
  // Modal state
  const [zoomedRegion, setZoomedRegion] = useState<Detection | null>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);

  const [
    { files, isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      getInputProps,
    },
  ] = useFileUpload({
    accept: "image/*,application/pdf",
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  useEffect(() => {
    const processFile = async () => {
      if (!files.length || !files[0]?.file) {
        setPdfPages([]);
        setTotalPages(1);
        setCurrentPage(1);
        return;
      }
      const fileObj = files[0].file;
      if (fileObj instanceof File && fileObj.type === "application/pdf") {
        setIsRasterizing(true);
        try {
          const arrayBuffer = await fileObj.arrayBuffer();
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
          
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          const numPages = pdf.numPages;
          setTotalPages(numPages);
          
          const pages: string[] = [];
          for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) continue;
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const renderContext: any = {
              canvasContext: context,
              viewport: viewport,
            };
            await page.render(renderContext).promise;
            pages.push(canvas.toDataURL('image/jpeg', 0.9));
          }
          setPdfPages(pages);
          setCurrentPage(1);
        } catch (error) {
          console.error("Error rasterizing PDF:", error);
        } finally {
          setIsRasterizing(false);
        }
      } else {
        setPdfPages(files[0].preview ? [files[0].preview] : []);
        setTotalPages(1);
        setCurrentPage(1);
      }
    };
    processFile();
  }, [files]);

  const handleProcess = () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setHasProcessed(false);
    setProgress(0);
    setSelectedRegion(null);

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
        setActiveTab(1); // Auto-switch to Results tab
      }
    }, 300);
  };

  const handleDetectionClick = (id: string) => {
    setSelectedRegion(id);
    const element = document.getElementById(`region-panel-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleDetectionDoubleClick = (det: Detection) => {
    setZoomedRegion(det);
  };

  const previewUrl = files[0]?.preview || null;
  const displayUrl = pdfPages.length > 0 ? pdfPages[currentPage - 1] : previewUrl;

  const currentPageDetections = useMemo(() => {
    return detections.filter(det => !det.page || det.page === currentPage);
  }, [detections, currentPage]);
  
  const currentPageRegionIds = useMemo(() => {
    return new Set(currentPageDetections.map(det => det.id));
  }, [currentPageDetections]);

  const groupedData = useMemo(() => {
    const groups: Record<string, string[][]> = {};
    for (const [regionId, rows] of Object.entries(tableData)) {
      if (currentPageRegionIds.has(regionId)) {
        groups[regionId] = rows;
      }
    }
    return groups;
  }, [tableData, currentPageRegionIds]);

  const handleExportCSV = async () => {
    if (!hasProcessed || files.length === 0) return;

    const zip = new JSZip();
    const isPdf = files[0].file instanceof File && files[0].file.type === "application/pdf";
    const uploadedFileName = files[0].file instanceof File ? files[0].file.name : files[0].file.name || "document";
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

  useEffect(() => {
    if (zoomedRegion && displayUrl && modalCanvasRef.current) {
      const img = new Image();
      img.src = displayUrl;
      img.onload = () => {
        const canvas = modalCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Exactly inverse the python backend's dynamic logic:
        // if img.width < 1000: scale = 1000 / img.width
        const scaleFactor = (imageSize.width > 0 && imageSize.width < 1000) 
            ? (1000 / imageSize.width) 
            : 1.0;

        const sx = zoomedRegion.bbox[0] / scaleFactor;
        const sy = zoomedRegion.bbox[1] / scaleFactor;
        const sWidth = (zoomedRegion.bbox[2] - zoomedRegion.bbox[0]) / scaleFactor;
        const sHeight = (zoomedRegion.bbox[3] - zoomedRegion.bbox[1]) / scaleFactor;

        const maxWidth = Math.min(800, window.innerWidth - 100);
        const scale = maxWidth / sWidth;
        
        canvas.width = sWidth * scale;
        canvas.height = sHeight * scale;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        
        ctx.drawImage(
          img,
          sx, sy, sWidth, sHeight,
          0, 0, canvas.width, canvas.height 
        );
      };
    }
  }, [zoomedRegion, displayUrl, imageSize]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* Zoom Modal */}
      {zoomedRegion && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setZoomedRegion(null)}
        >
          <div 
            className="relative bg-background border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh] max-w-[95vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <IconZoomIn className="size-5 text-primary" />
                <h3 className="font-medium text-sm">
                  Region Inspector: <span className="font-mono text-primary">{zoomedRegion.id.replace('-', '_')}</span>
                </h3>
              </div>
              <button 
                onClick={() => setZoomedRegion(null)}
                className="p-1 rounded-md hover:bg-muted/50 transition-colors"
              >
                <IconXFilled className="size-5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgfQEhD/oMBExMTE1QNSBAMjP9Ea8BqMFEGjBownINoWDAajWbQ0wAABrQxAwj6190AAAAASUVORK5CYII=')]">
              <canvas 
                ref={modalCanvasRef} 
                className="max-w-full max-h-full object-contain border border-border shadow-lg rounded"
                style={{ cursor: 'zoom-out' }}
                onClick={() => setZoomedRegion(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex-none h-16 border-b border-border flex items-center justify-between px-6 bg-card/30">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Table Extraction</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleProcess}
            disabled={isProcessing || files.length === 0}
            className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[100px]"
          >
            Run
          </Button>
          <Button
            disabled={!hasProcessed}
            variant="outline"
            className="border-border hover:bg-accent hover:text-accent-foreground"
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>
        </div>
      </header>

      {/* Main Content (Split Pane) */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Left Panel (Input/Viewer) */}
        <section className="flex-1 lg:max-w-[40%] xl:max-w-[35%] border-r border-border flex flex-col bg-muted/5 relative">
          <div className="p-4 border-b border-border flex items-center justify-between gap-4 shrink-0">
            <h2 className="text-sm font-medium text-muted-foreground tracking-wider shrink-0">
              Document Viewer
            </h2>
            {files.length > 0 && totalPages > 0 && (
              <div className="scale-90 origin-right">
                <ExtractPaginationBtns 
                  currentPage={currentPage} 
                  totalPages={totalPages} 
                  onPageChange={setCurrentPage} 
                />
              </div>
            )}
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto flex flex-col">
            <div className="flex flex-col gap-2 flex-1">
              <div className="relative flex-1 min-h-[300px] flex flex-col">
                <div
                  className={cn(
                    "relative flex flex-1 w-full h-full flex-col items-center justify-center overflow-hidden rounded-xl transition-colors",
                    isDragging
                      ? "border-primary bg-primary/5 border-2 border-dashed"
                      : files.length === 0 
                        ? "border-border hover:bg-accent/50 border-2 border-dashed"
                        : "border-none bg-muted/20",
                    "has-[input:focus]:border-ring has-[input:focus]:ring-[3px] has-[input:focus]:ring-ring/50"
                  )}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={files.length === 0 ? openFileDialog : undefined}
                  role={files.length === 0 ? "button" : undefined}
                  tabIndex={files.length === 0 ? -1 : undefined}
                >
                  {files.length === 0 && (
                    <input
                      {...getInputProps()}
                      aria-label="Upload file"
                      className="sr-only"
                    />
                  )}

                  {files.length > 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/20 rounded-xl overflow-auto p-2 border border-border/50">
                      {isRasterizing ? (
                        <div className="flex flex-col items-center justify-center text-center p-6 w-full h-full">
                          <IconFileTypePdf className="size-16 opacity-50 mb-4 text-primary animate-pulse" />
                          <p className="font-medium truncate max-w-[250px]">
                            Processing PDF...
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Please wait
                          </p>
                        </div>
                      ) : displayUrl ? (
                        // Strict bounding container handling flawless 1:1 viewbox mapping
                        <div 
                          className="relative inline-flex items-start shadow-md bg-background pointer-events-none"
                          style={{ maxWidth: '100%' }}
                        >
                          <img
                            alt={`Document page ${currentPage}`}
                            className="block w-full h-auto"
                            style={{ margin: 0, padding: 0 }}
                            src={displayUrl}
                            onLoad={(e) => {
                              setImageSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight });
                            }}
                          />
                          {hasProcessed && imageSize.width > 0 && (
                            <svg 
                              viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                              className="absolute inset-0 w-full h-full pointer-events-none"
                              preserveAspectRatio="none"
                              style={{ display: 'block', margin: 0, padding: 0 }}
                            >
                              <g className="pointer-events-auto" onClick={() => setSelectedRegion(null)}>
                                {currentPageDetections.map(det => {
                                  const colors = getColor(det.confidence);
                                  const isHovered = hoveredRegion === det.id;
                                  const isSelected = selectedRegion === det.id;
                                  
                                  // Exactly inverse the python backend's dynamic logic:
                                  // if img.width < 1000: scale = 1000 / img.width
                                  const scaleFactor = (imageSize.width > 0 && imageSize.width < 1000) 
                                      ? (1000 / imageSize.width) 
                                      : 1.0;
                                  
                                  const x = det.bbox[0] / scaleFactor;
                                  const y = det.bbox[1] / scaleFactor;
                                  const w = (det.bbox[2] - det.bbox[0]) / scaleFactor;
                                  const h = (det.bbox[3] - det.bbox[1]) / scaleFactor;
                                  
                                  return (
                                    <g 
                                      key={det.id} 
                                      className="cursor-pointer transition-all"
                                      onMouseEnter={() => setHoveredRegion(det.id)}
                                      onMouseLeave={() => setHoveredRegion(null)}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDetectionClick(det.id);
                                      }}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        handleDetectionDoubleClick(det);
                                      }}
                                    >
                                      <rect
                                        x={x}
                                        y={y}
                                        width={w}
                                        height={h}
                                        fill={isHovered || isSelected ? colors.hoverFill : colors.fill}
                                        stroke={colors.stroke}
                                        strokeWidth={isHovered || isSelected ? 3 : 2}
                                        vectorEffect="non-scaling-stroke"
                                        rx={4}
                                        className="transition-all duration-200"
                                      />
                                      <foreignObject
                                        x={x}
                                        y={y}
                                        width={w}
                                        height="40"
                                        className="overflow-visible pointer-events-none"
                                      >
                                        <div 
                                          className="inline-flex items-center px-2 py-1 rounded-tl-[3px] rounded-br-[3px] font-mono font-bold text-white shadow-sm"
                                          style={{ 
                                            backgroundColor: colors.stroke,
                                            fontSize: `${Math.max(12, imageSize.width * 0.015)}px`,
                                            whiteSpace: 'nowrap'
                                          }}
                                        >
                                          {det.label} {Math.round(det.confidence * 100)}%
                                        </div>
                                      </foreignObject>
                                    </g>
                                  )
                                })}
                              </g>
                            </svg>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center px-4 py-3 text-center pointer-events-none z-10">
                      <div className="mb-4 flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-background shadow-sm">
                        <IconFileUploadFilled className="size-6 text-muted-foreground opacity-70" />
                      </div>
                      <p className="mb-1.5 font-medium text-base">
                        Drop your document here
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Supports PDF and Image formats (Max 5MB)
                      </p>
                    </div>
                  )}
                </div>

                {files.length > 0 && (
                  <div className="absolute top-4 right-4 z-20 flex gap-2">
                    <button
                      aria-label="Change file"
                      className="flex h-8 px-3 text-xs font-medium items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-border text-foreground hover:bg-background transition-colors"
                      onClick={openFileDialog}
                      type="button"
                    >
                      Change
                    </button>
                    <button
                      aria-label="Remove file"
                      className="flex size-8 items-center justify-center rounded-full bg-destructive/90 text-destructive-foreground hover:bg-destructive transition-colors shadow-sm"
                      onClick={() => removeFile(files[0]?.id)}
                      type="button"
                    >
                      <IconLetterXSmall aria-hidden="true" className="size-4" />
                    </button>
                    <input
                      {...getInputProps()}
                      aria-label="Change file"
                      className="sr-only"
                    />
                  </div>
                )}
              </div>

              {errors.length > 0 && (
                <div className="mt-2 text-destructive text-sm font-medium bg-destructive/10 p-3 rounded-md border border-destructive/20">
                  {errors[0]}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Panel (Results/Editor) */}
        <section className="flex-[1.5] flex flex-col bg-card relative overflow-hidden">
          <ExtractTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            configContent={
              <div className="h-full flex flex-col items-center justify-center">
                <ExtractConfigRadioBtns 
                  mode={extractionMode} 
                  onChange={setExtractionMode} 
                />
              </div>
            }
            resultsContent={
              <>
                {!isProcessing && !hasProcessed ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl bg-muted/5 min-h-[400px]">
                    <IconTextRecognition className="size-12 mb-4 opacity-20" />
                    <p className="font-medium">No Data Extracted Yet</p>
                    <p className="text-sm mt-1 opacity-70">
                      Upload a document and click "Run" to begin.
                    </p>
                  </div>
                ) : isProcessing ? (
                  <div className="h-full flex flex-col items-center justify-center p-10">
                    <div className="w-full max-w-md space-y-4">
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-foreground animate-pulse">
                          Analyzing Document Structure ({extractionMode} mode)...
                        </span>
                        <span className="text-primary font-mono">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  </div>
                ) : (
                  Object.keys(groupedData).length === 0 ? (
                    <div className="h-full min-h-[400px] flex items-center justify-center">
                      <Empty className="w-full max-w-md mx-auto flex flex-col items-center justify-center text-center gap-2">
                        <EmptyMedia variant="icon">
                          <IconMoodPuzzled />
                        </EmptyMedia>
                        <EmptyTitle>No Tables Extracted</EmptyTitle>
                        <EmptyDescription>
                          We couldn't detect any tables in this document.
                        </EmptyDescription>
                      </Empty>
                    </div>
                  ) : (
                    <div className="space-y-6 max-w-full pb-10">
                      {Object.entries(groupedData).map(([regionId, rows]) => {
                        const isSelected = selectedRegion === regionId;
                        const isHovered = hoveredRegion === regionId;
                        const maxColumns = rows.reduce((max, r) => Math.max(max, r.length), 0);
                        
                        return (
                          <div 
                            key={regionId} 
                            id={`region-panel-${regionId}`}
                            className={cn(
                              "border rounded-xl bg-background overflow-hidden transition-all duration-300 scroll-mt-6",
                              isSelected ? "border-primary ring-1 ring-primary shadow-md" : 
                              isHovered ? "border-primary/50 shadow-sm" : "border-border shadow-sm"
                            )}
                            onMouseEnter={() => setHoveredRegion(regionId)}
                            onMouseLeave={() => setHoveredRegion(null)}
                            onClick={() => setSelectedRegion(regionId)}
                          >
                            <div className={cn(
                              "px-4 py-3 border-b flex justify-between items-center transition-colors cursor-pointer", 
                              isSelected ? "bg-primary/10 border-primary/20" : 
                              isHovered ? "bg-muted/50 border-border" : "bg-muted/30 border-border"
                            )}>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-medium tracking-wider">
                                  {regionId.replace('-', '_')}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {rows.length} rows detected
                              </span>
                            </div>
                            <div className="p-0 overflow-auto">
                              <Table>
                                <TableHeader className={cn(isSelected ? "bg-primary/5" : "bg-muted/20")}>
                                  <TableRow className="hover:bg-transparent">
                                    {Array.from({ length: maxColumns }).map((_, idx) => (
                                      <TableHead key={idx} className="border-r border-border font-mono text-xs">
                                        Col {idx}
                                      </TableHead>
                                    ))}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {rows.map((row, rIdx) => (
                                    <TableRow key={rIdx} className="group">
                                      {row.map((cell, cIdx) => (
                                        <TableCell key={cIdx} className="p-0 border-r border-border">
                                          <input
                                            className="w-full bg-transparent px-4 py-3 outline-none focus:bg-accent/50 focus:ring-1 focus:ring-inset focus:ring-primary transition-all text-sm"
                                            value={cell}
                                            onChange={(e) => {
                                              setTableData(prev => {
                                                const newData = { ...prev };
                                                const newRows = [...newData[regionId]];
                                                const newRow = [...newRows[rIdx]];
                                                newRow[cIdx] = e.target.value;
                                                newRows[rIdx] = newRow;
                                                newData[regionId] = newRows;
                                                return newData;
                                              });
                                            }}
                                          />
                                        </TableCell>
                                      ))}
                                      {Array.from({ length: maxColumns - row.length }).map((_, emptyIdx) => (
                                        <TableCell key={`empty-${emptyIdx}`} className="p-0 border-r border-border"></TableCell>
                                      ))}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </>
            }
          />
        </section>
      </main>

      {/* Footer (Metrics) */}
      <footer className="flex-none h-10 border-t border-border bg-card/40 flex items-center px-4 gap-4 text-[11px] text-muted-foreground font-mono">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full size-2 bg-green-500"></span>
          </span>
          <span className="text-foreground/80 font-medium tracking-wide">
            SYSTEM ONLINE
          </span>
        </div>
        <div className="w-px h-3 bg-border"></div>
        <div className="flex gap-2">
          <span className="opacity-70">Latency:</span>
          <span className="text-foreground">
            {hasProcessed ? "142ms" : isProcessing ? "---" : "Idle"}
          </span>
        </div>
        <div className="w-px h-3 bg-border"></div>
        <div className="flex gap-2">
          <span className="opacity-70">Success Rate:</span>
          <span className="text-foreground">99.8%</span>
        </div>
        <div className="w-px h-3 bg-border"></div>
        <div className="flex gap-2 ml-auto">
          <span className="opacity-70">CPU:</span>
          <span className="text-foreground min-w-[30px]">
            {isProcessing ? "68%" : "12%"}
          </span>
          <span className="opacity-70 ml-2">GPU:</span>
          <span className="text-foreground min-w-[30px]">
            {isProcessing ? "42%" : "4%"}
          </span>
        </div>
      </footer>
    </div>
  );
}