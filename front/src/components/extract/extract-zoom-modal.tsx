import { IconZoomIn, IconXFilled } from '@tabler/icons-react';
import { type Detection } from "@/lib/extract-utils";

interface ExtractZoomModalProps {
  zoomedRegion: Detection;
  onClose: () => void;
}

export default function ExtractZoomModal({
  zoomedRegion,
  onClose,
}: ExtractZoomModalProps) {
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
              Region Inspector: <span className="font-mono text-primary">{zoomedRegion.label}</span>
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
          {zoomedRegion.crop_url ? (
            <img 
              src={zoomedRegion.crop_url} 
              alt={`Crop of ${zoomedRegion.label}`}
              className="max-w-full max-h-full object-contain border border-border shadow-lg rounded"
              style={{ cursor: 'zoom-out' }}
              onClick={onClose}
            />
          ) : (
            <div className="text-muted-foreground p-10">Crop not available</div>
          )}
        </div>
      </div>
    </div>
  );
}