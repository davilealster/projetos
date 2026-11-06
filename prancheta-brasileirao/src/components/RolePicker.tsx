import { useEffect, useRef } from "react";
import { POSITIONS, type Player, type Pos, type Token } from "../types";

const LABEL: Record<Pos, string> = {
  GOL: "Goleiro",
  ZAG: "Zagueiro",
  LD: "Lateral direito",
  LE: "Lateral esquerdo",
  VOL: "Volante",
  MEI: "Meia",
  PON: "Ponta",
  ATA: "Atacante",
};

/** Popover para escolher em que posição o jogador atua nesta escalação. */
export function RolePicker({
  player, token, vertical, onPick, onRemove, onClose,
}: {
  player: Player;
  token: Token;
  vertical: boolean;
  onPick: (pos: Pos) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const current = token.as ?? player.pos;
  const alts = (player.alt ?? []).filter((a) => a !== player.pos);
  const others = POSITIONS.filter((p) => p !== player.pos && !alts.includes(p));
  const left = vertical ? token.v : token.u;
  const top = vertical ? 1 - token.u : token.v;

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // adia para não fechar com o mesmo clique que abriu
    const id = setTimeout(() => window.addEventListener("pointerdown", down), 0);
    window.addEventListener("keydown", key);
    ref.current?.querySelector<HTMLButtonElement>("button.is-on, button")?.focus();
    return () => {
      clearTimeout(id);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);

  const btn = (p: Pos, kind: string) => (
    <button
      key={p}
      className={`role-btn role-btn--${kind} pos-badge--${p} ${current === p ? "is-on" : ""}`}
      onClick={() => onPick(p)}
      title={LABEL[p]}
    >
      <b>{p}</b>
      {kind !== "other" && <span>{LABEL[p]}</span>}
    </button>
  );

  return (
    <div
      ref={ref}
      className={`role-picker ${top < 0.32 ? "role-picker--below" : ""} ${left < 0.18 ? "role-picker--left" : left > 0.82 ? "role-picker--right" : ""}`}
      style={{ left: `${left * 100}%`, top: `${top * 100}%` }}
      role="dialog"
      aria-label={`Posição de ${player.name}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className="role-picker__title">{player.name}</p>
      <div className="role-picker__main">
        {btn(player.pos, "main")}
        {alts.map((a) => btn(a, "alt"))}
      </div>
      <div className="role-picker__others" aria-label="Outras posições">
        {others.map((p) => btn(p, "other"))}
      </div>
      <button className="role-picker__remove" onClick={onRemove}>Tirar do campo</button>
    </div>
  );
}
