import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

interface ExtractHeaderProps {
  onRun: () => void;
  onExport: () => void;
  isProcessing: boolean;
  hasProcessed: boolean;
  hasFiles: boolean;
}

export default function ExtractHeader({
  onRun,
  onExport,
  isProcessing,
  hasProcessed,
  hasFiles
}: ExtractHeaderProps) {
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
        <Button
          disabled={!hasProcessed}
          variant="outline"
          className="border-border hover:bg-accent hover:text-accent-foreground"
          onClick={onExport}
        >
          Export CSV
        </Button>
      </div>
    </header>
  );
}