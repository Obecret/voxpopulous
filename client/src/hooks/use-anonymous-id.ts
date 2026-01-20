import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "voxpopulous_anonymous_id";

function generateAnonymousId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const randomHex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return `anon_${randomHex}`;
}

export function useAnonymousId(): { 
  anonymousId: string | null; 
  isReady: boolean;
  resetAnonymousId: () => void;
  clearAnonymousId: () => void;
} {
  const [anonymousId, setAnonymousId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = generateAnonymousId();
      localStorage.setItem(STORAGE_KEY, id);
    }
    setAnonymousId(id);
    setIsReady(true);
  }, []);

  const resetAnonymousId = useCallback(() => {
    const newId = generateAnonymousId();
    localStorage.setItem(STORAGE_KEY, newId);
    setAnonymousId(newId);
  }, []);

  const clearAnonymousId = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAnonymousId(null);
  }, []);

  return { anonymousId, isReady, resetAnonymousId, clearAnonymousId };
}

export function getAnonymousId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = generateAnonymousId();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
