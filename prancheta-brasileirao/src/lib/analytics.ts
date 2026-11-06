// Vercel Analytics: sem cookies e sem dado pessoal. Só registra quando o site roda na Vercel.
import { inject, track } from "@vercel/analytics";
import { getPref, setPref } from "./state";

export const cleanHandle = (h: string | null | undefined) =>
  (h ?? "").trim().replace(/^@+/, "").replace(/[^\w.]/g, "").slice(0, 30);

export function initAnalytics(): void {
  if (import.meta.env.PROD) inject();
  // ?creator=@fulano em qualquer página: guarda como origem da visita e registra o evento.
  const ref = cleanHandle(new URLSearchParams(location.search).get("creator"));
  if (ref && !location.pathname.endsWith("/live")) {
    setPref("ref", ref);
    track("creator_visit", { creator: ref, path: location.pathname });
  }
}

/** Influenciador que trouxe o visitante (para repassar nos links que ele compartilhar). */
export const referral = () => cleanHandle(getPref("ref"));

export const trackEvent = (name: string, data?: Record<string, string>) => {
  try {
    track(name, data);
  } catch {
    /* ignore */
  }
};
