import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import { AccountButton } from "../brand/Account";
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
import { budgetLabel, progressLabel, readWindowProgress } from "./progress";

const findClub = (slug: string | null) => TEAMS.find((t) => t.slug === slug) ?? null;
const isModule = (m: string | null): m is ModuleId => m === "prancheta" || m === "mercado" || m === "olheiro";

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

/** Mini ficha de jogador com carimbo (ou etiqueta de preço). */
function FichaArt({ stamp, tone, label, price }: { stamp: string; tone: "green" | "blue"; label: string; price?: string }) {
  return (
    <div className={`mh-art mh-ficha mh-ficha--${tone}`} aria-hidden="true">
      <span className="mh-ficha__avatar">{label}</span>
      <span className="mh-ficha__bars">
        <i />
        <i />
      </span>
      {price && <span className="mh-ficha__price">{price}</span>}
      <span className={`brand-stamp brand-stamp--${tone} mh-stamp`}>{stamp}</span>
    </div>
  );
}

function Crest({ club, size, eager }: { club: TeamSummary; size: number; eager?: boolean }) {
  return club.crest ? (
    <img src={club.crest} alt="" width={size} height={size} loading={eager ? "eager" : "lazy"} decoding="async" />
  ) : (
    <span className="mh-crest__initials" style={{ width: size, height: size }}>{initials(club.name)}</span>
  );
}

const STEPS = [
  { n: "1", title: "Decida o elenco", text: "Quem fica, quem sai, quem vai emprestado.", art: <FichaArt stamp="Fica" tone="green" label="10" /> },
  { n: "2", title: "Vá às compras", text: "23 ligas, valores de mercado reais.", art: <FichaArt stamp="Chegou" tone="blue" label="9" price="€ 12 mi" /> },
  { n: "3", title: "Escale e compartilhe", text: "Gera a imagem do seu time para postar.", art: <PitchArt /> },
];

export function Home() {
  const [club] = useState<TeamSummary | null>(() => findClub(getLastClub()));
  // Links antigos (`?modulo=prancheta|olheiro`) seguem para o módulo pedido; o padrão é o mercado.
  const [target] = useState<ModuleId>(() => {
    const m = params().get("modulo");
    return isModule(m) ? m : "mercado";
  });
  const [sheet, setSheet] = useState(() => params().get("trocar") === "1");
  const progress = useMemo(() => (club ? readWindowProgress(club.slug) : null), [club]);

  useEffect(() => {
    document.title = "Meu Elenco FC — monte a janela do seu clube";
    if (location.search) replace("/");
  }, []);

  const go = (slug: string) => {
    setLastClub(slug);
    navigate(moduleHref(target, slug));
  };

  const pick = (slug: string) => {
    setSheet(false);
    if (findClub(slug)) go(slug);
  };

  const crestLink = (slug: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    setLastClub(slug);
    spaLink(moduleHref(target, slug))(e);
  };

  const done = progressLabel(progress);
  const budget = budgetLabel(progress?.budget ?? null);
  const resumeHref = club ? moduleHref(target, club.slug) : "/";

  return (
    <div className="brand mh">
      <header className="mh-top">
        <div className="mh-wrap mh-top__in">
          <BrandMark size="sm" />
          <p className="mh-top__meta">Série A 2026 · 20 clubes</p>
          <AccountButton />
        </div>
      </header>

      <main className="mh-wrap">
        <div className="mh-stage">
          <section className="mh-hero">
            <p className="brand-eyebrow">Janela de transferências 2027</p>
            <h1 className="mh-title">
              <span>Você é o diretor de futebol.</span>
              <em>Monte o seu elenco.</em>
            </h1>
            <p className="mh-sub">
              Chega de só cornetar. Escolha o seu clube, decida quem fica, quem sai e quem chega, e mostre como se faz.
            </p>
          </section>

          {club ? (
            <section className="mh-resume" style={clubVars(club.colors) as CSSProperties} aria-labelledby="mh-resume-title">
              <span className="mh-resume__stripe" aria-hidden="true" />
              <div className="mh-resume__head">
                <span className="mh-resume__crest">
                  <Crest club={club} size={56} eager />
                </span>
                <div className="mh-resume__text">
                  <p className="mh-resume__eyebrow">Sua janela 2027</p>
                  <h2 className="mh-resume__title" id="mh-resume-title">
                    Continuar a janela do <b>{club.shortName}</b>
                  </h2>
                </div>
              </div>
              <p className="mh-resume__meta">
                <span>{done ?? "Nada decidido ainda"}</span>
                {budget && <span className="mh-resume__budget">Orçamento {budget}</span>}
              </p>
              <span className={`brand-stamp ${done ? "brand-stamp--green" : "brand-stamp--amber"} mh-stamp mh-resume__stamp`} aria-hidden="true">
                {done ? "Em andamento" : "Janela aberta"}
              </span>
              <div className="mh-resume__actions">
                <a className="brand-btn brand-btn--brass mh-resume__go" href={resumeHref} onClick={spaLink(resumeHref)}>
                  Continuar <span aria-hidden="true">→</span>
                </a>
                <button type="button" className="mh-resume__swap" onClick={() => setSheet(true)} aria-haspopup="dialog">
                  Trocar de clube
                </button>
              </div>
            </section>
          ) : (
            <section className="mh-pick" aria-labelledby="mh-pick-title">
              <header className="mh-pick__head">
                <span className="mh-pick__step">1º passo</span>
                <h2 className="mh-pick__title" id="mh-pick-title">Escolha o seu clube</h2>
                <p className="mh-pick__hint">Toque no escudo e a janela abre.</p>
              </header>
              <ul className="mh-grid">
                {TEAMS.map((t, i) => (
                  <li key={t.slug} style={{ "--i": i } as CSSProperties}>
                    <a className="mh-club" href={moduleHref(target, t.slug)} onClick={crestLink(t.slug)} aria-label={t.name}>
                      <span className="mh-club__crest">
                        <Crest club={t} size={40} eager />
                      </span>
                      <span className="mh-club__name" aria-hidden="true">{t.shortName}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section className="mh-how" aria-labelledby="mh-how-title">
          <h2 className="mh-how__title" id="mh-how-title">Como funciona</h2>
          <ol className="mh-steps">
            {STEPS.map((s) => (
              <li key={s.n} className="mh-stepcard">
                {s.art}
                <span className="mh-stepcard__n" aria-hidden="true">{s.n}</span>
                <span className="mh-stepcard__body">
                  <span className="mh-stepcard__title">{s.title}</span>
                  <span className="mh-stepcard__text">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="mh-wrap mh-foot">
        <nav className="mh-foot__links" aria-label="Outras ferramentas">
          <a href="/prancheta" onClick={spaLink("/prancheta")}>Ferramenta extra: Prancheta tática →</a>
          <a href="/creator" onClick={spaLink("/creator")}>Faz live? Use a prancheta na transmissão</a>
        </nav>
        <p>Projeto independente, sem vínculo com CBF ou clubes. Imagens pertencem aos respectivos detentores.</p>
      </footer>

      <ClubSheet
        open={sheet}
        current={club?.slug ?? null}
        title={club ? "Trocar de clube" : "Qual é o seu clube?"}
        onPick={pick}
        onClose={() => setSheet(false)}
      />
    </div>
  );
}
