import { useCallback, useEffect, useMemo, useState } from "react";
import { TEAMS } from "../data";
import { BrandMark } from "../brand/BrandMark";
import { applyTeamSummary, type OverridesDoc, type PlayerOverride, type TeamOverride } from "../lib/overrides";
import { POSITIONS, type Colors, type Pos } from "../types";
import { Avatar } from "../components/Avatar";
import { adminApi, loadAdminTeam, type AdminPlayer } from "./api";

// ============ raiz: sessão ============

export default function AdminApp() {
  const [user, setUser] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    document.title = "Admin · Meu Elenco FC";
    adminApi.me().then((r) => setUser(r.user)).catch(() => setUser(null));
  }, []);
  if (user === undefined) return <div className="admin-loading">Carregando…</div>;
  if (!user) return <Login onLogin={setUser} />;
  return <Panel user={user} onUser={setUser} />;
}

function Login({ onLogin }: { onLogin: (u: string) => void }) {
  const [user, setUser] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="admin-login">
      <form
        className="admin-login__card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            onLogin((await adminApi.login(user, password)).user);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="home__kicker">Meu Elenco FC</p>
        <h1>Painel admin</h1>
        <label>
          Usuário
          <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Senha
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required autoFocus />
        </label>
        {error && <p className="admin-error">{error}</p>}
        <button className="btn btn--primary btn--lg" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
        <BrandMark size="sm" />
      </form>
    </div>
  );
}

// ============ painel ============

type Filter = "todos" | "pendentes" | "genericos" | "ocultos";

