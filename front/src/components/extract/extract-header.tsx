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
  onRun: () => void;
  onExport: () => void;
  exportFormat: ExportFormat;
  onExportFormatChange: (format: ExportFormat) => void;
  isProcessing: boolean;
  hasProcessed: boolean;
  hasFiles: boolean;
}

export default function ExtractHeader({
  onRun,
  onExport,
  exportFormat,
  onExportFormatChange,
  isProcessing,
  hasProcessed,
  hasFiles
}: ExtractHeaderProps) {
  const formats: ExportFormat[] = ["csv", "xlsx"];

  return (
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
          onClick={onRun}
          disabled={isProcessing || !hasFiles}
          className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[100px]"
        >
          Run
        </Button>
        <div className="flex items-center rounded-md border border-input bg-background p-0.5">
          {formats.map((format) => (
            <button
              key={format}
              type="button"
              disabled={!hasProcessed}
              aria-pressed={exportFormat === format}
              onClick={() => onExportFormatChange(format)}
              className={cn(
                "rounded-sm px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition-colors",
                exportFormat === format
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {format}
            </button>
          ))}
        </div>
        <Button
          disabled={!hasProcessed}
          variant="outline"
          className="border-border hover:bg-accent hover:text-accent-foreground"
          onClick={onExport}
        >
          Export {exportFormat.toUpperCase()}
        </Button>
      </div>
    </header>
  );
}
