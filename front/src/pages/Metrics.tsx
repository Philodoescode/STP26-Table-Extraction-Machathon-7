import { 
  IconGauge, 
  IconCpu2, 
  IconServerCog,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useMetrics } from "@/hooks/use-metrics";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import ExtractHeader from "@/components/extract/extract-header";

export default function MetricsPage() {
  const { metrics, isLoading, error } = useMetrics({ pollingIntervalMs: 5000 });

  const successRate = metrics?.total_jobs 
    ? ((metrics.success_count / metrics.total_jobs) * 100).toFixed(1) 
    : "100.0";

  const vramPercentage = (metrics?.gpu_memory_used_mb && metrics?.gpu_memory_total_mb)
    ? (metrics.gpu_memory_used_mb / metrics.gpu_memory_total_mb) * 100
    : 0;

  return (
    <div className="h-screen w-screen bg-background text-foreground font-sans overflow-hidden selection:bg-primary/20 flex flex-col">
      <ExtractHeader pageName="System Health" />
      
      {/* Main Container - strictly bound to available height */}
      <div className="flex flex-col w-full px-6 md:px-12 lg:px-24 py-6 lg:py-10 flex-1 min-h-0">
        
        {/* Top Navigation & Status - Compacted margin to save vertical space */}
        <div className="flex justify-between items-end gap-8 mb-8 shrink-0">
          <div className="space-y-2">
            <h1 className="text-4xl lg:text-6xl font-light tracking-tighter">System Health</h1>
            <p className="text-muted-foreground text-lg font-light max-w-2xl">
              Real-time telemetry, extraction performance, and hardware utilization.
            </p>
          </div>
          
          {!isLoading && (
            <div className={`flex items-center gap-3 px-5 py-2.5 rounded-full border shadow-sm backdrop-blur-sm ${error ? "border-red-500/30 bg-red-500/5" : "border-green-500/30 bg-green-500/5"}`}>
              <span className="relative flex size-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${error ? "bg-red-400" : "bg-green-400"} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full size-2.5 ${error ? "bg-red-500" : "bg-green-500"}`}></span>
              </span>
              <span className={`text-xs font-medium tracking-widest uppercase ${error ? "text-red-500" : "text-green-500"}`}>
                {error ? "SYSTEM OFFLINE" : "SYSTEM ONLINE"}
              </span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col flex-1 gap-8 w-full min-h-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 lg:gap-x-24 flex-1">
               <div className="lg:col-span-5 flex flex-col gap-8"><Skeleton className="flex-1 w-full rounded-2xl" /><Skeleton className="flex-1 w-full rounded-2xl" /></div>
               <div className="lg:col-span-7 flex flex-col gap-8"><Skeleton className="flex-1 w-full rounded-2xl" /><Skeleton className="flex-1 w-full rounded-2xl" /></div>
            </div>
            <Skeleton className="h-32 w-full rounded-2xl shrink-0" />
          </div>
        ) : (
          <div className="flex flex-col flex-1 w-full min-h-0 justify-between">
            
            {/* TOP METRICS GRID - takes up available flexible space */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 lg:gap-x-24 flex-1 min-h-0">
              
              {/* LEFT COLUMN: Throughput & Reliability */}
              <div className="lg:col-span-5 flex flex-col justify-between py-4">
                {/* Throughput */}
                <div>
                  <div className="text-xs font-mono text-muted-foreground tracking-widest uppercase flex items-center gap-3 mb-2">
                    <IconGauge className="w-4 h-4 text-primary" />
                    Throughput
                  </div>
                  <div>
                    <span className="text-7xl lg:text-[7.5rem] xl:text-[8.5rem] leading-none font-light tracking-tighter tabular-nums text-foreground block">
                      {metrics?.jobs_per_minute.toFixed(1) || "0.0"}
                    </span>
                    <span className="text-xl text-muted-foreground font-light mt-1 block">jobs / min</span>
                  </div>
                </div>

                {/* Reliability */}
                <div>
                  <div className="text-xs font-mono text-muted-foreground tracking-widest uppercase flex items-center gap-3 mb-2">
                    <IconShieldCheck className="w-4 h-4 text-primary" />
                    Reliability
                  </div>
                  <div>
                    <span className="text-7xl lg:text-[7.5rem] xl:text-[8.5rem] leading-none font-light tracking-tighter tabular-nums text-foreground block">
                      {successRate}
                    </span>
                    <span className="text-xl text-muted-foreground font-light mt-1 block">success rate %</span>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Latency & Lifecycle */}
              <div className="lg:col-span-7 flex flex-col justify-between py-4">
                {/* Processing Latency */}
                <div>
                  <div className="text-xs font-mono text-muted-foreground tracking-widest uppercase flex items-center gap-3 mb-4">
                    <span className="w-4 h-4 flex items-center justify-center text-primary text-base font-bold">~</span>
                    Processing Latency
                  </div>
                  <div className="flex gap-12 lg:gap-24">
                    <div className="flex flex-col gap-2">
                      <span className="text-xs text-muted-foreground uppercase tracking-widest font-mono">Average</span>
                      <div className="text-5xl xl:text-6xl font-light tabular-nums flex items-baseline gap-2">
                        {metrics?.avg_latency_ms ? `${metrics.avg_latency_ms.toFixed(0)}` : "---"}
                        <span className="text-xl text-muted-foreground font-light">ms</span>
                      </div>
                    </div>
                    <div className="w-px h-16 bg-border/30" />
                    <div className="flex flex-col gap-2">
                      <span className="text-xs text-muted-foreground uppercase tracking-widest font-mono">95th Percentile</span>
                      <div className="text-5xl xl:text-6xl font-light tabular-nums flex items-baseline gap-2">
                        {metrics?.p95_latency_ms ? `${metrics.p95_latency_ms.toFixed(0)}` : "---"}
                        <span className="text-xl text-muted-foreground font-light">ms</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Job Lifecycle */}
                <div className="max-w-xl w-full">
                  <div className="text-xs font-mono text-muted-foreground tracking-widest uppercase flex items-center gap-3 mb-2">
                    <span className="w-4 h-4 flex items-center justify-center text-primary text-base font-bold">#</span>
                    Job Lifecycle
                  </div>
                  <div className="flex flex-col">
                    <div className="flex justify-between items-end py-3 border-b border-border/20">
                      <span className="text-lg text-muted-foreground font-light">Total Processed</span>
                      <span className="text-3xl font-light tabular-nums">{metrics?.total_jobs || 0}</span>
                    </div>
                    <div className="flex justify-between items-end py-3 border-b border-border/20">
                      <span className="text-lg text-green-500/80 font-light">Successful</span>
                      <span className="text-3xl font-light tabular-nums text-green-500">{metrics?.success_count || 0}</span>
                    </div>
                    <div className="flex justify-between items-end py-3">
                      <span className="text-lg text-destructive/80 font-light">Failed</span>
                      <span className="text-3xl font-light tabular-nums text-destructive">{metrics?.failure_count || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* BOTTOM METRICS: Hardware Utilization (Strict height boundary) */}
            <div className="shrink-0 pt-8 border-t border-border/20 mt-6">
              <div className="text-xs font-mono text-muted-foreground tracking-widest uppercase flex items-center gap-3 mb-6">
                <IconServerCog className="w-4 h-4 text-primary" />
                Compute Resources
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-24 items-center">
                
                {/* Status Column */}
                <div className="lg:col-span-4 flex items-center gap-5">
                  <div className={`p-3 rounded-full ${metrics?.gpu_available ? 'bg-primary/10 text-primary' : 'bg-muted/30 text-muted-foreground'}`}>
                    <IconCpu2 className="w-7 h-7" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="text-xl font-light mb-0.5">
                      {metrics?.gpu_available ? 'GPU Acceleration Active' : 'CPU Inference Engine'}
                    </div>
                    <div className="text-xs text-muted-foreground font-light max-w-xs truncate" title={metrics?.gpu_name || "Standard processing mode"}>
                      {metrics?.gpu_name || "Standard general-purpose compute"}
                    </div>
                    <div className="text-xs text-muted-foreground/90 font-light mt-2 space-y-1">
                      <div>
                        GPU containers up: <span className="tabular-nums">{metrics?.gpu_containers_up ?? 0}</span>
                        {" / "}
                        <span className="tabular-nums">{metrics?.gpu_max_containers ?? 0}</span>
                      </div>
                      <div>
                        Active containers: <span className="tabular-nums">{metrics?.gpu_containers_active ?? 0}</span>
                        {" · "}Active calls: <span className="tabular-nums">{metrics?.gpu_active_calls ?? 0}</span>
                      </div>
                      <div>
                        Routing: <span className="tabular-nums">{metrics?.gpu_routing_mode || "pool"}</span>
                        {" · "}Shards: <span className="tabular-nums">{metrics?.gpu_shards ?? 1}</span>
                        {" · "}Routes up: <span className="tabular-nums">{metrics?.gpu_routes_up ?? 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Bars Column */}
                {metrics?.gpu_available && (
                  <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-24">
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-light text-muted-foreground">GPU Utilization</span>
                        <span className="text-2xl font-light tabular-nums">{metrics.gpu_utilization_pct?.toFixed(1) || 0}%</span>
                      </div>
                      <Progress value={metrics.gpu_utilization_pct || 0} className="h-1 bg-muted/50" />
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-light text-muted-foreground">VRAM Allocation</span>
                        <span className="text-xl font-light tabular-nums">
                          {metrics.gpu_memory_used_mb?.toFixed(0) || 0} <span className="text-muted-foreground text-xs">/ {metrics.gpu_memory_total_mb?.toFixed(0) || 0} MB</span>
                        </span>
                      </div>
                      <Progress value={vramPercentage} className="h-1 bg-muted/50" />
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
