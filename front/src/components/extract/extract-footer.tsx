import { useMetrics } from "@/hooks/use-metrics";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

export default function ExtractFooter() {
  const { metrics, error } = useMetrics();

  const successRate = metrics?.total_jobs 
    ? ((metrics.success_count / metrics.total_jobs) * 100).toFixed(1) 
    : "100.0";

  return (
    <footer className="flex-none h-10 border-t border-border bg-card/40 flex items-center px-4 gap-4 text-[11px] text-muted-foreground font-mono">
      <Link 
        to="/metrics" 
        className="flex items-center gap-2 group hover:text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded px-1 -ml-1 py-1"
        aria-label="View System Metrics and Health"
      >
        <span className="relative flex size-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${error ? "bg-red-400" : "bg-green-400"} opacity-75`}></span>
          <span className={`relative inline-flex rounded-full size-2 ${error ? "bg-red-500" : "bg-green-500"}`}></span>
        </span>
        <span className="text-foreground/80 font-medium tracking-wide group-hover:text-primary transition-colors flex items-center gap-1">
          {error ? "SYSTEM OFFLINE" : "SYSTEM ONLINE"}
          <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity -ml-0.5" />
        </span>
      </Link>
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
        <span className="opacity-70">GPU Inference:</span>
        <span className="text-foreground min-w-[30px]">
          {metrics?.gpu_containers_up ?? 0}
          {metrics?.gpu_max_containers ? ` / ${metrics.gpu_max_containers}` : ""}
          {" "}containers up
        </span>
        <span className="opacity-70 ml-2">Active:</span>
        <span className="text-foreground min-w-[30px]">{metrics?.gpu_containers_active ?? 0}</span>
        <span className="opacity-70 ml-2">GPU Util:</span>
        <span className="text-foreground min-w-[30px]">
          {metrics?.gpu_utilization_pct !== null && metrics?.gpu_utilization_pct !== undefined
            ? `${metrics.gpu_utilization_pct.toFixed(1)}%`
            : "---"}
        </span>
      </div>
    </footer>
  );
}
