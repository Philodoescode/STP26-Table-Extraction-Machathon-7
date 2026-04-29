interface ExtractFooterProps {
  isProcessing: boolean;
  hasProcessed: boolean;
}

export default function ExtractFooter({
  isProcessing,
  hasProcessed
}: ExtractFooterProps) {
  return (
    <footer className="flex-none h-10 border-t border-border bg-card/40 flex items-center px-4 gap-4 text-[11px] text-muted-foreground font-mono">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full size-2 bg-green-500"></span>
        </span>
        <span className="text-foreground/80 font-medium tracking-wide">
          SYSTEM ONLINE
        </span>
      </div>
      <div className="w-px h-3 bg-border"></div>
      <div className="flex gap-2">
        <span className="opacity-70">Latency:</span>
        <span className="text-foreground">
          {hasProcessed ? "142ms" : isProcessing ? "---" : "Idle"}
        </span>
      </div>
      <div className="w-px h-3 bg-border"></div>
      <div className="flex gap-2">
        <span className="opacity-70">Success Rate:</span>
        <span className="text-foreground">99.8%</span>
      </div>
      <div className="w-px h-3 bg-border"></div>
      <div className="flex gap-2 ml-auto">
        <span className="opacity-70">CPU:</span>
        <span className="text-foreground min-w-[30px]">
          {isProcessing ? "68%" : "12%"}
        </span>
        <span className="opacity-70 ml-2">GPU:</span>
        <span className="text-foreground min-w-[30px]">
          {isProcessing ? "42%" : "4%"}
        </span>
      </div>
    </footer>
  );
}