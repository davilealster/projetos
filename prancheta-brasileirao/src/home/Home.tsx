import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";
import { BrandMark, spaLink } from "../brand/BrandMark";
import "../brand/brand.css";
import { ClubSheet } from "../brand/ClubSheet";
import { moduleHref, type ModuleId } from "../brand/nav";
import "./home.css";
import { TEAMS } from "../data";
import { clubVars, initials } from "../lib/color";
import { getLastClub, setLastClub } from "../lib/lastClub";
import { navigate, params, replace } from "../router";
import type { TeamSummary } from "../types";

const findClub = (slug: string | null) => TEAMS.find((t) => t.slug === slug) ?? null;

/** Mini prancheta (decorativa): campo, 5 fichas e a seta da jogada. */
function PitchArt() {
  return (
    <div className="mh-art mh-pitch" aria-hidden="true">
      <i className="mh-pitch__half" />
      <i className="mh-pitch__circle" />
      <i className="mh-pitch__box mh-pitch__box--l" />
      <i className="mh-pitch__box mh-pitch__box--r" />
      <svg className="mh-pitch__arrow" viewBox="0 0 120 84" preserveAspectRatio="none">
        <defs>
          <marker id="mh-arrowhead" viewBox="0 0 8 8" refX="5" refY="4" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" fill="#efe6d2" />
          </marker>
        </defs>
        <path d="M47 54 Q 70 52 88 30" fill="none" stroke="#efe6d2" strokeWidth="1.6" strokeDasharray="3 3" markerEnd="url(#mh-arrowhead)" />
      </svg>
      <b className="mh-tok" style={{ left: "14%", top: "50%" }} />
      <b className="mh-tok" style={{ left: "34%", top: "24%" }} />
      <b className="mh-tok" style={{ left: "30%", top: "78%" }} />
      <b className="mh-tok" style={{ left: "62%", top: "70%" }} />
      <b className="mh-tok mh-tok--brass" style={{ left: "39%", top: "64%" }} />
    </div>
  );
}

/** Mini ficha de jogador com o carimbo "Renovado". */
function FichaArt() {
  return (
    <div className="mh-art mh-ficha" aria-hidden="true">
      <span className="mh-ficha__avatar">10</span>
      <span className="mh-ficha__bars">
        <i />
        <i />
      </span>
      <span className="brand-stamp brand-stamp--green mh-stamp">Renovado</span>
    </div>
  );
}

function Crest({ club, size }: { club: TeamSummary; size: number }) {
  return club.crest ? (
    <img src={club.crest} alt="" width={size} height={size} loading="lazy" decoding="async" />
  ) : (
    <span className="mh-crest__initials" style={{ width: size, height: size }}>{initials(club.name)}</span>
  );
}

const isModule = (m: string | null): m is ModuleId => m === "prancheta" || m === "mercado";

