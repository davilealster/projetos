// Gráficos do Mercado da bola. Cores validadas para daltonismo sobre o feltro (ver market.css: --c-*).
// Identidade nunca só pela cor: quem sai é anel vazado, quem chega tem marca própria, e há legenda.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { curUnit, fmtEur, fmtMoney, toUnit, type DepthRow, type NextPlayer, type WaterfallStep } from "./logic";

const tip = (text: string) => ({ "data-tip": text, tabIndex: 0 });

/**
 * Dicas no toque: em telas sem hover, tocar num elemento com data-tip mostra a dica (presa dentro da tela);
 * tocar em qualquer outro lugar, rolar ou girar a tela fecha. Com mouse, segue valendo o :hover do CSS.
 */
export function TapTips() {
  const [t, setT] = useState<{ text: string; r: DOMRect; el: Element } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const touch = matchMedia("(hover: none)");
    const onClick = (e: MouseEvent) => {
      if (!touch.matches) return;
      const el = (e.target as Element | null)?.closest?.(".tm [data-tip]");
      setT((cur) => (el && cur?.el !== el ? { text: el.getAttribute("data-tip") ?? "", r: el.getBoundingClientRect(), el } : null));
    };
    const close = () => setT(null);
    document.addEventListener("click", onClick);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, []);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!t || !box) return;
    const pad = 8;
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const left = Math.min(Math.max(pad, t.r.left + t.r.width / 2 - w / 2), vw - w - pad);
    const above = t.r.top - h - 8;
    box.style.left = `${left}px`;
    box.style.top = `${above >= pad ? above : t.r.bottom + 8}px`;
    box.style.visibility = "visible";
  }, [t]);
  if (!t) return null;
  return (
    <div ref={ref} className="tm-taptip" role="tooltip" style={{ visibility: "hidden" }}>
      {t.text}
    </div>
  );
}

export function Legend({ items }: { items: ("stay" | "new" | "leave" | "min")[] }) {
  const label = { stay: "Fica", new: "Chega", leave: "Sai", min: "Mínimo recomendado" };
  return (
    <ul className="tm-legend">
      {items.map((k) => (
        <li key={k}>
          <i className={`tm-key tm-key--${k}`} />
          {label[k]}
        </li>
      ))}
    </ul>
  );
}

