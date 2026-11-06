import { useEffect, useState } from "react";

export type Route =
  | { page: "home" }
  | { page: "creator" }
  | { page: "board"; slug: string; live: boolean }
  | { page: "notfound" };

export function parseRoute(path: string): Route {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return { page: "home" };
  if (parts.length === 1 && parts[0] === "creator") return { page: "creator" };
  if (parts.length === 1) return { page: "board", slug: parts[0], live: false };
  if (parts.length === 2 && parts[1] === "live") return { page: "board", slug: parts[0], live: true };
  return { page: "notfound" };
}

export function navigate(to: string): void {
  history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoute(): Route {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  return parseRoute(path);
}

export const params = () => new URLSearchParams(location.search);
