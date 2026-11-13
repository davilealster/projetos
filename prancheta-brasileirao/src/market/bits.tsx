// Peças de papel do Mercado usadas pelas etapas (fichas, carimbos, folhas). Sem dados: entram no chunk do Mercado.
import { useEffect, useState } from "react";
import { initials } from "../lib/color";
import { FOREIGN_LIMIT, curUnit, fromUnit, toUnit, type SigningType } from "./logic";

export const SIGN_STAMP: Record<SigningType, string> = { buy: "Contratado", loan: "Empréstimo", free: "Chega livre" };

export function Sheet({ title, onClose, children, foot }: { title: string; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="tm-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="tm-sheet__body tm-psheet" onClick={(e) => e.stopPropagation()}>
        <div className="tm-psheet__head">
          <b>{title}</b>
          <button className="tm-sheet__close" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="tm-psheet__scroll">{children}</div>
        {foot && <div className="tm-psheet__foot">{foot}</div>}
      </div>
    </div>
  );
}

export const Ico = ({ d, size = 22 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
export const ICON = {
  squad: "M8 3 4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 16 3c-.6 1.6-2.2 2.6-4 2.6S8.6 4.6 8 3Z",
  market: "M3 4h2.2l2.3 11h10.8L21 7H6.4M9.5 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01",
  close: "M4 20V10m5.3 10V4m5.4 16v-7M20 20V7M3 20.5h18",
  lineup: "M4 3h16v18H4zM4 12h16M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M9 3v3h6V3M9 21v-3h6v3",
  sort: "M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3",
  filter: "M4 6h16M7 12h10M10 18h4",
};

export function Stamp({ text, ink, onClick, title }: { text: string; ink: "green" | "red" | "blue" | "amber"; onClick?: () => void; title?: string }) {
  const cls = `tm-stamp tm-stamp--${ink}`;
  return onClick ? (
    <button className={cls} onClick={onClick} title={title}>{text}</button>
  ) : (
    <span className={cls}>{text}</span>
  );
}

export function Photo({ name, photo, colors }: { name: string; photo: string | null; colors?: { primary: string; secondary: string } }) {
  const [broken, setBroken] = useState(false);
  if (photo && !broken) {
    return (
      <img
        className="tm-ficha__photo"
        src={photo}
        alt=""
        width={52}
        height={52}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className="tm-ficha__photo tm-ficha__photo--ini" style={colors ? { background: colors.primary, color: colors.secondary === colors.primary ? "#fff" : colors.secondary } : undefined}>
      {initials(name)}
    </span>
  );
}

/** Bandeira de texto para estrangeiro (conta no limite da CBF). */
export const Foreign = ({ on }: { on: boolean }) => (on ? <span className="tm-foreign" title={`Estrangeiro: até ${FOREIGN_LIMIT} podem ser relacionados por jogo`}>EST</span> : null);

export function Price({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <label className="tm-price">
      {label} {curUnit()}
      <input type="number" min={0} step={0.1} value={Math.round((toUnit(value) / 1e6) * 10) / 10} onChange={(e) => onChange(Math.round(fromUnit(Math.max(0, Number(e.target.value) || 0) * 1e6)))} />
      mi
    </label>
  );
}
