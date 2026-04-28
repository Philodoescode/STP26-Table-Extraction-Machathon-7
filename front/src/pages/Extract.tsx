"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import JSZip from "jszip";
import { useFileUpload } from "@/hooks/use-file-upload";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconTextRecognition, IconLetterXSmall, IconFileUploadFilled, IconZoomIn, IconX } from '@tabler/icons-react';

export interface Detection {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
  type: 'table' | 'cell' | 'header';
}

const mockDetections: Detection[] = [
  { id: "region-1", x: 0.05, y: 0.15, width: 0.9, height: 0.35, label: "Table", confidence: 0.96, type: 'table' },
  { id: "region-2", x: 0.05, y: 0.55, width: 0.9, height: 0.40, label: "Table", confidence: 0.82, type: 'table' },
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tableData, setTableData] = useState(initialTableData);
  
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
  const isPdf = files[0]?.file?.type === "application/pdf";

  const groupedData = useMemo(() => {
    const groups: Record<string, typeof tableData> = {};
    tableData.forEach(row => {
      if (!groups[row.regionId]) groups[row.regionId] = [];
      groups[row.regionId].push(row);
    });
    return groups;
  }, [tableData]);

  const handleExportCSV = async () => {
    if (!hasProcessed || files.length === 0) return;

    const zip = new JSZip();
    const uploadedFileName = files[0].file instanceof File ? files[0].file.name : files[0].file.name || "document";
    const baseName = uploadedFileName.includes('.') ? uploadedFileName.substring(0, uploadedFileName.lastIndexOf('.')) : uploadedFileName;

    let tableNo = 1;
    for (const [, rows] of Object.entries(groupedData)) {
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
      
      zip.file(`${baseName}_table_${tableNo}.csv`, csvContent);
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
                  Region Inspector: <span className="font-mono text-primary">{zoomedRegion.id.toUpperCase().replace('-', '_')}</span>
                </h3>
              </div>
              <button 
                onClick={() => setZoomedRegion(null)}
                className="p-1 rounded-md hover:bg-muted/50 transition-colors"
              >
                <IconX className="size-5 text-muted-foreground hover:text-foreground" />
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
            {isProcessing ? `Running... ${progress}%` : "Run"}
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
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium text-muted-foreground tracking-wider">
              Document Viewer
            </h2>
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
                      {isPdf ? (
                        <div className="flex flex-col items-center justify-center text-center p-6">
                          <FileIcon className="size-16 opacity-50 mb-4 text-primary" />
                          <p className="font-medium truncate max-w-[250px]">
                            {files[0].file instanceof File
                              ? files[0].file.name
                              : files[0].file.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            PDF Document Selected
                          </p>
                        </div>
                      ) : previewUrl ? (
                        <div 
                          className="relative flex items-center justify-center shadow-sm bg-background/50 border border-border/50 rounded overflow-hidden"
                          style={{ 
                            width: imageSize.width ? '100%' : 'auto', 
                            height: imageSize.height ? '100%' : 'auto',
                            aspectRatio: imageSize.width && imageSize.height ? `${imageSize.width}/${imageSize.height}` : undefined,
                            maxHeight: '100%',
                            maxWidth: '100%'
                          }}
                        >
                          <img
                            alt="Uploaded document"
                            className="w-full h-full object-contain pointer-events-none select-none"
                            src={previewUrl}
                            onLoad={(e) => {
                              setImageSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight });
                            }}
                          />
                          {hasProcessed && imageSize.width > 0 && (
                            <svg 
                              className="absolute inset-0 w-full h-full z-10"
                              onClick={() => setSelectedRegion(null)}
                            >
                              {mockDetections.map(det => {
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
        <section className="flex-[1.5] flex flex-col bg-card relative">
          <div className="p-4 border-b border-border bg-muted/5 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground tracking-wider">
              Results
            </h2>
            {hasProcessed}
          </div>
          <div className="p-6 flex-1 overflow-y-auto scroll-smooth">
            {!isProcessing && !hasProcessed ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl bg-muted/5">
                <IconTextRecognition className="size-12 mb-4 opacity-20" />
                <p className="font-medium">No Data Extracted Yet</p>
                <p className="text-sm mt-1 opacity-70">
                  Upload a document and click "Run" to begin.
                </p>
              </div>
            ) : isProcessing ? (
              <div className="space-y-8 max-w-4xl mx-auto w-full">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-foreground animate-pulse">
                      Analyzing Document Structure...
                    </span>
                    <span className="text-primary font-mono">{progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted overflow-hidden rounded-full border border-border/50">
                    <div
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="border border-border rounded-xl bg-background/50 p-6 space-y-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-24" />
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
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
                            {regionId.toUpperCase().replace('-', '_')}
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
          </div>
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
