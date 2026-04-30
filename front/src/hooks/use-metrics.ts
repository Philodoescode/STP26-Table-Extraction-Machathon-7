import { useEffect, useRef, useState } from "react";
import { api, type MetricsSnapshot } from "@/lib/api";

type UseMetricsOptions = {
  activeIntervalMs?: number;
  idleAfterMs?: number;
  idleIntervalMs?: number;
};

export function useMetrics({
  activeIntervalMs = 5000,
  idleAfterMs = 60_000,
  idleIntervalMs = 6 * 60_000,
}: UseMetricsOptions = {}) {
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const lastInteractionAtRef = useRef<number>(Date.now());
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const clearTimer = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const schedule = (delayMs: number) => {
      clearTimer();
      timeoutRef.current = window.setTimeout(() => {
        void tick();
      }, delayMs);
    };

    const isVisible = () => document.visibilityState === "visible";

    const isActive = () =>
      isVisible() && Date.now() - lastInteractionAtRef.current <= idleAfterMs;

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

    async function tick() {
      if (!mounted) return;
      if (isActive()) {
        await fetchMetrics();
        schedule(activeIntervalMs);
      } else {
        schedule(idleIntervalMs);
      }
    }

    const markInteraction = () => {
      const now = Date.now();
      const wasIdle = now - lastInteractionAtRef.current > idleAfterMs;
      lastInteractionAtRef.current = now;
      if (wasIdle && mounted && isVisible()) {
        void fetchMetrics();
        schedule(activeIntervalMs);
      }
    };

    const handleVisibilityChange = () => {
      if (!mounted) return;
      if (isVisible()) {
        markInteraction();
      } else {
        clearTimer();
        schedule(idleIntervalMs);
      }
    };

    const activityEvents = ["pointerdown", "keydown", "touchstart", "mousemove", "scroll"];
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, markInteraction, { passive: true })
    );
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void fetchMetrics();
    schedule(activeIntervalMs);

    return () => {
      mounted = false;
      clearTimer();
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, markInteraction)
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeIntervalMs, idleAfterMs, idleIntervalMs]);

  return { metrics, isLoading, error };
}
