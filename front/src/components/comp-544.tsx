"use client";

import { useFileUpload, type FileUploadState, type FileUploadActions } from "@/hooks/use-file-upload";

interface ComponentProps {
  state?: FileUploadState;
  actions?: FileUploadActions;
  maxSizeMB?: number;
}

export default function Component({ state: propState, actions: propActions, maxSizeMB = 5 }: ComponentProps) {
  const maxSize = maxSizeMB * 1024 * 1024; // 5MB default

  const internalResult = useFileUpload({
    accept: "image/*,application/pdf",
    maxSize,
  });

  const state = propState || internalResult[0];
  const actions = propActions || internalResult[1];

  const { files, isDragging, errors } = state;
  const {
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    openFileDialog,
    removeFile,
    getInputProps,
  } = actions;

  const previewUrl = files[0]?.preview || null;
  const isPdf = files[0]?.file?.type === "application/pdf";

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <div
          className="relative flex min-h-60 flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-all duration-300 has-disabled:pointer-events-none data-[dragging=true]:bg-primary/5 cursor-pointer select-none"
          style={{
            borderColor: isDragging ? 'var(--primary)' : 'var(--border)',
            background: isDragging ? 'rgba(155, 44, 44, 0.05)' : 'rgba(255, 255, 255, 0.02)',
          }}
          data-dragging={isDragging || undefined}
          onClick={openFileDialog}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          role="button"
          tabIndex={-1}
        >
          <input
            {...getInputProps()}
            aria-label="Upload file"
            className="sr-only"
          />
          
          {previewUrl ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              {isPdf ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="h-16 w-12 border-2 border-primary/40 rounded flex items-center justify-center bg-primary/10">
                     <span className="font-mono font-bold text-primary tracking-widest text-xs uppercase">PDF</span>
                  </div>
                  <span className="text-sm font-medium tracking-wide text-white truncate w-48 block">{(files[0].file as any).name}</span>
                </div>
              ) : (
                <img
                  alt={files[0]?.file?.name || "Uploaded payload"}
                  className="w-full h-full object-contain rounded drop-shadow-2xl"
                  src={previewUrl}
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-4 text-center group">
              <div
                aria-hidden="true"
                className="mb-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border bg-black/20 group-hover:border-primary group-hover:text-primary transition-colors duration-300"
              >
                <span className="text-2xl leading-none block mb-[2px] font-light">+</span>
              </div>
              <p className="mb-2 font-medium text-base text-white tracking-wide">
                Initialize File Upload
              </p>
              <p className="text-muted-foreground text-xs uppercase tracking-widest font-mono">
                {maxSizeMB}MB MAX / PDF & IMAGES
              </p>
            </div>
          )}
        </div>

        {previewUrl && (
          <div className="absolute top-4 right-4">
            <button
              aria-label="Remove payload"
              className="z-50 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/80 text-white hover:text-primary outline-none transition-colors border border-border"
              onClick={(e) => {
                e.stopPropagation();
                removeFile(files[0]?.id);
              }}
              type="button"
            >
              <span aria-hidden="true" className="text-base font-light block mb-[1px]">×</span>
            </button>
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div
          className="flex items-center gap-2 text-primary text-sm font-medium p-3 bg-primary/10 border border-primary/20 rounded-md"
          role="alert"
        >
          <span className="font-bold font-mono tracking-widest">[!]</span>
          <span className="tracking-wide">{errors[0]}</span>
        </div>
      )}
    </div>
  );
}