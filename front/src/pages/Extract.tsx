"use client";

import { useState } from "react";
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
import { FileIcon, CheckCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconTextRecognition } from '@tabler/icons-react';
import { IconLetterXSmall } from '@tabler/icons-react';
import { IconFileUploadFilled  } from '@tabler/icons-react';

// Mock data
const mockData = [
  { id: "1", name: "John Doe", amount: "1200.00", status: "Paid" },
  { id: "2", name: "Jane Smith", amount: "850.50", status: "Pending" },
  { id: "3", name: "Bob Johnson", amount: "2100.00", status: "Paid" },
  { id: "4", name: "Alice Williams", amount: "450.00", status: "Overdue" },
];

export default function ExtractPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tableData, setTableData] = useState(mockData);

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

  const previewUrl = files[0]?.preview || null;
  const isPdf = files[0]?.file?.type === "application/pdf";

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
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
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Input / Viewer
            </h2>
          </div>
          <div className="p-6 flex-1 overflow-y-auto flex flex-col">
            <div className="flex flex-col gap-2 flex-1">
              <div className="relative flex-1 min-h-[300px]">
                <div
                  className={cn(
                    "relative flex h-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors",
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/50",
                    "has-[input:focus]:border-ring has-[input:focus]:ring-[3px] has-[input:focus]:ring-ring/50",
                    files.length > 0 && "border-none bg-black/5"
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
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/20 rounded-xl overflow-hidden">
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
                        <img
                          alt="Uploaded document"
                          className="w-full h-full object-contain bg-black/10"
                          src={previewUrl}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center px-4 py-3 text-center pointer-events-none">
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
                  <div className="absolute top-4 right-4 z-10 flex gap-2">
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
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Results
            </h2>
            {hasProcessed && (
              <span className="text-xs text-primary font-mono bg-primary/10 px-2 py-1 rounded">
                EDIT MODE
              </span>
            )}
          </div>
          <div className="p-6 flex-1 overflow-y-auto">
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
              <div className="space-y-6 max-w-full">
                <div className="border border-border rounded-xl bg-background overflow-hidden shadow-sm">
                  <div className="bg-muted/30 px-4 py-3 border-b border-border flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="size-4 text-green-500" />
                      <span className="text-xs font-mono font-medium tracking-wider">
                        TABLE_REGION_1
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      4 rows detected
                    </span>
                  </div>
                  <div className="p-0 overflow-auto">
                    <Table>
                      <TableHeader className="bg-muted/20">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[100px] border-r border-border font-mono text-xs">
                            ID
                          </TableHead>
                          <TableHead className="border-r border-border font-mono text-xs">
                            Name
                          </TableHead>
                          <TableHead className="border-r border-border font-mono text-xs">
                            Amount
                          </TableHead>
                          <TableHead className="font-mono text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tableData.map((row, rowIndex) => (
                          <TableRow key={rowIndex} className="group">
                            <TableCell className="p-0 border-r border-border">
                              <input
                                className="w-full bg-transparent px-4 py-3 outline-none focus:bg-accent/50 focus:ring-1 focus:ring-inset focus:ring-primary transition-all text-sm"
                                value={row.id}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[rowIndex].id = e.target.value;
                                  setTableData(newData);
                                }}
                              />
                            </TableCell>
                            <TableCell className="p-0 border-r border-border">
                              <input
                                className="w-full bg-transparent px-4 py-3 outline-none focus:bg-accent/50 focus:ring-1 focus:ring-inset focus:ring-primary transition-all text-sm"
                                value={row.name}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[rowIndex].name = e.target.value;
                                  setTableData(newData);
                                }}
                              />
                            </TableCell>
                            <TableCell className="p-0 border-r border-border">
                              <input
                                className="w-full bg-transparent px-4 py-3 outline-none focus:bg-accent/50 focus:ring-1 focus:ring-inset focus:ring-primary transition-all text-sm"
                                value={row.amount}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[rowIndex].amount = e.target.value;
                                  setTableData(newData);
                                }}
                              />
                            </TableCell>
                            <TableCell className="p-0">
                              <input
                                className="w-full bg-transparent px-4 py-3 outline-none focus:bg-accent/50 focus:ring-1 focus:ring-inset focus:ring-primary transition-all text-sm"
                                value={row.status}
                                onChange={(e) => {
                                  const newData = [...tableData];
                                  newData[rowIndex].status = e.target.value;
                                  setTableData(newData);
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
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
