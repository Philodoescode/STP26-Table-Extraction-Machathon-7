import { useEffect, useRef } from "react";
import { IconZoomIn, IconXFilled } from '@tabler/icons-react';
import { type Detection } from "@/lib/extract-utils";

interface ExtractZoomModalProps {
  zoomedRegion: Detection;
  onClose: () => void;
  displayUrl: string | null;
  imageSize: { width: number, height: number };
}

export default function ExtractZoomModal({
  zoomedRegion,
  onClose,
  displayUrl,
  imageSize
}: ExtractZoomModalProps) {
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (zoomedRegion && displayUrl && modalCanvasRef.current) {
      const img = new Image();
      img.src = displayUrl;
      img.onload = () => {
        const canvas = modalCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Exactly inverse the python backend's dynamic logic:
        // if img.width < 1000: scale = 1000 / img.width
        const scaleFactor = (imageSize.width > 0 && imageSize.width < 1000) 
            ? (1000 / imageSize.width) 
            : 1.0;

        const sx = zoomedRegion.bbox[0] / scaleFactor;
        const sy = zoomedRegion.bbox[1] / scaleFactor;
        const sWidth = (zoomedRegion.bbox[2] - zoomedRegion.bbox[0]) / scaleFactor;
        const sHeight = (zoomedRegion.bbox[3] - zoomedRegion.bbox[1]) / scaleFactor;

        const maxWidth = Math.min(800, window.innerWidth - 100);
        const scale = maxWidth / sWidth;
        
        canvas.width = sWidth * scale;
        canvas.height = sHeight * scale;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        
        ctx.drawImage(
          img,
          sx, sy, sWidth, sHeight,
          0, 0, canvas.width, canvas.height 
        );
      };
    }
  }, [zoomedRegion, displayUrl, imageSize]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
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
            onClick={onClose}
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
            onClick={onClose}
          />
        </div>
      </div>
    </div>
  );
}