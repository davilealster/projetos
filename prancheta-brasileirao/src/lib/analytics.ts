// Vercel Analytics (sem cookies) + Google Analytics 4. Só registram em produção e fora do modo live.
import { inject, track } from "@vercel/analytics";
import { getPref, setPref } from "./state";

export const cleanHandle = (h: string | null | undefined) =>
  (h ?? "").trim().replace(/^@+/, "").replace(/[^\w.]/g, "").slice(0, 30);

const GA_ID = "G-8J8M6TNH0W";
type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

/** Google Analytics 4. As trocas de tela (pushState) contam como página pela "métrica otimizada" do GA. */
function initGA(): void {
  if (window.gtag) return;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

export function initAnalytics(): void {
  const live = /\/live\/?$/.test(location.pathname);
  if (import.meta.env.PROD && !live) {
    inject();
    initGA();
  }
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
  try {
    window.gtag?.("event", name, data ?? {});
  } catch {
    /* ignore */
  }
};
