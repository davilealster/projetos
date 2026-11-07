import { useEffect, useRef, useState } from "react";
import { GROUP_LABEL, hasAutoLink, type Link, type LinkGroup, type LinkShape, type LinkTeam } from "../lib/links";
import { DRAW_COLORS } from "./Controls";

const GROUPS: LinkGroup[] = ["hull", "def", "mid", "att"];

export const LinkIcon = ({ size = 17 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="17" r="2.2" />
    <circle cx="12" cy="6" r="2.2" />
    <circle cx="19" cy="15" r="2.2" />
    <path d="M6.2 15.1 10.8 7.9M13.6 7.6l4.2 5.6M7.2 17.2l9.6-1.6" strokeDasharray="2 2.2" />
  </svg>
);

/** Botões liga/desliga das linhas automáticas (bloco, defesa, meio, ataque) de cada time. */
export function LinkPresets({
  links, oppName, onToggle, onClearAll,
}: {
  links: Link[];
  oppName: string;
  onToggle: (team: LinkTeam, group: LinkGroup) => void;
  onClearAll: () => void;
}) {
  const row = (team: LinkTeam, label: string) => (
    <div className="link-presets__row">
      <span className="link-presets__team">{label}</span>
      <div className="link-presets__btns">
        {GROUPS.map((g) => {
          const on = hasAutoLink(links, team, g);
          return (
            <button key={g} className={`chip-btn ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => onToggle(team, g)}>
              {g === "hull" ? "Bloco" : g === "def" ? "Defesa" : g === "mid" ? "Meio" : "Ataque"}
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <div className="link-presets">
      {row("home", "Meu time")}
      {row("opp", oppName)}
      <p className="link-presets__hint">
        As linhas seguem a tática: mudam sozinhas quando você troca a formação ou move/substitui jogadores. Para ligar
        jogadores à sua escolha, use a ferramenta <b>Ligar</b>.
      </p>
      {links.length > 0 && (
        <button className="btn btn--sm btn--ghost link-presets__clear" onClick={onClearAll}>
          Apagar todas as ligações ({links.length})
        </button>
      )}
    </div>
  );
}

/** Botão "Linhas ▾" com o menu de presets (computador e Modo Live). */
export function LinkMenu(props: Parameters<typeof LinkPresets>[0]) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", off);
    return () => window.removeEventListener("pointerdown", off);
  }, [open]);
  const count = props.links.length;
  return (
    <div className="link-menu" ref={ref}>
      <button className={`btn btn--sm ${count ? "is-on" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Linhas da tática">
        <LinkIcon size={15} /> Linhas{count ? ` (${count})` : ""} ▾
      </button>
      {open && (
        <div className="link-menu__pop" role="dialog" aria-label="Linhas da tática">
          <LinkPresets {...props} />
        </div>
      )}
    </div>
  );
}

/** Barra flutuante enquanto o usuário monta uma ligação manual. */
export function LinkDraftBar({ count, onDone, onCancel }: { count: number; onDone: () => void; onCancel: () => void }) {
  return (
    <div className="link-draftbar" role="status">
      <span>
        {count === 0
          ? "Toque nos jogadores para ligar"
          : count < 3
            ? `${count} ligado${count > 1 ? "s" : ""} · continue tocando`
            : `${count} ligados · toque no 1º para fechar a área`}
      </span>
      <button className="btn btn--sm btn--primary" onClick={onDone} disabled={count < 2}>Concluir</button>
      <button className="btn btn--sm btn--ghost" onClick={onCancel}>Cancelar</button>
    </div>
  );
}

/** Editor da ligação selecionada: estilo da linha, área, cor e apagar. Fica no centro da forma. */
export function LinkEditor({
  link, shape, vertical, onChange, onRemove, onClose,
}: {
  link: Link;
  shape: LinkShape;
  vertical: boolean;
  onChange: (patch: Partial<Link>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const off = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!ref.current?.contains(t) && !t.closest?.(".links__hit")) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.("input, select, textarea")) return;
      if (e.key === "Escape") onClose();
      if (e.key === "Delete" || e.key === "Backspace") (e.preventDefault(), onRemove());
    };
    const id = setTimeout(() => window.addEventListener("pointerdown", off), 0);
    window.addEventListener("keydown", key);
    return () => {
      clearTimeout(id);
      window.removeEventListener("pointerdown", off);
      window.removeEventListener("keydown", key);
    };
  }, [onClose, onRemove]);

  const cu = shape.pts.reduce((a, p) => a + p[0], 0) / shape.pts.length;
  const cv = shape.pts.reduce((a, p) => a + p[1], 0) / shape.pts.length;
  const left = vertical ? cv : cu;
  const top = vertical ? 1 - cu : cv;
  const canClose = link.source.type === "manual" ? shape.pts.length >= 3 : link.source.group !== "hull";
  const title = link.source.type === "auto" ? `${GROUP_LABEL[link.source.group]} · ${link.source.team === "home" ? "meu time" : "adversário"}` : "Ligação";

  return (
    <div
      ref={ref}
      className="link-editor"
      style={{ left: `${Math.min(0.85, Math.max(0.15, left)) * 100}%`, top: `${Math.min(0.88, Math.max(0.12, top)) * 100}%` }}
      role="dialog"
      aria-label="Editar ligação"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className="link-editor__title">{title}</p>
      <div className="seg">
        <button className={`seg__btn ${!link.dashed ? "is-on" : ""}`} onClick={() => onChange({ dashed: false })}>Contínua</button>
        <button className={`seg__btn ${link.dashed ? "is-on" : ""}`} onClick={() => onChange({ dashed: true })}>Pontilhada</button>
      </div>
      {canClose && (
        <label className="switch">
          <input type="checkbox" checked={link.closed} onChange={(e) => onChange({ closed: e.target.checked, fill: e.target.checked })} />
          Fechar como área
        </label>
      )}
      {link.closed && (
        <label className="switch">
          <input type="checkbox" checked={link.fill} onChange={(e) => onChange({ fill: e.target.checked })} />
          Preencher área
        </label>
      )}
      <div className="link-editor__colors">
        {DRAW_COLORS.map((c) => (
          <button key={c} className={`dot ${link.color.toLowerCase() === c.toLowerCase() ? "is-on" : ""}`} style={{ background: c }} onClick={() => onChange({ color: c })} aria-label={`Cor ${c}`} />
        ))}
        <label className="dot dot--custom" title="Outra cor">
          <input type="color" value={link.color} onChange={(e) => onChange({ color: e.target.value })} />
        </label>
      </div>
      <button className="link-editor__remove" onClick={onRemove}>Apagar ligação</button>
    </div>
  );
}
