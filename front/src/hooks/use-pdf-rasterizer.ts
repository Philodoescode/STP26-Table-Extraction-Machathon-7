import { useState, useEffect } from "react";

export const usePdfRasterizer = (files: any[]) => {
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isRasterizing, setIsRasterizing] = useState(false);

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

  return {
    pdfPages,
    currentPage,
    setCurrentPage,
    totalPages,
    isRasterizing
  };
};