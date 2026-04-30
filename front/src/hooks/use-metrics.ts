import { useEffect, useRef, useState } from "react";
import { api, type MetricsSnapshot } from "@/lib/api";

type UseMetricsOptions = {
  pollingIntervalMs?: number;
};

export function useMetrics({
  pollingIntervalMs = 5000,
}: UseMetricsOptions = {}) {
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const clearPolling = () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

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

    const startPolling = () => {
      clearPolling();
      if (document.visibilityState !== "visible") return;
      intervalRef.current = window.setInterval(() => {
        void fetchMetrics();
      }, pollingIntervalMs);
    };

    const handleVisibilityChange = () => {
      if (!mounted) return;
      if (document.visibilityState === "visible") {
        void fetchMetrics();
        startPolling();
      } else {
        clearPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    void fetchMetrics();
    startPolling();

    return () => {
      mounted = false;
      clearPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pollingIntervalMs]);

  return { metrics, isLoading, error };
}
