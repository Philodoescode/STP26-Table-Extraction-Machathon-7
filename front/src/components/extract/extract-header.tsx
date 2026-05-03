import { useEffect, useRef, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExportFormat } from "@/lib/api";

interface ExtractHeaderProps {
  onRun?: () => void;
  onExport?: (format: ExportFormat) => void;
  isProcessing?: boolean;
  hasProcessed?: boolean;
  hasFiles?: boolean;
  pageName?: string;
}

export default function ExtractHeader({
  onRun,
  onExport,
  isProcessing = false,
  hasProcessed = false,
  hasFiles = false,
  pageName = "Table Extraction"
}: ExtractHeaderProps) {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const formats: ExportFormat[] = ["csv", "xlsx"];

  useEffect(() => {
    if (!isExportMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExportMenuOpen]);

  const showActions = onRun && onExport;

  return (
    <header className="flex-none h-16 border-b border-border flex items-center justify-between px-6 bg-card/30">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {pageName === "Table Extraction" ? (
              <BreadcrumbPage className="max-w-[150px] sm:max-w-none truncate">{pageName}</BreadcrumbPage>
            ) : (
              <>
                <BreadcrumbLink href="/extract">Table Extraction</BreadcrumbLink>
                <BreadcrumbSeparator />
                <BreadcrumbPage className="max-w-[150px] sm:max-w-none truncate">{pageName}</BreadcrumbPage>
              </>
            )}
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {showActions && (
        <div className="flex items-center gap-3">
          <Button
            id="tour-run-button"
            onClick={onRun}
            disabled={isProcessing || !hasFiles}
            className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[100px]"
          >
            Run
          </Button>
          <div className="relative" ref={exportMenuRef}>
            <Button
              id="tour-export-button"
              disabled={!hasProcessed}
              variant="outline"
              className="border-border hover:bg-accent hover:text-accent-foreground"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
            >
              Export
            </Button>
            <div
              className={cn(
                "absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-[150px] rounded-md border border-border bg-popover p-1 shadow-md transition-all",
                isExportMenuOpen
                  ? "pointer-events-auto opacity-100 translate-y-0"
                  : "pointer-events-none opacity-0 -translate-y-1"
              )}
            >
              {formats.map((format) => (
                <button
                  key={format}
                  type="button"
                  disabled={!hasProcessed}
                  onClick={() => {
                    onExport?.(format);
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full rounded-sm px-3 py-2 text-left text-sm uppercase tracking-wide text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Export {format}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
