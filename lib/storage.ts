import type { ApiSecrets } from "@/lib/types";

export const STORAGE_KEYS = {
  transactions: "orbis.transactions.v1",
  watchlist: "orbis.watchlist.v1",
  alerts: "orbis.alerts.v1",
  settings: "orbis.settings.v1",
  secrets: "orbis.secrets.v1",
  reports: "orbis.reports.v1",
};

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readSecrets(): ApiSecrets {
  if (typeof window === "undefined") {
    return { openaiKey: "", geminiKey: "", brapiToken: "" };
  }
  const raw =
    window.sessionStorage.getItem(STORAGE_KEYS.secrets) ||
    window.localStorage.getItem(STORAGE_KEYS.secrets);
  if (!raw) return { openaiKey: "", geminiKey: "", brapiToken: "" };
  try {
    return JSON.parse(raw) as ApiSecrets;
  } catch {
    return { openaiKey: "", geminiKey: "", brapiToken: "" };
  }
}

export function writeSecrets(secrets: ApiSecrets, remember: boolean): void {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(secrets);
  window.sessionStorage.setItem(STORAGE_KEYS.secrets, serialized);
  if (remember) {
    window.localStorage.setItem(STORAGE_KEYS.secrets, serialized);
  } else {
    window.localStorage.removeItem(STORAGE_KEYS.secrets);
  }
}
