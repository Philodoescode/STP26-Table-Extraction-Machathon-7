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
import { cn } from "@/lib/utils";
import { IconTextRecognition, IconLetterXSmall, IconFileUploadFilled, IconZoomIn, IconXFilled, IconFileTypePdf } from '@tabler/icons-react';

export interface Detection {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
  type: 'table' | 'cell' | 'header';
  page?: number;
}

const mockDetections: Detection[] = [
  { id: "region-1", x: 0.05, y: 0.15, width: 0.9, height: 0.35, label: "Table", confidence: 0.96, type: 'table', page: 1 },
  { id: "region-2", x: 0.05, y: 0.55, width: 0.9, height: 0.40, label: "Table", confidence: 0.82, type: 'table', page: 2 },
];

const initialTableData = [
  { id: "1", name: "John Doe", amount: "1200.00", status: "Paid", regionId: "region-1" },
  { id: "2", name: "Jane Smith", amount: "850.50", status: "Pending", regionId: "region-1" },
  { id: "3", name: "Bob Johnson", amount: "2100.00", status: "Paid", regionId: "region-2" },
  { id: "4", name: "Alice Williams", amount: "450.00", status: "Overdue", regionId: "region-2" },
];

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
  const [tableData, setTableData] = useState(initialTableData);
  
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

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsProcessing(false);
          setHasProcessed(true);
          setActiveTab(1); // Auto-switch to Results tab
          return 100;
        }
        return prev + 10;
      });
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

  // Filter detections and table data for current page
  const currentPageDetections = useMemo(() => {
    return mockDetections.filter(det => !det.page || det.page === currentPage);
  }, [currentPage]);
  
  const currentPageRegionIds = useMemo(() => {
    return new Set(currentPageDetections.map(det => det.id));
  }, [currentPageDetections]);

  const groupedData = useMemo(() => {
    const groups: Record<string, typeof tableData> = {};
    tableData.forEach(row => {
      // Only include rows for regions on the current page
      if (currentPageRegionIds.has(row.regionId)) {
        if (!groups[row.regionId]) groups[row.regionId] = [];
        groups[row.regionId].push(row);
      }
    });
    return groups;
  }, [tableData, currentPageRegionIds]);

  const handleExportCSV = async () => {
    if (!hasProcessed || files.length === 0) return;

    const zip = new JSZip();
    const isPdf = files[0].file instanceof File && files[0].file.type === "application/pdf";
    const uploadedFileName = files[0].file instanceof File ? files[0].file.name : files[0].file.name || "document";
    const baseName = uploadedFileName.includes('.') ? uploadedFileName.substring(0, uploadedFileName.lastIndexOf('.')) : uploadedFileName;

    // Group all data across all pages
    const allGroups: Record<string, typeof tableData> = {};
    tableData.forEach(row => {
      if (!allGroups[row.regionId]) allGroups[row.regionId] = [];
      allGroups[row.regionId].push(row);
    });

    const regionPageMap = new Map<string, number>();
    mockDetections.forEach(det => {
      if (det.page) regionPageMap.set(det.id, det.page);
    });

    let tableNo = 1;
    for (const [regionId, rows] of Object.entries(allGroups)) {
      const header = "ID,Name,Amount,Status\n";
      const csvRows = rows.map(row => {
        const escapeCell = (val: string) => {
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        };
        return `${escapeCell(row.id)},${escapeCell(row.name)},${escapeCell(row.amount)},${escapeCell(row.status)}`;
      });
      const csvContent = header + csvRows.join("\n");
      
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

  // Effect to draw cropped image on canvas when modal opens
  useEffect(() => {
    if (zoomedRegion && previewUrl && modalCanvasRef.current) {
      const img = new Image();
      img.src = previewUrl;
      img.onload = () => {
        const canvas = modalCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calculate source rectangle
        const sx = zoomedRegion.x * img.naturalWidth;
        const sy = zoomedRegion.y * img.naturalHeight;
        const sWidth = zoomedRegion.width * img.naturalWidth;
        const sHeight = zoomedRegion.height * img.naturalHeight;

        // Set canvas size to match the cropped region's aspect ratio
        // Max width is 800px or window width - 100
        const maxWidth = Math.min(800, window.innerWidth - 100);
        const scale = maxWidth / sWidth;
        
        canvas.width = sWidth * scale;
        canvas.height = sHeight * scale;

        // Clear and draw
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Disable smoothing for crisp text when scaled
        ctx.imageSmoothingEnabled = false;
        
        ctx.drawImage(
          img,
          sx, sy, sWidth, sHeight, // Source coordinates
          0, 0, canvas.width, canvas.height // Destination coordinates
        );
      };
    }
  }, [zoomedRegion, previewUrl]);

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
        <section className="flex-1 lg:max-w-[40%] xl:max-w-[35%] border-r border-border flex flex-col bg-muted/5">
          <div className="p-4 border-b border-border flex items-center justify-between gap-4">
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
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/20 rounded-xl overflow-hidden p-2">
                      {isRasterizing ? (
                        <div className="flex flex-col items-center justify-center text-center p-6">
                          <IconFileTypePdf className="size-16 opacity-50 mb-4 text-primary animate-pulse" />
                          <p className="font-medium truncate max-w-[250px]">
                            Processing PDF...
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Please wait
                          </p>
                        </div>
                      ) : displayUrl ? (
                        <div 
                          className="relative w-full h-full shadow-sm bg-background/50 border border-border/50 rounded overflow-y-auto overflow-x-hidden flex flex-col"
                        >
                          <div className="relative w-full h-auto flex-1">
                            <img
                              alt={`Document page ${currentPage}`}
                              className="w-full h-auto pointer-events-none select-none block"
                              src={displayUrl}
                              onLoad={(e) => {
                                setImageSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight });
                              }}
                            />
                            {hasProcessed && imageSize.width > 0 && (
                              <svg 
                                className="absolute inset-0 w-full h-full z-10"
                                onClick={() => setSelectedRegion(null)}
                              >
                              {currentPageDetections.map(det => {
                                const colors = getColor(det.confidence);
                                const isHovered = hoveredRegion === det.id;
                                const isSelected = selectedRegion === det.id;
                                
                                return (
                                  <g 
                                    key={det.id} 
                                    className="pointer-events-auto cursor-pointer transition-all"
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
                                      x={`${det.x * 100}%`}
                                      y={`${det.y * 100}%`}
                                      width={`${det.width * 100}%`}
                                      height={`${det.height * 100}%`}
                                      fill={isHovered || isSelected ? colors.hoverFill : colors.fill}
                                      stroke={colors.stroke}
                                      strokeWidth={isHovered || isSelected ? 3 : 2}
                                      rx={4}
                                      className="transition-all duration-200"
                                    />
                                    <foreignObject
                                      x={`${det.x * 100}%`}
                                      y={`${det.y * 100}%`}
                                      width="120"
                                      height="24"
                                      className="overflow-visible pointer-events-none"
                                    >
                                      <div 
                                        className="inline-flex items-center px-1.5 py-0.5 rounded-tl-[3px] rounded-br-[3px] text-[10px] font-mono font-bold text-white shadow-sm"
                                        style={{ backgroundColor: colors.stroke }}
                                      >
                                        {det.label} {Math.round(det.confidence * 100)}%
                                      </div>
                                    </foreignObject>
                                  </g>
                                )
                              })}
                            </svg>
                            )}
                          </div>
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
                  <div className="space-y-6 max-w-full pb-10">
                    {Object.entries(groupedData).map(([regionId, rows]) => {
                      const isSelected = selectedRegion === regionId;
                      const isHovered = hoveredRegion === regionId;
                      
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
                                  <TableHead className="w-[100px] border-r border-border font-mono text-xs">ID</TableHead>
                                  <TableHead className="border-r border-border font-mono text-xs">Name</TableHead>
                                  <TableHead className="border-r border-border font-mono text-xs">Amount</TableHead>
                                  <TableHead className="font-mono text-xs">Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {rows.map((row) => (
                                  <TableRow key={row.id} className="group">
                                    <TableCell className="p-0 border-r border-border">
                                      <input
                                        className="w-full bg-transparent px-4 py-3 outline-none focus:bg-accent/50 focus:ring-1 focus:ring-inset focus:ring-primary transition-all text-sm"
                                        value={row.id}
                                        onChange={(e) => {
                                          setTableData(prev => prev.map(r => r.id === row.id ? { ...r, id: e.target.value } : r));
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell className="p-0 border-r border-border">
                                      <input
                                        className="w-full bg-transparent px-4 py-3 outline-none focus:bg-accent/50 focus:ring-1 focus:ring-inset focus:ring-primary transition-all text-sm"
                                        value={row.name}
                                        onChange={(e) => {
                                          setTableData(prev => prev.map(r => r.id === row.id ? { ...r, name: e.target.value } : r));
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell className="p-0 border-r border-border">
                                      <input
                                        className="w-full bg-transparent px-4 py-3 outline-none focus:bg-accent/50 focus:ring-1 focus:ring-inset focus:ring-primary transition-all text-sm"
                                        value={row.amount}
                                        onChange={(e) => {
                                          setTableData(prev => prev.map(r => r.id === row.id ? { ...r, amount: e.target.value } : r));
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell className="p-0">
                                      <input
                                        className="w-full bg-transparent px-4 py-3 outline-none focus:bg-accent/50 focus:ring-1 focus:ring-inset focus:ring-primary transition-all text-sm"
                                        value={row.status}
                                        onChange={(e) => {
                                          setTableData(prev => prev.map(r => r.id === row.id ? { ...r, status: e.target.value } : r));
                                        }}
                                      />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
