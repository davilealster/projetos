// Login opcional: botão "Entrar"/avatar, convite "Quer salvar sua jornada?" e escolha em caso de conflito.
import { useEffect, useRef, useState } from "react";
import "./account.css";
import { closeLogin, hasProgress, loginWithGoogle, logout, openLogin, resolveConflict, useAccount } from "../lib/account";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string; auto_select?: boolean; use_fedcm_for_prompt?: boolean }): void;
          renderButton(el: HTMLElement, o: Record<string, unknown>): void;
          disableAutoSelect(): void;
        };
      };
    };
  }
}

let gisLoading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  return (gisLoading ??= new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => fail(new Error("gis"));
    document.head.appendChild(s);
  }));
}

/** Botão oficial "Continuar com o Google". */
function GoogleButton({ clientId, onError }: { clientId: string; onError: (m: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    loadGis()
      .then(() => {
        if (!alive || !box.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: "popup",
          callback: async (r) => {
            if (!(await loginWithGoogle(r.credential))) onError("Não foi possível entrar. Tente de novo.");
          },
        });
        window.google.accounts.id.renderButton(box.current, { theme: "filled_black", size: "large", shape: "pill", text: "continue_with", locale: "pt-BR", width: 280 });
      })
      .catch(() => alive && onError("O login do Google não carregou. Verifique a conexão ou bloqueadores."));
    return () => {
      alive = false;
    };
  }, [clientId, onError]);
  return <div className="acc-google" ref={box} />;
}

const ASK_KEY = "mef:ask"; // quando o convite foi dispensado (adiado por 3 dias)
const SNOOZE = 3 * 86400_000;

function snoozed(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(ASK_KEY) ?? 0) < SNOOZE || sessionStorage.getItem(ASK_KEY) === "1";
  } catch {
    return true;
  }
}
function snooze() {
  try {
    localStorage.setItem(ASK_KEY, String(Date.now()));
    sessionStorage.setItem(ASK_KEY, "1");
  } catch {
    /* sem storage */
  }
}

/** Convite + conflito. Montado uma vez no App. */
export function AccountModals() {
  const acc = useAccount();
  const [error, setError] = useState<string | null>(null);

  // convite automático: só com progresso de verdade, depois de um tempo, no máximo uma vez por sessão
  useEffect(() => {
    if (!acc.ready || !acc.enabled || acc.user) return;
    const t = window.setInterval(() => {
      if (!snoozed() && hasProgress() && !document.querySelector('[role="dialog"]')) {
        try {
          sessionStorage.setItem(ASK_KEY, "1");
        } catch {
          /* ok */
        }
        openLogin();
      }
    }, 20_000);
    return () => window.clearInterval(t);
  }, [acc.ready, acc.enabled, acc.user]);

  const dismiss = () => {
    snooze();
    setError(null);
    closeLogin();
  };

  if (acc.conflict) {
    const n = acc.conflict.keys.length;
    return (
      <div className="acc-modal brand" role="dialog" aria-modal="true" aria-labelledby="acc-c-title">
        <div className="acc-card">
          <p className="brand-eyebrow">Sua jornada</p>
          <h2 id="acc-c-title">Qual progresso manter?</h2>
          <p>
            Este navegador e a sua conta têm versões diferentes de {n === 1 ? "um item" : `${n} itens`} ({describe(acc.conflict.keys)}). Escolha
            qual fica valendo nos dois.
          </p>
          <div className="acc-acts">
            <button className="brand-btn brand-btn--brass" onClick={() => void resolveConflict("server")}>Manter o da conta</button>
            <button className="brand-btn" onClick={() => void resolveConflict("local")}>Manter o deste navegador</button>
          </div>
        </div>
      </div>
    );
  }

  if (!acc.askOpen || !acc.enabled || acc.user || !acc.clientId) return null;
  return (
    <div className="acc-modal brand" role="dialog" aria-modal="true" aria-labelledby="acc-title" onClick={dismiss}>
      <div className="acc-card" onClick={(e) => e.stopPropagation()}>
        <button className="acc-close" onClick={dismiss} aria-label="Fechar">×</button>
        <img className="acc-logo" src="/brand/escudo@2x.png" alt="" />
        <p className="brand-eyebrow">Meu Elenco FC</p>
        <h2 id="acc-title">Quer salvar sua jornada?</h2>
        <p>
          Faça o login e continue de onde parou em qualquer navegador ou celular: seu clube, as decisões e contratações do mercado, a
          escalação e as prateleiras do olheiro.
        </p>
        <GoogleButton clientId={acc.clientId} onError={setError} />
        {error && <p className="acc-error">{error}</p>}
        <button className="acc-later" onClick={dismiss}>Agora não</button>
        <p className="acc-note">Opcional. Sem login, tudo continua salvo só neste navegador.</p>
      </div>
    </div>
  );
}

function describe(keys: string[]): string {
  const names = keys.map((k) => {
    const [mod, slug] = k.split(":");
    const m = mod === "mercado" ? "mercado" : mod === "olheiro" ? "olheiro" : mod === "prancheta" ? "prancheta" : "preferências";
    return slug && slug !== "clube" && slug !== "view" ? `${m} do ${slug}` : m;
  });
  return [...new Set(names)].slice(0, 4).join(", ");
}

/** Botão do cabeçalho: "Entrar" (abre o convite) ou o avatar com "Sair". */
export function AccountButton({ compact = false }: { compact?: boolean }) {
  const acc = useAccount();
  const [open, setOpen] = useState(false);
  if (!acc.ready || !acc.enabled) return null;
  if (!acc.user) {
    return (
      <button className={`acc-btn ${compact ? "is-compact" : ""}`} onClick={openLogin} title="Salvar sua jornada na conta">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" /></svg>
        {!compact && <span>Entrar</span>}
      </button>
    );
  }
  const u = acc.user;
  return (
    <div className="acc-me">
      <button className="acc-avatar" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Conta de ${u.name}`} title={acc.syncing ? "Sincronizando…" : "Jornada salva na conta"}>
        {u.picture ? <img src={u.picture} alt="" referrerPolicy="no-referrer" /> : <span>{u.name.slice(0, 1)}</span>}
        <i className={acc.syncing ? "is-sync" : ""} aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="acc-scrim" onClick={() => setOpen(false)} />
          <div className="acc-menu" role="menu">
            <p><b>Olá, {u.name}</b><small>Sua jornada fica salva na conta ✓</small></p>
            <button role="menuitem" onClick={() => void logout()}>Sair</button>
          </div>
        </>
      )}
    </div>
  );
}
