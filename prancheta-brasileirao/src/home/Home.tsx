import { useEffect, useState, type CSSProperties } from "react";
import { BrandMark, spaLink } from "../brand/BrandMark";
import "../brand/brand.css";
import "./home.css";
import { TEAMS } from "../data";
import { clubVars, initials } from "../lib/color";
import { getLastClub, setLastClub } from "../lib/lastClub";
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

export function Home() {
  const [club, setClub] = useState<TeamSummary | null>(() => findClub(getLastClub()));

  useEffect(() => {
    document.title = "Mando — o clube é seu";
  }, []);

  const choose = (next: TeamSummary | null) => {
    setClub(next);
    setLastClub(next?.slug ?? null);
  };

  const boardHref = club ? `/${club.slug}` : "/prancheta";
  const marketHref = club ? `/mercado/${club.slug}` : "/mercado";
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
            Escolha o seu papel: no campo como técnico ou no mercado como diretor de futebol. Sem cadastro.
          </p>
        </section>

        <ul className="mh-cards" style={clubStyle}>
          <li>
            <a className="mh-card mh-card--coach" href={boardHref} onClick={spaLink(boardHref)}>
              <span className="mh-card__label">Crachá 01 · Comissão técnica</span>
              <PitchArt />
              <span className="mh-card__body">
                <span className="mh-card__title">Técnico</span>
                <span className="mh-card__module">Prancheta tática</span>
                <span className="mh-card__text">Monte a escalação, arraste os jogadores e desenhe a jogada.</span>
              </span>
              <span className="mh-card__cta">
                {club && <Crest club={club} size={20} />}
                <span>{club ? `Escalar o ${club.shortName}` : "Abrir a prancheta"}</span>
                <span className="mh-card__arrow" aria-hidden="true">→</span>
              </span>
            </a>
          </li>
          <li>
            <a className="mh-card mh-card--director" href={marketHref} onClick={spaLink(marketHref)}>
              <span className="mh-card__label">Crachá 02 · Diretoria</span>
              <FichaArt />
              <span className="mh-card__body">
                <span className="mh-card__title">Diretor de futebol</span>
                <span className="mh-card__module">Mercado da bola</span>
                <span className="mh-card__text">Defina o orçamento, carimbe quem fica e quem sai e vá às compras.</span>
              </span>
              <span className="mh-card__cta">
                {club && <Crest club={club} size={20} />}
                <span>{club ? `Abrir a janela do ${club.shortName}` : "Abrir o mercado"}</span>
                <span className="mh-card__arrow" aria-hidden="true">→</span>
              </span>
            </a>
          </li>
          <li>
            <div className="mh-card mh-card--soon" aria-disabled="true">
              <span className="mh-card__label">Crachá 03</span>
              <span className="mh-card__body">
                <span className="mh-card__title">Presidente</span>
                <span className="mh-card__text">Novos módulos a caminho.</span>
              </span>
              <span className="brand-stamp brand-stamp--amber mh-stamp mh-card__soon">Em breve</span>
            </div>
          </li>
        </ul>

        <section className="mh-clubs" aria-labelledby="mh-clubs-title">
          <div className="mh-clubs__head">
            <h2 id="mh-clubs-title">Qual é o seu clube?</h2>
            {club && (
              <p className="mh-clubs__current" aria-live="polite">
                Seu clube: <b>{club.name}</b>
                <button type="button" className="mh-clubs__clear" onClick={() => choose(null)}>
                  trocar
                </button>
              </p>
            )}
          </div>
          <div className="mh-crests">
            {TEAMS.map((t) => {
              const on = club?.slug === t.slug;
              return (
                <button
                  key={t.slug}
                  type="button"
                  className={`mh-crest${on ? " is-on" : ""}`}
                  aria-pressed={on}
                  aria-label={t.name}
                  title={t.name}
                  onClick={() => choose(on ? null : t)}
                >
                  <Crest club={t} size={34} />
                </button>
              );
            })}
          </div>
          <p className="mh-clubs__help">Opcional — você também pode escolher depois.</p>
        </section>
      </main>

      <footer className="mh-wrap mh-foot">
        <p>Projeto independente, sem vínculo com CBF ou clubes. Imagens pertencem aos respectivos detentores.</p>
        <a href="/creator" onClick={spaLink("/creator")}>Faz live? Use a prancheta na transmissão</a>
      </footer>
    </div>
  );
}
