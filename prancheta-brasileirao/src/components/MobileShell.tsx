import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";

export type SheetTab = "squad" | "opp" | "tactic" | "more";

const TAB_ICONS: Record<SheetTab, string> = {
  squad: "M8 3 4 5v5h3v11h10V10h3V5l-4-2a4 4 0 0 1-8 0Z",
  opp: "M7 4l-3 2v3h2v7h6V9h2V6l-3-2a2 2 0 0 1-4 0ZM17 8l-2.5 1.7V12H16v8h5V12h1.5V9.7L20 8a1.6 1.6 0 0 1-3 0Z",
  tactic: "M4 4h16v16H4zM12 4v16M4 12h4m8 0h4M9 8.5a2 2 0 1 1 0 .01M15 15.5a2 2 0 1 1 0 .01",
  more: "M16 6l-4-4-4 4M12 2v13M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7",
};
const TAB_LABEL: Record<SheetTab, string> = { squad: "Elenco", opp: "Adversário", tactic: "Tática", more: "Compartilhar" };

interface Props {
  style: React.CSSProperties;
  title: string;
  crest: string | null;
  onBack: () => void;
  onLive: () => void;
  onUndo: () => void;
  banner: React.ReactNode;
  pitch: React.ReactNode;
  overlay: React.ReactNode;
  bubble: React.ReactNode;
  sheets: Record<SheetTab, React.ReactNode>;
  counts: Partial<Record<SheetTab, string>>;
  extra: React.ReactNode;
}

/**
 * Layout de app no celular: barra superior, campo vertical ocupando a tela, painel deslizante
 * (bottom sheet) e barra de abas embaixo. Com o painel aberto, o campo encolhe para caber acima dele.
 */
export const MobileShell = forwardRef<HTMLDivElement, Props>(function MobileShell(p, captureRef) {
  const [sheet, setSheet] = useState<SheetTab | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // campo vertical (72:109) do maior tamanho que cabe na área livre
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const w = Math.min(r.width - 16, ((r.height - 12) * 72) / 109);
      setSize({ w: Math.max(0, w), h: Math.max(0, (w * 109) / 72) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // página fixa, sem rolagem nem "puxar para atualizar"
  useEffect(() => {
    document.documentElement.classList.add("is-app");
    return () => document.documentElement.classList.remove("is-app");
  }, []);

  const toggle = (t: SheetTab) => {
    navigator.vibrate?.(6);
    setSheet((s) => (s === t ? null : t));
  };

  return (
    <div className={`m-app ${sheet ? "has-sheet" : ""}`} style={p.style}>
      <header className="m-top">
        <button className="m-icon" onClick={p.onBack} aria-label="Voltar aos clubes">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        {p.crest && <img src={p.crest} alt="" width={30} height={30} />}
        <h1>{p.title}</h1>
        <button className="m-icon" onClick={p.onUndo} aria-label="Desfazer">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
        </button>
        <button className="m-live" onClick={p.onLive}>● Live</button>
      </header>
      {p.banner}

      <main className="m-stage" ref={stageRef}>
        <div className="m-pitch" ref={captureRef} style={{ width: size.w, height: size.h }}>
          {p.pitch}
        </div>
        {p.overlay}
        {p.bubble}
      </main>

      <section className={`m-sheet ${sheet ? "is-open" : ""}`} aria-hidden={!sheet}>
        <button className="m-sheet__handle" onClick={() => setSheet(null)} aria-label="Fechar painel" />
        <div className="m-sheet__body">{sheet && p.sheets[sheet]}</div>
      </section>

      <nav className="m-tabbar" aria-label="Navegação">
        {(Object.keys(TAB_LABEL) as SheetTab[]).map((t) => (
          <button key={t} className={`m-tab ${sheet === t ? "is-on" : ""}`} onClick={() => toggle(t)} aria-pressed={sheet === t}>
            <span className="m-tab__icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={TAB_ICONS[t]} /></svg>
              {p.counts[t] && <em>{p.counts[t]}</em>}
            </span>
            <span className="m-tab__label">{TAB_LABEL[t]}</span>
          </button>
        ))}
      </nav>
      {p.extra}
    </div>
  );
});
