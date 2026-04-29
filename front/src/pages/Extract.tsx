"use client";

import { useState, useMemo, useEffect } from "react";
import { useFileUpload } from "@/hooks/use-file-upload";
import { usePdfRasterizer } from "@/hooks/use-pdf-rasterizer";
import { useExtractProcessor } from "@/hooks/use-extract-processor";
import { handleExportCSV, type Detection } from "@/lib/extract-utils";

import ExtractHeader from "@/components/extract/extract-header";
import ExtractViewer from "@/components/extract/extract-viewer";
import ExtractResults from "@/components/extract/extract-results";
import ExtractZoomModal from "@/components/extract/extract-zoom-modal";
import ExtractFooter from "@/components/extract/extract-footer";
import ExtractTabs from "@/components/extract-tabs";
import ExtractConfigRadioBtns from "@/components/extract-config-radio-btns";

export default function ExtractPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [extractionMode, setExtractionMode] = useState<"fast" | "accurate">("fast");
  
  // Overlay specific states
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [zoomedRegion, setZoomedRegion] = useState<Detection | null>(null);

  // File Upload Hook
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

  // Extraction Logic Hooks
  const {
    pdfPages,
    currentPage,
    setCurrentPage,
    totalPages,
    isRasterizing
  } = usePdfRasterizer(files);

  const {
    isProcessing,
    hasProcessed,
    progress,
    detections,
    tableData,
    setTableData,
    processFiles,
    updateCellOverride,
    jobId
  } = useExtractProcessor(files, () => setActiveTab(1));

  // Derived state
  const previewUrl = files[0]?.preview || null;
  const displayUrl = pdfPages.length > 0 ? pdfPages[currentPage - 1] : previewUrl;

  useEffect(() => {
    // Reset document state on change or removal
    setHoveredRegion(null);
    setSelectedRegion(null);
    setZoomedRegion(null);
    setImageSize({ width: 0, height: 0 });
    setActiveTab(0);
  }, [files]);

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

  const handleDetectionClick = (id: string) => {
    setSelectedRegion(id);
    const element = document.getElementById(`region-panel-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {zoomedRegion && (
        <ExtractZoomModal 
          zoomedRegion={zoomedRegion}
          onClose={() => setZoomedRegion(null)}
        />
      )}

      <ExtractHeader 
        onRun={() => {
          setSelectedRegion(null);
          processFiles();
        }}
        onExport={() => handleExportCSV(jobId, hasProcessed, files)}
        isProcessing={isProcessing}
        hasProcessed={hasProcessed}
        hasFiles={files.length > 0}
      />

      <main className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <section className="flex-1 lg:max-w-[40%] xl:max-w-[35%] border-r border-border flex flex-col bg-muted/5 relative">
          <ExtractViewer 
            files={files}
            isDragging={isDragging}
            errors={errors}
            handleDragEnter={handleDragEnter}
            handleDragLeave={handleDragLeave}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            openFileDialog={openFileDialog}
            removeFile={removeFile}
            getInputProps={getInputProps}
            
            currentPage={currentPage}
            totalPages={totalPages}
            isRasterizing={isRasterizing}
            displayUrl={displayUrl}
            onPageChange={setCurrentPage}
            hasProcessed={hasProcessed}
            
            imageSize={imageSize}
            setImageSize={setImageSize}
            
            currentPageDetections={currentPageDetections}
            hoveredRegion={hoveredRegion}
            selectedRegion={selectedRegion}
            setHoveredRegion={setHoveredRegion}
            setSelectedRegion={setSelectedRegion}
            
            onDetectionClick={handleDetectionClick}
            onDetectionDoubleClick={setZoomedRegion}
          />
        </section>

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
              <ExtractResults 
                isProcessing={isProcessing}
                hasProcessed={hasProcessed}
                progress={progress}
                extractionMode={extractionMode}
                groupedData={groupedData}
                setTableData={setTableData}
                selectedRegion={selectedRegion}
                setSelectedRegion={setSelectedRegion}
                hoveredRegion={hoveredRegion}
                setHoveredRegion={setHoveredRegion}
                currentPageDetections={currentPageDetections}
                updateCellOverride={updateCellOverride}
              />
            }
          />
        </section>
      </main>

      <ExtractFooter 
        isProcessing={isProcessing}
        hasProcessed={hasProcessed}
      />
    </div>
  );
}