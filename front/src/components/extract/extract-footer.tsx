import { useMetrics } from "@/hooks/use-metrics";

export default function ExtractFooter() {
  const { metrics, error } = useMetrics();

  const successRate = metrics?.total_jobs 
    ? ((metrics.success_count / metrics.total_jobs) * 100).toFixed(1) 
    : "100.0";

  return (
    <footer className="flex-none h-10 border-t border-border bg-card/40 flex items-center px-4 gap-4 text-[11px] text-muted-foreground font-mono">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${error ? "bg-red-400" : "bg-green-400"} opacity-75`}></span>
          <span className={`relative inline-flex rounded-full size-2 ${error ? "bg-red-500" : "bg-green-500"}`}></span>
        </span>
        <span className="text-foreground/80 font-medium tracking-wide">
          {error ? "SYSTEM OFFLINE" : "SYSTEM ONLINE"}
        </span>
      </div>
      <div className="w-px h-3 bg-border"></div>
      <div className="flex gap-2">
        <span className="opacity-70">Latency:</span>
        <span className="text-foreground">
          {metrics?.avg_latency_ms ? `${metrics.avg_latency_ms.toFixed(0)}ms` : "---"}
          {metrics?.p95_latency_ms ? ` (p95: ${metrics.p95_latency_ms.toFixed(0)}ms)` : ""}
        </span>
      </div>
      <div className="w-px h-3 bg-border"></div>
      <div className="flex gap-2">
        <span className="opacity-70">Success Rate:</span>
        <span className="text-foreground">{successRate}%</span>
      </div>
      <div className="w-px h-3 bg-border"></div>
      <div className="flex gap-2">
        <span className="opacity-70">Jobs/Min:</span>
        <span className="text-foreground">{metrics?.jobs_per_minute.toFixed(1) || "0.0"}</span>
      </div>
      <div className="w-px h-3 bg-border"></div>
      <div className="flex gap-2 ml-auto">
        {metrics?.gpu_available ? (
          <>
            <span className="opacity-70">GPU Util:</span>
            <span className="text-foreground min-w-[30px]">
              {metrics.gpu_utilization_pct !== null && metrics.gpu_utilization_pct !== undefined 
                ? `${metrics.gpu_utilization_pct.toFixed(1)}%` 
                : "---"}
            </span>
            <span className="opacity-70 ml-2">VRAM:</span>
            <span className="text-foreground min-w-[30px]">
              {metrics.gpu_memory_used_mb !== null && metrics.gpu_memory_total_mb !== null 
                ? `${metrics.gpu_memory_used_mb.toFixed(0)}MB / ${metrics.gpu_memory_total_mb.toFixed(0)}MB`
                : "---"}
            </span>
          </>
        ) : (
          <span className="text-foreground min-w-[30px]">CPU Inference</span>
        )}
      </div>
    </footer>
  );
}