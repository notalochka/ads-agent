import type { ResearchResponse } from "../types/research";

const STORAGE_KEY = "ads-agent:lastResearch";

export function saveResearch(response: ResearchResponse): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(response));
}

export function loadResearch(): ResearchResponse | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ResearchResponse;
  } catch {
    return null;
  }
}

export function clearResearch(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
