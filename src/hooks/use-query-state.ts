"use client";

import { DependencyList, useCallback, useEffect, useState } from "react";

type QueryStatus = "idle" | "loading" | "success" | "empty" | "error";

function isEmptyPayload(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object" && "items" in (value as Record<string, unknown>)) {
    const items = (value as { items?: unknown[] }).items;
    return Array.isArray(items) ? items.length === 0 : false;
  }
  return false;
}

export function useQueryState<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: DependencyList = []) {
  const [status, setStatus] = useState<QueryStatus>("idle");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("ECO_TIMEOUT_10S"), 10_000);
    setStatus("loading");
    setError(null);
    try {
      const result = await fetcher(controller.signal);
      setData(result);
      setStatus(isEmptyPayload(result) ? "empty" : "success");
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "AbortError"
          ? "Demorou demais"
          : (err as Error)?.message || "Erro inesperado";
      setError(message);
      setStatus("error");
    } finally {
      clearTimeout(timeout);
    }
  }, [fetcher]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { status, data, error, refetch: run } as const;
}
