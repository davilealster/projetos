import { useEffect, useState } from "react";

export type Route =
  | { page: "home" }
  | { page: "redirect"; module: "prancheta" | "mercado" | "olheiro"; slug?: string }
  | { page: "creator" }
  | { page: "admin" }
  | { page: "market"; slug: string | null }
  | { page: "board"; slug: string; live: boolean }
  | { page: "notfound" };

export function parseRoute(path: string): Route {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return { page: "home" };
  if (parts.length === 1 && parts[0] === "creator") return { page: "creator" };
  if (parts.length === 1 && parts[0] === "admin") return { page: "admin" };
  if (parts.length === 1 && parts[0] === "mercado") return { page: "redirect", module: "mercado" };
  if (parts[0] === "mercado" && parts.length === 2) return { page: "market", slug: parts[1] };
  if (parts.length === 1 && parts[0] === "olheiro") return { page: "redirect", module: "olheiro" };
  // o Olheiro virou parte da etapa 2 do Mercado: links antigos redirecionam
  if (parts[0] === "olheiro" && parts.length === 2) return { page: "redirect", module: "olheiro", slug: parts[1] };
  if (parts.length === 1 && parts[0] === "prancheta") return { page: "redirect", module: "prancheta" };
  if (parts.length === 1) return { page: "board", slug: parts[0], live: false };
  if (parts.length === 2 && parts[1] === "live") return { page: "board", slug: parts[0], live: true };
  return { page: "notfound" };
}

export function navigate(to: string): void {
  history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Troca a URL sem criar entrada no histórico (redirecionamentos). */
export function replace(to: string): void {
  history.replaceState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoute(): Route {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener("popstate", on);
    // efeitos dos filhos rodam antes: um redirecionamento no primeiro render (ex.: /olheiro) já trocou a URL
    on();
    return () => window.removeEventListener("popstate", on);
  }, []);
  return parseRoute(path);
}

export const params = () => new URLSearchParams(location.search);
