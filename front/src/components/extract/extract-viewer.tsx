import { cn } from "@/lib/utils";
import { IconLetterXSmall, IconFileUploadFilled, IconFileTypePdf } from '@tabler/icons-react';
import ExtractPaginationBtns from "@/components/extract-pagination-btns";
import { type Detection, getColor } from "@/lib/extract-utils";

interface ExtractViewerProps {
  // ... (keep your existing props)
  files: any[];
  isDragging: boolean;
  errors: string[];
  handleDragEnter: (e: any) => void;
  handleDragLeave: (e: any) => void;
  handleDragOver: (e: any) => void;
  handleDrop: (e: any) => void;
  openFileDialog: () => void;
  removeFile: (id: string) => void;
  getInputProps: () => any;
  
  currentPage: number;
  totalPages: number;
  isRasterizing: boolean;
  displayUrl: string | null;
  onPageChange: (page: number) => void;
  hasProcessed: boolean;
  
  imageSize: { width: number, height: number };
  setImageSize: (size: { width: number, height: number }) => void;
  
  currentPageDetections: Detection[];
  hoveredRegion: string | null;
  selectedRegion: string | null;
  setHoveredRegion: (id: string | null) => void;
  setSelectedRegion: (id: string | null) => void;
  
  onDetectionClick: (id: string) => void;
  onDetectionDoubleClick: (det: Detection) => void;

  mapRatio: number; // ADDED THIS
}

export default function ExtractViewer({
  files,
  isDragging,
  errors,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleDrop,
  openFileDialog,
  removeFile,
  getInputProps,
  
  currentPage,
  totalPages,
  isRasterizing,
  displayUrl,
  onPageChange,
  hasProcessed,
  
  imageSize,
  setImageSize,
  
  currentPageDetections,
  hoveredRegion,
  selectedRegion,
  setHoveredRegion,
  setSelectedRegion,
  
  onDetectionClick,
  onDetectionDoubleClick,
  mapRatio // DESTRUCTURED HERE
}: ExtractViewerProps) {
  return (
    <>
      <div className="p-4 border-b border-border flex items-center justify-between gap-4 shrink-0">
        <h2 className="text-sm font-medium text-muted-foreground tracking-wider shrink-0">
          Document Viewer
        </h2>
        {files.length > 0 && totalPages > 0 && (
          <div className="scale-90 origin-right">
            <ExtractPaginationBtns 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={onPageChange} 
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
                              
                              // --- APPLY THE EXACT MATH RATIO HERE ---
                              const x = det.bbox[0] * mapRatio;
                              const y = det.bbox[1] * mapRatio;
                              const w = (det.bbox[2] - det.bbox[0]) * mapRatio;
                              const h = (det.bbox[3] - det.bbox[1]) * mapRatio;
                              // Detect coordinate format:
                              // - New format: all values are 0–1 (relative)
                              // - Old format: values are absolute pixels (legacy DB rows)
                              const isRelative = det.bbox.every(v => v >= 0 && v <= 1.0);

                              let x: number, y: number, w: number, h: number;
                              if (isRelative) {
                                // New format: multiply relative coords by display dimensions
                                x = det.bbox[0] * imageSize.width;
                                y = det.bbox[1] * imageSize.height;
                                w = (det.bbox[2] - det.bbox[0]) * imageSize.width;
                                h = (det.bbox[3] - det.bbox[1]) * imageSize.height;
                              } else {
                                // Legacy format: absolute pixel coords in backend image space
                                // Render directly in the viewBox (which matches naturalWidth/naturalHeight)
                                x = det.bbox[0];
                                y = det.bbox[1];
                                w = det.bbox[2] - det.bbox[0];
                                h = det.bbox[3] - det.bbox[1];
                              }

                              return (
                                <g 
                                  key={det.id} 
                                  className="cursor-pointer transition-all"
                                  onMouseEnter={() => setHoveredRegion(det.id)}
                                  onMouseLeave={() => setHoveredRegion(null)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDetectionClick(det.id);
                                  }}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    onDetectionDoubleClick(det);
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
    </>
  );
}