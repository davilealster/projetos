import { useMemo, useState } from "react";
import { TEAMS } from "../data";
import { navigate } from "../router";
import { clubVars } from "../lib/color";
import { applyTeamSummary, useOverrides } from "../lib/overrides";
import { Footer } from "./Footer";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function TeamPicker() {
  const [q, setQ] = useState("");
  const doc = useOverrides();
  const list = useMemo(
    () =>
      TEAMS.map((t) => applyTeamSummary(t, doc)).filter((t) =>
        norm(`${t.name} ${t.shortName} ${t.slug}`).includes(norm(q.trim())),
      ),
    [q, doc],
  );
  return (
    <div className="home">
      <header className="home__hero">
        <p className="home__kicker">Série A 2026 · 20 clubes</p>
        <h1 className="home__title">
          Prancheta <span>Brasileirão</span>
        </h1>
        <p className="home__lead">Escolha o seu time, arraste os jogadores e monte a escalação. Sem cadastro.</p>
        <input
          className="home__search"
          type="search"
          placeholder="Buscar clube…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar clube"
        />
      </header>
      <ul className="crest-grid">
        {list.map((t) => (
          <li key={t.slug}>
            <a
              href={`/${t.slug}`}
              className="crest-card"
              style={clubVars(t.colors) as React.CSSProperties}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey) return;
                e.preventDefault();
                navigate(`/${t.slug}`);
              }}
            >
              {t.crest ? <img src={t.crest} alt="" width={96} height={96} /> : <span className="crest-card__ph" />}
              <span className="crest-card__name">{t.shortName}</span>
            </a>
          </li>
        ))}
        {!list.length && <li className="crest-grid__empty">Nenhum clube com “{q}”.</li>}
      </ul>
      <Footer />
    </div>
  );
}