export function Home() {
  const [club, setClub] = useState<TeamSummary | null>(() => findClub(getLastClub()));
  // Folha de clubes: `module` = para onde ir depois da escolha (null = só salvar o clube).
  const [sheet, setSheet] = useState<{ module: ModuleId | null } | null>(() => {
    const q = params();
    const m = q.get("modulo");
    return q.get("trocar") === "1" ? { module: isModule(m) ? m : null } : null;
  });

  useEffect(() => {
    document.title = "Meu Elenco FC — o clube é seu";
    if (location.search) replace("/");
  }, []);

  const pick = (slug: string) => {
    const next = findClub(slug);
    const target = sheet?.module ?? null;
    setSheet(null);
    if (!next) return;
    setClub(next);
    setLastClub(next.slug);
    if (target) navigate(moduleHref(target, next.slug));
  };

  /** Crachá sem clube salvo: abre a folha e segue para o módulo depois da escolha. */
  const enter = (module: ModuleId) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (club) return spaLink(moduleHref(module, club.slug))(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setSheet({ module });
  };

  const boardHref = club ? moduleHref("prancheta", club.slug) : "/?modulo=prancheta&trocar=1";
  const marketHref = club ? moduleHref("mercado", club.slug) : "/?modulo=mercado&trocar=1";
  const clubStyle = (club ? clubVars(club.colors) : undefined) as CSSProperties | undefined;

  return (
    <div className="brand mh">
      <header className="mh-top">
        <div className="mh-wrap mh-top__in">
          <BrandMark size="sm" />
          <p className="mh-top__meta">Série A 2026 · 20 clubes</p>
        </div>
      </header>

      <main className="mh-wrap">
        <section className="mh-hero">
          <p className="brand-eyebrow">As chaves do clube estão com você</p>
          <h1 className="mh-title">
            O clube é seu.
            <br />
            <em>Você decide.</em>
          </h1>
          <p className="mh-sub">
            Chega de só cornetar. Assuma a cadeira, monte a barca, desenhe a tática e mostre como se faz.
            <br />
            Escolha seu papel: no campo como técnico ou no mercado como diretor de futebol.
          </p>
        </section>

        {club && (
          <div className="mh-continue" style={clubStyle} aria-live="polite">
            <span className="mh-continue__crest">
              <Crest club={club} size={30} />
            </span>
            <p className="mh-continue__text">
              <span className="mh-continue__eyebrow">Seu clube</span>
              <span className="mh-continue__name">Continuar com o {club.shortName}</span>
            </p>
            <button type="button" className="mh-continue__swap" onClick={() => setSheet({ module: null })} aria-haspopup="dialog">
              Trocar
            </button>
          </div>
        )}

        <ul className="mh-cards" style={clubStyle}>
          <li>
            <a className="mh-card mh-card--coach" href={boardHref} onClick={enter("prancheta")} aria-haspopup={club ? undefined : "dialog"}>
              <span className="mh-card__label">Crachá 01 · Comissão técnica</span>
              <PitchArt />
              <span className="mh-card__body">
                <span className="mh-card__title">Técnico</span>
                <span className="mh-card__module">Prancheta tática</span>
                <span className="mh-card__text">Monte a escalação, arraste os jogadores e desenhe a jogada.</span>
              </span>
              <span className="mh-card__cta">
                {club && <Crest club={club} size={20} />}
                <span>{club ? `Abrir a prancheta do ${club.shortName}` : "Abrir a prancheta"}</span>
                <span className="mh-card__arrow" aria-hidden="true">→</span>
              </span>
            </a>
          </li>
          <li>
            <a className="mh-card mh-card--director" href={marketHref} onClick={enter("mercado")} aria-haspopup={club ? undefined : "dialog"}>
              <span className="mh-card__label">Crachá 02 · Diretoria</span>
              <FichaArt />
              <span className="mh-card__body">
                <span className="mh-card__title">Diretor de futebol</span>
                <span className="mh-card__module">Mercado da bola</span>
                <span className="mh-card__text">Defina o orçamento, carimbe quem fica e quem sai e vá às compras.</span>
              </span>
              <span className="mh-card__cta">
                {club && <Crest club={club} size={20} />}
                <span>{club ? `Abrir o mercado do ${club.shortName}` : "Abrir o mercado"}</span>
                <span className="mh-card__arrow" aria-hidden="true">→</span>
              </span>
            </a>
          </li>
          <li>
            <div className="mh-card mh-card--soon" aria-disabled="true">
              <span className="mh-card__label">Crachá 03 · Scout</span>
              <span className="mh-card__body">
                <span className="mh-card__title">Olheiro</span>
                <span className="mh-card__text">Faça o papel de scout: monitore o mercado e encontre oportunidades antes dos outros.</span>
              </span>
              <span className="brand-stamp brand-stamp--amber mh-stamp mh-card__soon">Em breve</span>
            </div>
          </li>
        </ul>

        {!club && (
          <section className="mh-clubs" aria-label="Seu clube">
            <button type="button" className="brand-btn brand-btn--brass mh-clubs__pick" onClick={() => setSheet({ module: null })} aria-haspopup="dialog">
              Escolher meu clube
            </button>
            <p className="mh-clubs__help">Opcional — você também pode escolher ao abrir a prancheta ou o mercado.</p>
          </section>
        )}
      </main>

      <footer className="mh-wrap mh-foot">
        <p>Projeto independente, sem vínculo com CBF ou clubes. Imagens pertencem aos respectivos detentores.</p>
        <a href="/creator" onClick={spaLink("/creator")}>Faz live? Use a prancheta na transmissão</a>
      </footer>

      <ClubSheet
        open={sheet !== null}
        current={club?.slug ?? null}
        title={club ? "Trocar de clube" : "Qual é o seu clube?"}
        onPick={pick}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}
