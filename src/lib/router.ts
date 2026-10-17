import { useEffect, useState } from "react";

export type Location = { parts: string[] };

function read(): Location {
  const raw = decodeURIComponent(globalThis.location.hash.replace(/^#\/?/, ""));
  return { parts: raw.split("/").filter(Boolean) };
}

/** Hash routing keeps the built site working from any static host or a plain file server. */
export function useHashLocation(): Location {
  const [loc, setLoc] = useState(read);
  useEffect(() => {
    const on = () => setLoc(read());
    globalThis.addEventListener("hashchange", on);
    return () => globalThis.removeEventListener("hashchange", on);
  }, []);
  return loc;
}

export const href = (...parts: (string | undefined)[]): string => `#/${parts.filter(Boolean).join("/")}`;

export function navigate(to: string, replace = false): void {
  if (replace) globalThis.location.replace(to);
  else globalThis.location.hash = to.replace(/^#/, "");
}

export type BackLink = { to: string; label: string };

const ORIGIN_KEY = "fw-dossier-origin";

/** Label for the page a dossier was opened from: a walkthrough, an army, the later-joiners list or home. */
export function backLinkFor(hash: string): BackLink {
  const clean = decodeURIComponent(hash.replace(/^#\/?/, ""));
  const [first, second] = clean.split("/");
  if (!first || first === "menu") return { to: href(), label: "All lords" };
  if (first === "later" || first === "reserve") return { to: href("later"), label: "Later joiners" };
  const name = `${first[0].toUpperCase()}${first.slice(1)}`;
  if (second === "army") return { to: href(first, "army"), label: `${name}'s army` };
  return { to: `#/${clean}`, label: `${name}'s walkthrough` };
}

let latest: string | null = null;

/** Called by pages that update the URL without a hashchange (the walkthrough's chapter tracking). */
export function rememberOrigin(hash: string): void {
  latest = hash;
  try {
    sessionStorage.setItem(ORIGIN_KEY, hash);
  } catch {
    // Storage can be blocked; the in-memory value still works for this visit.
  }
}

/**
 * Remembers the last non-dossier page so the dossier's back link returns there, even after stepping
 * through units or following support links into another army's units.
 */
export function useDossierOrigin(inDossier: boolean): string | null {
  const [origin, setOrigin] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(ORIGIN_KEY);
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (inDossier) {
      if (latest && latest !== origin) setOrigin(latest);
      return;
    }
    const hash = globalThis.location.hash || "#/";
    setOrigin(hash);
    rememberOrigin(hash);
  });
  return origin;
}
