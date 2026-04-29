import { useState, useEffect } from "react";
import { api, type MetricsSnapshot } from "@/lib/api";

export function useMetrics(pollingIntervalMs: number = 5000) {
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchMetrics() {
      try {
        const data = await api.getMetrics();
        if (mounted) {
          setMetrics(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, pollingIntervalMs);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [pollingIntervalMs]);

  return { metrics, isLoading, error };
}