function Panel({ user, onUser }: { user: string; onUser: (u: string | null) => void }) {
  const [doc, setDoc] = useState<OverridesDoc | null>(null);
  const [slug, setSlug] = useState(() => new URLSearchParams(location.search).get("time") ?? "vasco");
  const [counts, setCounts] = useState<Record<string, { total: number; pending: number }>>({});
  const [showPw, setShowPw] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.overrides().then(setDoc).catch((e) => setLoadError((e as Error).message));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  // contagem de pendentes por time (barra lateral)
  useEffect(() => {
    if (!doc) return;
    Promise.all(TEAMS.map(async (t) => [t.slug, await loadAdminTeam(t.slug)] as const)).then((all) => {
      setCounts(
        Object.fromEntries(
          all.map(([s, d]) => [s, { total: d.players.length, pending: d.players.filter((p) => !doc.players[String(p.id)]?.reviewed).length }]),
        ),
      );
    });
  }, [doc]);

  const pick = (s: string) => {
    setSlug(s);
    history.replaceState(null, "", `/admin?time=${s}`);
  };

  if (loadError) return <div className="admin-loading">Erro ao carregar os ajustes: {loadError}</div>;
  if (!doc) return <div className="admin-loading">Carregando ajustes…</div>;

  return (
    <div className="admin">
      <header className="admin__top">
        <BrandMark size="sm" />
        <h1>Painel admin</h1>
        <span className="admin__meta">
          {doc.updatedAt ? `Última alteração: ${new Date(doc.updatedAt).toLocaleString("pt-BR")}` : "Nenhuma alteração ainda"}
        </span>
        <div className="admin__actions">
          <button
            className="btn btn--sm"
            onClick={() => {
              const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `ajustes-admin-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
            }}
            title="Baixar todos os ajustes (backup)"
          >
            Exportar JSON
          </button>
          <button className="btn btn--sm" onClick={() => setShowPw(true)}>Trocar senha</button>
          <span className="admin__user">{user}</span>
          <button className="btn btn--sm btn--ghost" onClick={async () => { await adminApi.logout(); onUser(null); }}>Sair</button>
        </div>
      </header>

      <div className="admin__body">
        <nav className="admin__teams" aria-label="Clubes">
          {TEAMS.map((t0) => {
            const t = applyTeamSummary(t0, doc);
            const c = counts[t.slug];
            return (
              <button key={t.slug} className={`admin-team ${slug === t.slug ? "is-on" : ""}`} onClick={() => pick(t.slug)}>
                {t.crest && <img src={t.crest} alt="" width={24} height={24} />}
                <span>{t.shortName}</span>
                {c && <em className={c.pending ? "" : "is-done"} title="Jogadores ainda não revisados">{c.pending || "✓"}</em>}
              </button>
            );
          })}
        </nav>
        <TeamEditor key={slug} slug={slug} doc={doc} onDoc={setDoc} onToast={setToast} />
      </div>

      {showPw && <PasswordDialog user={user} onClose={() => setShowPw(false)} onDone={(u) => { onUser(u); setShowPw(false); setToast("Senha alterada"); }} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ============ edição de um time ============

interface Row {
  name: string;
  number: string;
  pos: Pos;
  alt1: Pos | "";
  alt2: Pos | "";
  hide: boolean;
  reviewed: boolean;
}

const SOURCE_LABEL: Record<AdminPlayer["source"], string> = {
  override: "manual",
  draft: "Wikipédia",
  sportsdb: "TheSportsDB",
  api: "API (genérica)",
};

function rowFrom(p: AdminPlayer, ov: PlayerOverride | undefined): Row {
  const pos = ov?.pos ?? p.pos;
  const alt = (ov?.alt ?? p.alt).filter((a) => a !== pos);
  return {
    name: ov?.displayName ?? p.name,
    number: String((ov?.number !== undefined ? ov.number : p.number) ?? ""),
    pos,
    alt1: alt[0] ?? "",
    alt2: alt[1] ?? "",
    hide: ov?.hide ?? p.hidden,
    reviewed: !!ov?.reviewed,
  };
}

/** Converte a linha editada em ajuste (só o que difere do dado base). null = sem ajuste. */
function overrideFrom(p: AdminPlayer, r: Row): PlayerOverride | null {
  const o: PlayerOverride = {};
  const alt = [r.alt1, r.alt2].filter((a): a is Pos => !!a && a !== r.pos);
  const uniqAlt = alt.filter((a, i) => alt.indexOf(a) === i);
  const num = r.number.trim() === "" ? null : Number(r.number);
  if (r.pos !== p.pos) o.pos = r.pos;
  if (uniqAlt.join() !== p.alt.join() || o.pos) o.alt = uniqAlt;
  if (r.name.trim() && r.name.trim() !== p.name) o.displayName = r.name.trim();
  if (num !== p.number) o.number = num;
  if (r.hide !== p.hidden) o.hide = r.hide;
  if (r.reviewed) o.reviewed = true;
  return Object.keys(o).length ? o : null;
}

const same = (a: Row, b: Row) => JSON.stringify(a) === JSON.stringify(b);

function TeamEditor({ slug, doc, onDoc, onToast }: {
  slug: string;
  doc: OverridesDoc;
  onDoc: (d: OverridesDoc) => void;
  onToast: (s: string) => void;
}) {
  const [players, setPlayers] = useState<AdminPlayer[] | null>(null);
  const [rows, setRows] = useState<Record<number, Row>>({});
  const [filter, setFilter] = useState<Filter>("todos");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const team = applyTeamSummary(TEAMS.find((t) => t.slug === slug)!, doc);

  const initial = useMemo(() => {
    if (!players) return {};
    return Object.fromEntries(players.map((p) => [p.id, rowFrom(p, doc.players[String(p.id)])]));
  }, [players, doc]);

  useEffect(() => {
    loadAdminTeam(slug).then((d) => setPlayers(d.players));
  }, [slug]);
  useEffect(() => setRows(initial), [initial]);

  const dirty = players?.filter((p) => rows[p.id] && initial[p.id] && !same(rows[p.id], initial[p.id])) ?? [];

  const set = (id: number, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  const save = useCallback(async () => {
    if (!players) return;
    setSaving(true);
    setError(null);
    try {
      const patch: Record<string, PlayerOverride | null> = {};
      for (const p of dirty) patch[String(p.id)] = overrideFrom(p, rows[p.id]);
      onDoc(await adminApi.patch({ players: patch }));
      onToast(`${dirty.length} jogador(es) salvo(s). O site já usa os novos dados.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [players, dirty, rows, onDoc, onToast]);

  // avisa antes de sair com alterações não salvas
  useEffect(() => {
    if (!dirty.length) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty.length]);

  if (!players) return <section className="admin__main"><p className="admin-loading">Carregando elenco…</p></section>;

  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const shown = players.filter((p) => {
    const r = rows[p.id];
    if (!r) return false;
    if (q && !norm(`${r.name} ${p.apiName} ${r.number}`).includes(norm(q))) return false;
    if (filter === "pendentes") return !r.reviewed;
    if (filter === "genericos") return p.source === "api" && !doc.players[String(p.id)]?.pos && ["ZAG", "MEI", "ATA"].includes(r.pos);
    if (filter === "ocultos") return r.hide;
    return true;
  });
  const pendingCount = players.filter((p) => rows[p.id] && !rows[p.id].reviewed).length;

  return (
    <section className="admin__main">
      <TeamInfo slug={slug} team={team} doc={doc} onDoc={onDoc} onToast={onToast} />

      <div className="admin-filters">
        <div className="seg">
          {([
            ["todos", `Todos (${players.length})`],
            ["pendentes", `Não revisados (${pendingCount})`],
            ["genericos", "Posição genérica"],
            ["ocultos", "Ocultos"],
          ] as [Filter, string][]).map(([f, label]) => (
            <button key={f} className={`seg__btn ${filter === f ? "is-on" : ""}`} onClick={() => setFilter(f)}>{label}</button>
          ))}
        </div>
        <input className="admin-search" type="search" placeholder="Buscar jogador…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          className="btn btn--sm"
          onClick={() => shown.forEach((p) => set(p.id, { reviewed: true }))}
          title="Marca como revisados os jogadores listados agora"
        >
          Marcar listados como revisados
        </button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th />
              <th>Nome exibido</th>
              <th>Nº</th>
              <th>Posição</th>
              <th>Alternativa 1</th>
              <th>Alternativa 2</th>
              <th>Origem</th>
              <th title="Esconde o jogador do site">Oculto</th>
              <th>Revisado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const r = rows[p.id];
              const changed = !same(r, initial[p.id]);
              const hasOv = !!doc.players[String(p.id)];
              return (
                <tr key={p.id} className={`${changed ? "is-dirty" : ""} ${r.hide ? "is-hidden" : ""}`}>
                  <td>
                    <Avatar player={{ id: p.id, name: r.name, number: null, pos: r.pos, photo: p.photo }} colors={team.colors} size={34} />
                  </td>
                  <td>
                    <input value={r.name} onChange={(e) => set(p.id, { name: e.target.value })} aria-label="Nome exibido" />
                    <small title="Nome na API-Football">API: {p.apiName} · id {p.id}</small>
                  </td>
                  <td>
                    <input className="admin-num" inputMode="numeric" value={r.number} onChange={(e) => set(p.id, { number: e.target.value.replace(/\D/g, "").slice(0, 2) })} aria-label="Número" />
                  </td>
                  <td><PosSelect value={r.pos} onChange={(v) => set(p.id, { pos: v as Pos })} /></td>
                  <td><PosSelect value={r.alt1} empty onChange={(v) => set(p.id, { alt1: v })} exclude={r.pos} /></td>
                  <td><PosSelect value={r.alt2} empty onChange={(v) => set(p.id, { alt2: v })} exclude={r.pos} /></td>
                  <td>
                    <span className={`src src--${p.source}`}>{hasOv ? "admin" : SOURCE_LABEL[p.source]}</span>
                    {p.note && <small title={p.note}>{p.note.replace(/^wikipedia: /, "")}</small>}
                    {p.apiPos && <small>API: {p.apiPos}</small>}
                  </td>
                  <td><input type="checkbox" checked={r.hide} onChange={(e) => set(p.id, { hide: e.target.checked })} aria-label="Oculto" /></td>
                  <td><input type="checkbox" checked={r.reviewed} onChange={(e) => set(p.id, { reviewed: e.target.checked })} aria-label="Revisado" /></td>
                  <td>
                    {hasOv && (
                      <button
                        className="icon-btn"
                        title="Desfazer ajustes do admin (volta ao dado original)"
                        onClick={async () => {
                          if (!confirm(`Remover os ajustes de ${r.name}?`)) return;
                          onDoc(await adminApi.patch({ players: { [String(p.id)]: null } }));
                          onToast("Ajuste removido");
                        }}
                      >
                        ⟲
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!shown.length && (
              <tr><td colSpan={10} className="admin-empty">Nenhum jogador neste filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={`admin-savebar ${dirty.length ? "is-on" : ""}`}>
        {error && <span className="admin-error">{error}</span>}
        <span>{dirty.length ? `${dirty.length} alteração(ões) não salva(s)` : "Tudo salvo"}</span>
        <button className="btn btn--sm btn--ghost" disabled={!dirty.length || saving} onClick={() => setRows(initial)}>Descartar</button>
        <button className="btn btn--primary" disabled={!dirty.length || saving} onClick={save}>{saving ? "Salvando…" : "Salvar alterações"}</button>
      </div>
    </section>
  );
}

function PosSelect({ value, onChange, empty, exclude }: { value: Pos | ""; onChange: (v: Pos | "") => void; empty?: boolean; exclude?: Pos }) {
  return (
    <select className={`admin-pos pos-badge--${value}`} value={value} onChange={(e) => onChange(e.target.value as Pos | "")}>
      {empty && <option value="">—</option>}
      {POSITIONS.filter((p) => p !== exclude || p === value).map((p) => (
        <option key={p} value={p}>{p}</option>
      ))}
    </select>
  );
}

// ============ dados do time ============

function TeamInfo({ slug, team, doc, onDoc, onToast }: {
  slug: string;
  team: { name: string; shortName: string; colors: Colors; crest: string | null };
  doc: OverridesDoc;
  onDoc: (d: OverridesDoc) => void;
  onToast: (s: string) => void;
}) {
  const base = TEAMS.find((t) => t.slug === slug)!;
  const [name, setName] = useState(team.name);
  const [shortName, setShortName] = useState(team.shortName);
  const [colors, setColors] = useState<Colors>(team.colors);
  const [open, setOpen] = useState(false);
  const changed = name !== team.name || shortName !== team.shortName || JSON.stringify(colors) !== JSON.stringify(team.colors);

  const save = async () => {
    const o: TeamOverride = {};
    if (name.trim() !== base.name) o.name = name.trim();
    if (shortName.trim() !== base.shortName) o.shortName = shortName.trim();
    if (JSON.stringify(colors) !== JSON.stringify(base.colors)) o.colors = colors;
    onDoc(await adminApi.patch({ teams: { [slug]: Object.keys(o).length ? o : null } }));
    onToast("Dados do clube salvos");
  };

  return (
    <div className="admin-teaminfo">
      <div className="admin-teaminfo__head">
        {team.crest && <img src={team.crest} alt="" width={44} height={44} />}
        <h2>{team.name}</h2>
        {doc.teams[slug] && <span className="src src--override">editado</span>}
        <button className="btn btn--sm btn--ghost" onClick={() => setOpen((o) => !o)}>{open ? "Fechar" : "Editar clube"}</button>
        <a className="btn btn--sm" href={`/${slug}`} target="_blank" rel="noreferrer">Ver prancheta ↗</a>
      </div>
      {open && (
        <div className="admin-teaminfo__form">
          <label className="field">Nome <input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field">Nome curto <input value={shortName} onChange={(e) => setShortName(e.target.value)} size={14} /></label>
          {(["primary", "secondary", "accent"] as const).map((k) => (
            <label key={k} className="field">
              {k === "primary" ? "Cor principal" : k === "secondary" ? "Secundária" : "Destaque"}
              <input type="color" value={colors[k]} onChange={(e) => setColors({ ...colors, [k]: e.target.value.toUpperCase() })} />
            </label>
          ))}
          <button className="btn btn--primary btn--sm" disabled={!changed} onClick={save}>Salvar clube</button>
          {doc.teams[slug] && (
            <button className="btn btn--sm btn--ghost" onClick={async () => { onDoc(await adminApi.patch({ teams: { [slug]: null } })); setName(base.name); setShortName(base.shortName); setColors(base.colors); onToast("Clube restaurado"); }}>
              Restaurar original
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============ senha ============

function PasswordDialog({ user, onClose, onDone }: { user: string; onClose: () => void; onDone: (u: string) => void }) {
  const [current, setCurrent] = useState("");
  const [newUser, setNewUser] = useState(user);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="admin-modal" role="dialog" aria-label="Trocar senha" onClick={onClose}>
      <form
        className="admin-login__card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          if (pw !== pw2) return setError("As senhas novas não conferem");
          try {
            onDone((await adminApi.changePassword(current, newUser, pw)).user);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <h1>Trocar usuário e senha</h1>
        <label>Senha atual<input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus autoComplete="current-password" /></label>
        <label>Usuário<input value={newUser} onChange={(e) => setNewUser(e.target.value)} required autoComplete="username" /></label>
        <label>Nova senha (mín. 8)<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} autoComplete="new-password" /></label>
        <label>Repita a nova senha<input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={8} autoComplete="new-password" /></label>
        {error && <p className="admin-error">{error}</p>}
        <div className="admin-modal__btns">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary">Salvar</button>
        </div>
      </form>
    </div>
  );
}
