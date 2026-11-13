// Perfil do jogador ("Ver scout"): percentis da posição, por 90 e totais, contexto da amostra, índices, Minha lista e anotação.
import { fmtDate, fmtEur, fmtRef, FOREIGN_LIMIT } from "../market/logic";
import { EXPORT_COEF_MAX, MIN_SAMPLE, cardPoints, per90, seasonLabel, type ScoutPlayer } from "./metrics";
import { PLAN_LETTERS, isSaved, maxPriority, planOf, type ScoutAction, type ScoutState } from "./state";
import { Drawer, Face, Ico, ICON, PctBar, ScoreStamp, Trend } from "./ui";

const POS_NAME: Record<string, string> = {
  GOL: "goleiros", ZAG: "zagueiros", LD: "laterais direitos", LE: "laterais esquerdos", VOL: "volantes", MEI: "meias", PON: "pontas", ATA: "atacantes",
};

const n0 = (v: number) => v.toLocaleString("pt-BR");
const d2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = {
  x: ScoutPlayer;
  st: ScoutState;
  dispatch: (a: ScoutAction) => void;
  onClose: () => void;
  /** chega livre (contrato acaba antes da próxima temporada) */
  free: boolean;
  contractCut: string;
  /** jogador do próprio elenco: sem "Minha lista" */
  own?: boolean;
  /** rodapé (ex.: comprar / emprestar), opcional */
  foot?: React.ReactNode;
};