/** Orçamento + vendas − gastos = saldo. */
export function Waterfall({ steps, compact = false }: { steps: WaterfallStep[]; compact?: boolean }) {
  const min = Math.min(0, ...steps.map((s) => s.from));
  const max = Math.max(1, ...steps.map((s) => s.to));
  const span = max - min;
  const pct = (v: number) => ((v - min) / span) * 100;
  return (
    <div className={`tm-wf ${compact ? "tm-wf--compact" : ""}`} role="img" aria-label={steps.map((s) => `${s.label} ${fmtEur(s.value)}`).join(", ")}>
      {steps.map((s) => {
        const neg = s.kind === "total" && s.value < 0;
        return (
          <div key={s.label} className={`tm-wf__row tm-wf__row--${s.kind} ${neg ? "is-neg" : ""}`}>
            <span className="tm-wf__label">{s.label}</span>
            <div className="tm-wf__track">
              {min < 0 && <i className="tm-wf__zero" style={{ left: `${pct(0)}%` }} />}
              <div
                className="tm-wf__bar"
                style={{ left: `${pct(s.from)}%`, width: `${Math.max(0.6, pct(s.to) - pct(s.from))}%` }}
                {...tip(`${s.label}: ${fmtMoney(s.value)}`)}
              />
            </div>
            <span className="tm-wf__val">
              {s.kind === "in" && s.value > 0 ? "+" : ""}
              {fmtEur(s.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Um ponto por jogador em cada posição: fica, chega, sai, com a marca do mínimo recomendado. */
export function Depth({ rows, compact = false }: { rows: DepthRow[]; compact?: boolean }) {
  return (
    <div className={`tm-depth ${compact ? "tm-depth--compact" : ""}`}>
      {rows.map((r) => {
        const have = r.stay.length + r.fresh.length;
        const pips: { p: NextPlayer; k: "stay" | "new" | "leave" }[] = [
          ...r.stay.map((p) => ({ p, k: "stay" as const })),
          ...r.fresh.map((p) => ({ p, k: "new" as const })),
        ];
        return (
          <div key={r.pos} className={`tm-depth__row ${r.short ? "is-short" : ""}`}>
            <span className={`tm-pos tm-pos--${r.pos}`}>{r.pos}</span>
            <div className="tm-depth__pips">
              {pips.map(({ p, k }, i) => (
                <span key={p.id} className="tm-depth__slot">
                  <i className={`tm-pip tm-pip--${k}`} {...tip(`${p.name} · ${k === "new" ? "chega" : "fica"}`)} />
                  {i === r.min - 1 && <b className="tm-depth__min" aria-hidden="true" />}
                </span>
              ))}
              {Array.from({ length: r.short }, (_, i) => (
                <span key={`gap${i}`} className="tm-depth__slot">
                  <i className="tm-pip tm-pip--gap" {...tip(`Falta ${r.pos}`)} />
                  {have + i === r.min - 1 && <b className="tm-depth__min" aria-hidden="true" />}
                </span>
              ))}
              {r.leave.length > 0 && <span className="tm-depth__sep" aria-hidden="true" />}
              {r.leave.map((p) => (
                <i key={p.id} className="tm-pip tm-pip--leave" {...tip(`${p.name} · sai`)} />
              ))}
            </div>
            <span className="tm-depth__n">
              {have}
              {r.short > 0 && <em title={`Faltam ${r.short}`}> −{r.short}</em>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Em que ano acabam os contratos do elenco da próxima temporada. */
export function ContractYears({ data }: { data: { label: string; count: number; names: string[] }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="tm-cols" role="img" aria-label={data.map((d) => `${d.label}: ${d.count}`).join(", ")}>
      {data.map((d) => (
        <div key={d.label} className="tm-cols__col">
          <span className="tm-cols__n">{d.count}</span>
          <div className="tm-cols__bar" style={{ height: `${(d.count / max) * 100}%` }} {...tip(`${d.label}: ${d.names.slice(0, 8).join(", ")}${d.names.length > 8 ? "…" : ""}`)} />
          <span className="tm-cols__label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Idade × valor de mercado: velhos e caros no canto direito de cima são candidatos a venda. */
export function AgeValue({ list }: { list: NextPlayer[] }) {
  const pts = list.filter((p) => p.age != null && p.value != null);
  const W = 560;
  const H = 300;
  const m = { l: 40, r: 14, t: 14, b: 34 };
  const a0 = 16;
  const a1 = Math.max(38, ...pts.map((p) => p.age!));
  const vmaxRaw = Math.max(1e6, ...pts.map((p) => p.value!));
  const step = vmaxRaw > 40e6 ? 20e6 : vmaxRaw > 16e6 ? 10e6 : vmaxRaw > 8e6 ? 5e6 : 2e6;
  const vmax = Math.ceil(vmaxRaw / step) * step;
  const x = (a: number) => m.l + ((a - a0) / (a1 - a0)) * (W - m.l - m.r);
  const y = (v: number) => H - m.b - (v / vmax) * (H - m.t - m.b);
  const ticks = Array.from({ length: Math.round(vmax / step) + 1 }, (_, i) => i * step);
  const top = [...pts].filter((p) => p.kind !== "leave").sort((a, b) => b.value! - a.value!).slice(0, 3);
  return (
    <div className="tm-scatter">
      <div className="tm-scatter__axes" aria-hidden="true"><span>↑ valor, {curUnit()} mi</span><span>idade →</span></div>
      <div className="tm-scatter__plot">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Idade e valor de mercado de cada jogador">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="tm-gl" />
            <text x={m.l - 8} y={y(t) + 5} textAnchor="end" className="tm-axis">{Math.round(toUnit(t) / 1e6).toLocaleString("pt-BR")}</text>
          </g>
        ))}
        {[18, 22, 26, 30, 34, 38].filter((a) => a <= a1).map((a) => (
          <text key={a} x={x(a)} y={H - 8} textAnchor="middle" className="tm-axis">{a}</text>
        ))}
        {top.map((p, i) => {
          const px = x(p.age!);
          const py = y(p.value!);
          // etiqueta à esquerda se bater na borda ou em outra etiqueta próxima
          const clash = top.slice(0, i).some((o) => Math.abs(y(o.value!) - py) < 18 && Math.abs(x(o.age!) - px) < 130 && x(o.age!) >= px);
          const left = px > W * 0.7 || clash;
          return (
            <text key={`l${p.id}`} x={px + (left ? -12 : 12)} y={py + 5} textAnchor={left ? "end" : "start"} className="tm-dotlabel">{p.name}</text>
          );
        })}
      </svg>
      {/* pontos em HTML: alvo de toque maior e dica ao passar o mouse */}
      {pts.map((p) => (
        <i
          key={p.id}
          className={`tm-dot tm-dot--${p.kind}`}
          style={{ left: `${(x(p.age!) / W) * 100}%`, top: `${(y(p.value!) / H) * 100}%` }}
          {...tip(`${p.name} · ${p.age} anos · ${fmtMoney(p.value)}${p.kind === "leave" ? " · sai" : p.kind === "new" ? " · chega" : ""}`)}
        />
      ))}
      </div>
    </div>
  );
}
