"use client";

import { useEffect, useRef } from "react";

type FetchFn = typeof fetch;

const REDACTED = "[redacted]";

function stringifyBody(body: BodyInit | null | undefined) {
  if (!body) return undefined;
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return body.slice(0, 512);
    }
  }
  if (body instanceof URLSearchParams) {
    return body.toString();
  }
  if (body instanceof FormData) {
    const entries: Record<string, FormDataEntryValue> = {};
    body.forEach((value, key) => {
      entries[key] = typeof value === "string" ? value : REDACTED;
    });
    return JSON.stringify(entries, null, 2);
  }
  return REDACTED;
}

export function RequestLogger() {
  const installedRef = useRef(false);

  useEffect(() => {
    if (installedRef.current || typeof window === "undefined") {
      return;
    }

    const originalFetch: FetchFn = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method?.toUpperCase() || (input instanceof Request ? input.method : "GET");
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const start = performance.now();
      const body = init?.body ?? (input instanceof Request ? input.body : undefined);

      const logPrefix = `🌐 [FETCH] ${method} ${url}`;
      const payload = stringifyBody(init?.body && typeof init.body !== "string" ? init.body : (typeof init?.body === "string" ? init.body : undefined));

      if (payload) {
        console.log(logPrefix, "payload:", payload);
      } else {
        console.log(logPrefix);
      }

      try {
        const response = await originalFetch(input, init);
        const duration = Math.round(performance.now() - start);
        console.log(`${logPrefix} → ${response.status} (${duration}ms)`);
        return response;
      } catch (error) {
        const duration = Math.round(performance.now() - start);
        const err = error instanceof Error ? error : new Error(String(error));
        const message = `${logPrefix} ✖ failed after ${duration}ms`;

        if (err.name === "TypeError" && err.message.toLowerCase().includes("failed to fetch")) {
          console.warn(message, err);
        } else {
          console.error(message, err);
        }

        throw error;
      }
    };

    installedRef.current = true;
    console.info("[Telemetry] RequestLogger installed — all client fetches will be traced in the console.");

    return () => {
      window.fetch = originalFetch;
      installedRef.current = false;
    };
  }, []);

  return null;
}