export function PlayerSheet({ x, st, dispatch, onClose, free, contractCut, own = false, foot }: Props) {
  const s = x.stats;
  const saved = isSaved(st, x.key);
  const plan = planOf(st, x.key);
  const cutText = fmtDate(contractCut);

  return (
    <Drawer label={`Perfil de ${x.name}`} onClose={onClose} foot={foot}>
      <article className="sc-profile">
        <header className="sc-profile__head">
          <Face name={x.name} photo={x.photo} size={64} />
          <div className="sc-profile__id">
            <p className="tm-eyebrow">Relatório do olheiro · {x.leagueName}</p>
            <h2>{x.name}</h2>
            <p className="sc-profile__meta">
              <span className={`tm-pos tm-pos--${x.pos}`}>{x.pos}</span>
              {x.foreign && <span className="tm-foreign" title={`Estrangeiro: até ${FOREIGN_LIMIT} relacionados por jogo`}>EST</span>}
              <span>{x.age != null ? `${x.age} anos` : "idade ?"}{x.nat ? ` · ${x.nat}` : ""}</span>
            </p>
            <p className="sc-profile__club">{x.club}{x.loanFrom ? ` · emprestado pelo ${x.loanFrom}` : ""}</p>
          </div>
          <ScoreStamp x={x} big />
        </header>

        <dl className="sc-facts">
          <div>
            <dt>Valor</dt>
            <dd>{fmtEur(x.value)}{fmtRef(x.value) && <small>{fmtRef(x.value)}</small>}</dd>
          </div>
          <div>
            <dt>12 meses</dt>
            <dd>{x.m.trend == null ? <span className="sc-dim">sem histórico</span> : <Trend t={x.m.trend} />}{s?.value12m ? <small>era {fmtEur(s.value12m)}</small> : null}</dd>
          </div>
          <div>
            <dt>Pico</dt>
            <dd>{s?.valuePeak ? fmtEur(s.valuePeak) : "—"}{x.m.fromPeak ? <small>{x.m.fromPeak}% abaixo</small> : x.m.fromPeak === 0 ? <small>no pico</small> : null}</dd>
          </div>
          <div>
            <dt>Contrato</dt>
            <dd className={free ? "is-free" : ""}>{fmtDate(x.contract)}{free && <small>chega livre</small>}</dd>
          </div>
        </dl>

        <section className="sc-sec">
          <h3>Na temporada {seasonLabel(x.league, x.season)}</h3>
          {s ? (
            <p className={`sc-sample ${x.m.sample ? "" : "is-small"}`}>
              <b>{n0(s.min)} min</b> de {n0(x.maxMin)} possíveis na liga ({Math.round(x.m.minPct * 100)}%) · {s.apps} jogos
              {s.minAll > s.min && <> · {n0(s.minAll)} min em todas as competições</>}
              {!x.m.sample && <em>Amostra pequena: abaixo de {MIN_SAMPLE} min, fica fora dos rankings e sem percentil.</em>}
            </p>
          ) : (
            <p className="sc-sample is-small"><em>Sem estatísticas desta temporada na liga. Só os dados de mercado.</em></p>
          )}
        </section>

        {s && (
          <section className="sc-sec">
            <h3>Percentil entre os {POS_NAME[x.pos]} · {x.group}</h3>
            <div className="sc-bars">
              {x.m.indicators.map((r) => <PctBar key={r.id} r={r} />)}
            </div>
          </section>
        )}

        {s && (
          <section className="sc-sec">
            <h3>Números</h3>
            <table className="sc-nums">
              <thead>
                <tr><th /><th>Total</th><th>Por 90</th></tr>
              </thead>
              <tbody>
                <tr><th>Gols</th><td>{s.goals}</td><td>{d2(per90(s.goals, s.min))}</td></tr>
                <tr><th>Assistências</th><td>{s.assists}</td><td>{d2(per90(s.assists, s.min))}</td></tr>
                <tr><th>Gols sofridos com ele em campo</th><td>{s.conceded}</td><td>{d2(per90(s.conceded, s.min))}</td></tr>
                <tr><th>Jogos sem sofrer gol</th><td>{s.cleanSheets}</td><td>{s.apps ? `${Math.round((100 * s.cleanSheets) / s.apps)}%` : "—"}</td></tr>
                <tr><th>Cartões (amarelos / vermelhos)</th><td>{s.yc} / {s.rc}</td><td>{d2(per90(cardPoints(s), s.min))}</td></tr>
              </tbody>
            </table>
          </section>
        )}

        {s && (
        <section className="sc-sec">
          <h3>Índices</h3>
          <ul className="sc-idx">
            <li>
              <b>{x.m.value4money ?? "—"}</b>
              <span><strong>Custo-benefício</strong> Nota por euro investido, em percentil entre os {POS_NAME[x.pos]}.</span>
            </li>
            <li className={x.m.gem ? "is-on" : ""}>
              <b>{x.m.potential ?? "—"}</b>
              <span><strong>Potencial{x.m.gem ? " · Joia" : ""}</strong> Nota + bônus de idade (sub-23) e de titular jovem. Joia: sub-21 com 70+ ou sub-23 com 80+.</span>
            </li>
            <li className={x.m.contractChance ? "is-on" : ""}>
              <b>{x.m.contractChance ? "Sim" : "Não"}</b>
              <span><strong>Oportunidade de contrato</strong> Contrato acaba até {cutText} e nota 60+.</span>
            </li>
            <li className={x.m.undervalued ? "is-on" : ""}>
              <b>{x.m.undervalued ? "Sim" : "Não"}</b>
              <span><strong>Subvalorizado</strong> Nota 75+ e valor abaixo da mediana da posição na liga{x.m.posMedianValue ? ` (${fmtEur(x.m.posMedianValue)})` : ""}.</span>
            </li>
            <li className={x.m.exportLeague ? "is-on" : ""}>
              <b>{x.m.coef.toFixed(2).replace(".", ",")}</b>
              <span><strong>Liga de exportação{x.m.exportLeague ? " · Sim" : ""}</strong> Coeficiente da liga (Premier = 1,00). Nota 70+ numa liga de até {EXPORT_COEF_MAX.toFixed(2).replace(".", ",")} é achado fora do radar.</span>
            </li>
          </ul>
          {x.m.risks.length > 0 && (
            <p className="sc-risks"><b>Riscos:</b> {x.m.risks.map((r) => r.label).join(" · ")}</p>
          )}
        </section>
        )}

        {!own && (
          <section className="sc-sec sc-desk">
            <h3>Minha lista</h3>
            {saved ? (
              <>
                <div className="sc-shelfpick" role="radiogroup" aria-label={`Prioridade de ${x.name}`}>
                  {[0, 1, 2, null].map((p) => {
                    const on = p == null ? !plan : plan?.index === p;
                    return (
                      <button
                        key={String(p)}
                        role="radio"
                        aria-checked={on}
                        disabled={p != null && p > maxPriority(st, x.pos, x.key)}
                        className={`sc-shelfbtn sc-shelfbtn--${p == null ? "blue" : p === 0 ? "green" : "amber"} ${on ? "is-on" : ""}`}
                        onClick={() => dispatch({ type: "list/priority", pos: x.pos, key: x.key, prio: p })}
                      >
                        {p == null ? "Observando" : `Plano ${PLAN_LETTERS[p]}`}
                      </button>
                    );
                  })}
                </div>
                <p className="sc-small sc-dim">
                  {plan ? `Plano ${PLAN_LETTERS[plan.index]} entre os ${POS_NAME[x.pos]} da sua lista.` : "Só observando, sem prioridade."}{" "}
                  <button className="tm-link sc-unsave" onClick={() => dispatch({ type: "list/remove", key: x.key })}>Tirar da lista</button>
                </p>
              </>
            ) : (
              <button className="tm-btn sc-wide sc-savebtn" onClick={() => dispatch({ type: "list/save", key: x.key })}>
                <Ico d={ICON.plus} size={18} /> Guardar na lista
              </button>
            )}
            <label className="sc-input">
              Sua anotação
              <textarea rows={3} maxLength={500} value={st.notes[x.key] ?? ""} placeholder="O que você viu: bom de cabeça, joga pelos dois lados…" onChange={(e) => dispatch({ type: "note", key: x.key, text: e.target.value })} />
            </label>
          </section>
        )}

        <p className="sc-fine">
          Dados do Transfermarkt: jogos, minutos, gols, assistências, cartões e gols sofridos com o jogador em campo. Sem xG, desarmes
          ou passes. Percentis comparam com a mesma posição no grupo {x.group}, só quem tem {MIN_SAMPLE}+ min.
        </p>
      </article>
    </Drawer>
  );
}
