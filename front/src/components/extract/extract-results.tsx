import { cn } from "@/lib/utils";
import { IconTextRecognition, IconMoodPuzzled } from '@tabler/icons-react';
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

interface ExtractResultsProps {
  isProcessing: boolean;
  hasProcessed: boolean;
  progress: number;
  extractionMode: string;
  groupedData: Record<string, string[][]>;
  setTableData: React.Dispatch<React.SetStateAction<Record<string, string[][]>>>;
  selectedRegion: string | null;
  setSelectedRegion: (id: string | null) => void;
  hoveredRegion: string | null;
  setHoveredRegion: (id: string | null) => void;
}

export default function ExtractResults({
  isProcessing,
  hasProcessed,
  progress,
  extractionMode,
  groupedData,
  setTableData,
  selectedRegion,
  setSelectedRegion,
  hoveredRegion,
  setHoveredRegion
}: ExtractResultsProps) {
  if (!isProcessing && !hasProcessed) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl bg-muted/5 min-h-[400px]">
        <IconTextRecognition className="size-12 mb-4 opacity-20" />
        <p className="font-medium">No Data Extracted Yet</p>
        <p className="text-sm mt-1 opacity-70">
          Upload a document and click "Run" to begin.
        </p>
      </div>
    );
  }

  if (isProcessing) {
    return (
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
    );
  }

  if (Object.keys(groupedData).length === 0) {
    return (
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
    );
  }

  return (
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
  );
}