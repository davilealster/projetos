import { useState } from "react";
import { TEAMS } from "../data";
import { navigate } from "../router";
import { cleanHandle } from "../lib/analytics";
import { getPref, setPref } from "../lib/state";
import { Footer } from "./Footer";

const SHORTCUTS: [string, string][] = [
  ["1 a 6", "Formações 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 3-4-3, 5-3-2 (as peças deslizam)"],
  ["D", "Liga/desliga o desenho (seta, passe, círculo, zona, caneta)"],
  ["B", "Borracha: clique num desenho para apagar"],
  ["E", "Apaga todos os desenhos"],
  ["C", "Limpa o campo"],
  ["H", "Esconde/mostra os controles"],
  ["S", "Mostra/esconde a lista de substituições"],
  ["Ctrl+Z", "Desfaz"],
  ["Setas", "Movem a peça selecionada (Shift = passo maior); Delete remove"],
  ["Delete", "Apaga o desenho selecionado (clique num desenho para selecionar e arraste para mover)"],
];

export function CreatorPage() {
  const [slug, setSlug] = useState("vasco");
  const [handle, setHandle] = useState(() => cleanHandle(getPref("creator")));
  const [bg, setBg] = useState("transparent");
  const [ratio, setRatio] = useState("16x9");
  const [size, setSize] = useState("M");
  const [safe, setSafe] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const h = cleanHandle(handle);
  const obsUrl = `${location.origin}/${slug}/live?bg=${bg}&ratio=${ratio}&size=${size}${safe ? "&safe=1" : ""}${h ? `&creator=@${h}` : ""}&ui=0`;
  const audienceUrl = `${location.origin}/${slug}${h ? `?creator=@${h}` : ""}`;
  const [w, hgt] = ratio === "9x16" ? [1080, 1920] : [1920, 1080];

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      prompt("Copie:", text);
    }
  };

  return (
    <div className="creator">
      <a className="back" href="/" onClick={(e) => (e.preventDefault(), navigate("/"))}>← Clubes</a>
      <header className="creator__hero">
        <p className="home__kicker">Para quem faz live</p>
        <h1 className="home__title">Prancheta <span>na sua live</span></h1>
        <p className="home__lead">
          Coloque a prancheta como fonte de navegador no OBS ou Streamlabs, monte a escalação com a audiência e desenhe a
          jogada por cima. Sem cadastro e sem custo.
        </p>
      </header>

      <section className="creator__card">
        <h2>1. Monte a sua URL</h2>
        <div className="creator__form">
          <label className="field">Clube
            <select value={slug} onChange={(e) => setSlug(e.target.value)}>
              {TEAMS.map((t) => <option key={t.slug} value={t.slug}>{t.shortName}</option>)}
            </select>
          </label>
          <label className="field">Seu @
            <input value={handle} onChange={(e) => { setHandle(e.target.value); setPref("creator", cleanHandle(e.target.value)); }} placeholder="seucanal" />
          </label>
          <label className="field">Fundo
            <select value={bg} onChange={(e) => setBg(e.target.value)}>
              <option value="transparent">Transparente (recomendado no OBS)</option>
              <option value="chroma">Chroma key verde</option>
              <option value="grass">Gramado</option>
              <option value="solid">Cor sólida</option>
            </select>
          </label>
          <label className="field">Formato
            <select value={ratio} onChange={(e) => setRatio(e.target.value)}>
              <option value="16x9">16:9 (YouTube, Twitch, Kick)</option>
              <option value="9x16">9:16 (TikTok, Reels, Shorts)</option>
            </select>
          </label>
          <label className="field">Peças
            <select value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="P">Pequenas</option>
              <option value="M">Médias</option>
              <option value="G">Grandes</option>
            </select>
          </label>
          <label className="switch">
            <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} />
            Avatares sem foto (iniciais e cores do clube)
          </label>
        </div>

        <div className="creator__url">
          <span>Browser Source ({w}x{hgt})</span>
          <code>{obsUrl}</code>
          <div className="creator__btns">
            <button className="btn btn--primary btn--sm" onClick={() => copy(obsUrl, "obs")}>{copied === "obs" ? "Copiada!" : "Copiar URL do OBS"}</button>
            <a className="btn btn--sm" href={obsUrl.replace("&ui=0", "")} target="_blank" rel="noreferrer">Abrir com controles</a>
          </div>
        </div>
        <div className="creator__url">
          <span>Link para a audiência (chat, descrição, bio)</span>
          <code>{audienceUrl}</code>
          <div className="creator__btns">
            <button className="btn btn--sm" onClick={() => copy(audienceUrl, "aud")}>{copied === "aud" ? "Copiado!" : "Copiar link da audiência"}</button>
          </div>
        </div>
      </section>

      <section className="creator__card">
        <h2>2. No OBS / Streamlabs</h2>
        <ol className="creator__steps">
          <li>Fontes → <b>+</b> → <b>Navegador</b> (Browser Source).</li>
          <li>Cole a URL, largura <b>{w}</b> e altura <b>{hgt}</b>.</li>
          <li>Para mexer nas peças durante a live, clique com o botão direito na fonte → <b>Interagir</b>. Os controles aparecem com <b>H</b>.</li>
          <li>Com fundo chroma, adicione o filtro <b>Chroma Key</b> (verde). Com transparente, não precisa.</li>
        </ol>
      </section>

      <section className="creator__card">
        <h2>3. Atalhos</h2>
        <table className="creator__keys">
          <tbody>
            {SHORTCUTS.map(([k, d]) => (
              <tr key={k}><td><kbd>{k}</kbd></td><td>{d}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="creator__card creator__card--note">
        <h2>Uso de imagens</h2>
        <p>
          Fotos de jogadores e escudos pertencem aos atletas, clubes e demais detentores. Este é um projeto independente,
          sem vínculo com CBF ou clubes. A responsabilidade pelo uso das imagens na transmissão, sobretudo em lives
          monetizadas, é de quem transmite. Se preferir evitar riscos, use <b>avatares sem foto</b> (já marcado acima).
        </p>
      </section>
      <Footer />
    </div>
  );
}
