// Tour de navegação: destaca partes da tela, uma por vez (depois do guia inicial).
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export interface TourStep {
  /** seletores tentados em ordem; o primeiro visível vira o alvo (permite alvos diferentes no celular) */
  target: string[];
  title: string;
  text: string;
}

const KEY = "mercado:tour:v1";
export const tourSeen = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
};
const markSeen = () => {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* sem storage */
  }
};

function find(sel: string[]): HTMLElement | null {
  for (const s of sel) {
    const el = document.querySelector<HTMLElement>(s);
    if (el && el.offsetWidth > 0 && el.offsetHeight > 0) return el;
  }
  return null;
}

export function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const live = steps.filter((s) => find(s.target));
  const [i, setI] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const step = live[i];

  const measure = useCallback(() => {
    const el = step && find(step.target);
    setBox(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useLayoutEffect(() => {
    const el = step && find(step.target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const fixed = getComputedStyle(el).position === "fixed" || el.closest(".tm-tabbar, .mhd");
    if (!fixed && (r.top < 70 || r.bottom > innerHeight - 90)) el.scrollIntoView({ block: "center", behavior: "auto" });
    measure();
  }, [step, measure]);

  useEffect(() => {
    addEventListener("resize", measure);
    addEventListener("scroll", measure, true);
    return () => {
      removeEventListener("resize", measure);
      removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  const close = useCallback(() => {
    markSeen();
    onClose();
  }, [onClose]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, live.length - 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [close, live.length]);

  if (!step || !box) return null;
  const pad = 6;
  const hole = { left: box.left - pad, top: box.top - pad, width: box.width + pad * 2, height: box.height + pad * 2 };
  // cartão embaixo do alvo se couber; senão em cima
  const cardW = Math.min(340, innerWidth - 24);
  const below = hole.top + hole.height + 200 < innerHeight;
  const left = Math.max(12, Math.min(innerWidth - cardW - 12, hole.left + hole.width / 2 - cardW / 2));
  const cardStyle: React.CSSProperties = below
    ? { top: hole.top + hole.height + 12, left, width: cardW }
    : { bottom: innerHeight - hole.top + 12, left, width: cardW };
  const last = i === live.length - 1;

  return (
    <div className="tm-tour" role="dialog" aria-modal="true" aria-label="Tour pela tela">
      <div className="tm-tour__scrim" onClick={close} />
      <div className="tm-tour__hole" style={hole} />
      <div className="tm-tour__card" style={cardStyle}>
        <p className="tm-eyebrow">{i + 1} de {live.length}</p>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <div className="tm-tour__nav">
          <button className="tm-btn tm-btn--ghost" onClick={close}>{last ? "Fechar" : "Pular tour"}</button>
          <span>
            {i > 0 && <button className="tm-btn tm-btn--ghost" onClick={() => setI(i - 1)}>Voltar</button>}
            <button className="tm-btn tm-btn--brass" onClick={() => (last ? close() : setI(i + 1))}>{last ? "Começar" : "Próximo"}</button>
          </span>
        </div>
      </div>
    </div>
  );
}
